// PUT IT IN ORDER (server side). Five tiles, drag them into the right order.
// Scored with orderingPoints: fraction of correctly ordered pairs, +200 when perfect.
import data from "../../public/data/order.js";
import { orderingPoints } from "../scoring.js";
import { rngFor } from "../rng.js";

const ROUND_MS = 30000;
const MAX = 1200;

export const roundSpec = (round) => data.rounds[round - 1];

const sameOrder = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

// The shuffled tile order every phone sees. Never the correct order.
export function shuffledKeys(spec, rng) {
  const keys = spec.items.map((it) => it.key);
  let out = rng.shuffle(keys);
  let guard = 0;
  while (sameOrder(out, spec.correct) && guard++ < 50) out = rng.shuffle(keys);
  if (sameOrder(out, spec.correct)) out = out.slice(1).concat(out[0]);
  return out;
}

// Exactly the round's keys, each once, in some order.
export function validAnswer(a, spec) {
  if (!Array.isArray(a) || a.length !== spec.correct.length) return false;
  const allowed = new Set(spec.correct);
  const seen = new Set();
  for (const k of a) {
    if (typeof k !== "string" || !allowed.has(k) || seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

const roundRng = (round, ctx) => (ctx && ctx.rng) || rngFor((ctx && ctx.seed) || 0, "order-" + round);

export default {
  id: "order",
  title: "PUT IT IN ORDER",
  tagline: "DRAG. DROP. LOCK IN.",
  icon: "order",
  rounds: data.rounds.length,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: true,
  progressive: false,
  maxPoints: () => MAX,

  howto(round) {
    const spec = roundSpec(round);
    return {
      title: spec.title,
      text: "DRAG THE TILES INTO ORDER, FIRST AT THE TOP. LOCK IN WHEN YOU'RE HAPPY.",
      demo: "drag",
      points: "UP TO " + MAX + " PTS"
    };
  },

  // Public content: the tiles in a seeded shuffle. No `correct`, no hints.
  content(round, ctx) {
    const spec = roundSpec(round);
    const byKey = Object.fromEntries(spec.items.map((it) => [it.key, it]));
    return {
      title: spec.title,
      prompt: spec.prompt,
      items: shuffledKeys(spec, roundRng(round, ctx)).map((key) => ({ key, label: byKey[key].label, emoji: byKey[key].emoji })),
      topLabel: spec.topLabel || "FIRST",
      bottomLabel: spec.bottomLabel || "LAST"
    };
  },

  // answers: { playerId: { a: [key, key, key, key, key], t } }
  score(answers, round) {
    const spec = roundSpec(round);
    const out = {};
    for (const id in answers) {
      const a = answers[id] && answers[id].a;
      out[id] = validAnswer(a, spec) ? orderingPoints(a, spec.correct, { max: 1000, perfectBonus: 200 }) : 0;
    }
    return out;
  },

  revealData(answers, round, ctx, points) {
    const spec = roundSpec(round);
    const ids = Object.keys(answers);
    const positions = {};
    spec.correct.forEach((k) => { positions[k] = { right: 0 }; });
    let perfect = 0, valid = 0;
    ids.forEach((id) => {
      const a = answers[id] && answers[id].a;
      if (!validAnswer(a, spec)) return;
      valid++;
      spec.correct.forEach((k, i) => { if (a[i] === k) positions[k].right++; });
      if ((points[id] || 0) >= MAX) perfect++;
    });
    const best = ids.filter((id) => (points[id] || 0) > 0)
      .sort((x, y) => (points[y] - points[x]) || ((answers[x].t || 0) - (answers[y].t || 0)))
      .slice(0, 3);
    return {
      correct: spec.correct.slice(),
      items: spec.items.map((it) => ({ key: it.key, label: it.label, emoji: it.emoji, hint: it.hint || "" })),
      // The same shuffle the phones saw (same seeded rng), so the TV can animate from it.
      shuffled: shuffledKeys(spec, roundRng(round, ctx)),
      topLabel: spec.topLabel || "FIRST",
      bottomLabel: spec.bottomLabel || "LAST",
      perfect,
      best,
      positions,
      answered: valid
    };
  },

  liveStat(answers) {
    return { answered: Object.keys(answers).length };
  },

  // The correct order with 0-4 random adjacent swaps, sent 5-25 s in.
  botAnswer(round, ctx, bot, rng) {
    const spec = roundSpec(round);
    const a = spec.correct.slice();
    const swaps = Math.floor(rng() * 5);
    for (let i = 0; i < swaps; i++) {
      const j = Math.floor(rng() * (a.length - 1));
      [a[j], a[j + 1]] = [a[j + 1], a[j]];
    }
    return { a, delayMs: 5000 + rng() * 20000 };
  }
};
