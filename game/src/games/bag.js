// FIT THE DIAPER BAG (server side). Grid packing: the answer is the list of
// placed items; the server re-validates it, scores cells + value minus a
// penalty per missing essential, and hands out relative points (best = 1000).
import data from "../../public/data/bag.js";
import { relative } from "../scoring.js";
import { expandItems, fillStats, validPlacement, greedyPack, parseMask } from "../../public/games/bag-shared.js";

const PENALTY = Number.isFinite(data.essentialPenalty) ? data.essentialPenalty : 15;
const HOWTO = "DRAG ITEMS INTO THE BAG. TAP AN ITEM TO ROTATE. FILL IT UP; DON'T FORGET THE ESSENTIALS (DIAPERS, WIPES, BOTTLE, BINKY).";

function roundSpec(round) {
  return data.rounds[round - 1] || data.rounds[0];
}

export function roundMask(round) {
  const spec = roundSpec(round);
  return Array.isArray(spec.mask) ? spec.mask : data.masks[spec.mask];
}

export function roundItems(round) {
  return expandItems(data, roundSpec(round).items);
}

// The item fields a phone needs (shape, look, value, essential flag).
function publicItems(ids, itemsById) {
  return ids.filter((id) => itemsById[id]).map((id) => {
    const it = itemsById[id];
    return { id, base: it.base, name: it.name, emoji: it.emoji, color: it.color, value: it.value, essential: !!it.essential, shape: it.shape };
  });
}

// Raw packing score: cells covered + item values, minus PENALTY per missing essential.
export function rawScore(stats) {
  return Math.max(0, stats.cellsUsed + stats.value - PENALTY * stats.missingEssentials);
}

// Validate one answer the way the game is meant to be played: items are
// walked in order and anything that overlaps or sticks out is dropped.
export function evaluate(a, round) {
  const mask = roundMask(round);
  const itemsById = roundItems(round);
  const raw = a && Array.isArray(a.placed) ? a.placed : (Array.isArray(a) ? a : []);
  const placed = validPlacement(mask, raw, itemsById);
  const stats = fillStats(mask, placed, itemsById);
  return { placed, stats, raw: rawScore(stats) };
}

export default {
  id: "bag",
  title: "FIT THE DIAPER BAG",
  tagline: "PACK IT ALL. DON'T FORGET THE WIPES.",
  icon: "bag",
  rounds: data.rounds.length,
  data,
  roundTime: (round) => (roundSpec(round).seconds || 45) * 1000,
  autoEnd: false,
  progressive: true,
  maxPoints: () => 1000,

  howto(round) {
    const spec = roundSpec(round);
    return { title: spec.title, text: HOWTO, demo: "drag", points: "UP TO 1000 PTS" };
  },

  // Everything a phone needs to run the round. There is no hidden answer.
  content(round) {
    const spec = roundSpec(round);
    const items = publicItems(spec.items, roundItems(round));
    return {
      title: spec.title,
      subtitle: spec.subtitle || "",
      seconds: spec.seconds || 45,
      mask: roundMask(round),
      items,
      essentialsTotal: items.filter((it) => it.essential).length,
      cellsTotal: parseMask(roundMask(round)).count
    };
  },

  // PRACTICE: a small square bag and six items that all fit, so people can try
  // dragging and rotating before round 1. Nothing is scored.
  practice() {
    const mask = ["######", "######", "######", "######", "######", "######"];
    const ids = ["diapers", "wipes", "bottle", "pacifier", "teddy", "snack"];
    const items = publicItems(ids, expandItems(data, ids));
    return {
      title: "PRACTICE: PACK THE ESSENTIALS",
      subtitle: "NOTHING COUNTS. DRAG, DROP, TAP TO ROTATE.",
      seconds: 45,
      mask,
      items,
      essentialsTotal: items.filter((it) => it.essential).length,
      cellsTotal: parseMask(mask).count
    };
  },

  // answers: { playerId: { a: { placed: [{ key, x, y, rot }] }, t, final } }
  score(answers, round) {
    const raw = {};
    for (const id in answers) raw[id] = evaluate(answers[id].a, round).raw;
    return relative(raw, 1000);
  },

  revealData(answers, round, ctx, points) {
    const mask = roundMask(round);
    const itemsById = roundItems(round);
    const rows = Object.keys(answers).map((id) => {
      const ev = evaluate(answers[id].a, round);
      return { id, placed: ev.placed, stats: ev.stats, raw: ev.raw, pts: (points && points[id]) || 0 };
    }).sort((a, b) => b.raw - a.raw || b.stats.fillPct - a.stats.fillPct || a.id.localeCompare(b.id));
    // The best bag is shown even when the essentials penalty floored its score.
    const winner = rows[0] && rows[0].placed.length > 0 ? rows[0] : null;
    const items = {};
    for (const id in itemsById) {
      const it = itemsById[id];
      items[id] = { name: it.name, emoji: it.emoji, color: it.color, shape: it.shape, value: it.value, essential: !!it.essential };
    }
    return {
      mask,
      items,
      winner: winner ? { id: winner.id, placed: winner.placed, stats: winner.stats } : null,
      top: rows.slice(0, 5).map((r) => ({ id: r.id, fillPct: r.stats.fillPct, value: r.stats.value, missing: r.stats.missingEssentials, pts: r.pts })),
      avgFill: rows.length ? Math.round(rows.reduce((s, r) => s + r.stats.fillPct, 0) / rows.length) : 0,
      perfectEssentials: rows.filter((r) => r.stats.missingEssentials === 0 && r.placed.length > 0).length,
      answered: rows.length
    };
  },

  // Live fill percentages for the host STAGE view and the TV (top 10).
  liveStat(answers, round, ctx) {
    const names = {};
    (ctx.players || []).forEach((p) => { names[p.id] = p.name; });
    const bars = Object.keys(answers).map((id) => ({ id, name: names[id] || "?", value: evaluate(answers[id].a, round).stats.fillPct }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 10);
    return { answered: Object.keys(answers).length, bars };
  },

  // Bots pack greedily: a shuffled subset of the items, first fit, random rotation.
  botAnswer(round, ctx, bot, rng) {
    const spec = roundSpec(round);
    const placed = greedyPack(roundMask(round), spec.items, roundItems(round), rng, { fraction: 0.5 + rng() * 0.5 });
    const total = ctx.roundTime || (spec.seconds || 45) * 1000;
    return { a: { placed }, delayMs: 3000 + rng() * Math.max(1000, total - 5000) };
  }
};
