// WHERE'S THE BINKY? (server side). A busy pixel scene hides five baby items;
// phones tap them. Progressive: every find is submitted as it happens. The scene
// is regenerated here from the round seed, so content never carries positions.
import data from "../../public/data/binky.js";
import { generateScene, roundSpec, targetName } from "../../public/games/binky-scene.js";
import { clamp } from "../scoring.js";

const ROUND_MS = 45000;
const PER_FIND = 200;
const SPEED_BONUS = 200;
const TARGET_COUNT = data.targets.length;

// Distinct, valid keys in the order the player found them, plus the index in the
// submitted list where the last of them sits (for its timestamp).
function validFinds(a, validKeys) {
  const keys = a && Array.isArray(a.found) ? a.found : [];
  const out = [];
  let lastIdx = -1;
  keys.forEach((k, i) => {
    if (typeof k === "string" && validKeys.has(k) && !out.includes(k)) { out.push(k); lastIdx = i; }
  });
  return { keys: out, lastIdx };
}

// Time of the last find in ms: the client's own stamp for that find, else the
// time the server saw the submission.
function lastFindTime(answer, lastIdx, roundMs) {
  const a = answer && answer.a;
  let t = NaN;
  if (a && Array.isArray(a.t)) {
    const v = lastIdx >= 0 && lastIdx < a.t.length ? Number(a.t[lastIdx]) : Number(a.t[a.t.length - 1]);
    if (isFinite(v)) t = v;
  }
  if (!isFinite(t)) t = Number(answer && answer.t);
  if (!isFinite(t)) t = roundMs;
  return clamp(t, 0, roundMs);
}

function summarize(answers, round, ctx) {
  const scene = generateScene(ctx.seed, round);
  const valid = new Set(scene.targets.map((t) => t.key));
  const roundMs = ctx.roundTime || ROUND_MS;
  const rows = {};
  for (const id in answers) {
    const { keys, lastIdx } = validFinds(answers[id].a, valid);
    rows[id] = { keys, n: keys.length, t: keys.length ? lastFindTime(answers[id], lastIdx, roundMs) : roundMs };
  }
  return { scene, rows, roundMs };
}

export default {
  id: "binky",
  title: "WHERE'S THE BINKY?",
  tagline: "FIVE HIDDEN BABY ITEMS. TAP THEM.",
  icon: "binky",
  rounds: data.rounds.length,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: false,
  progressive: true,
  maxPoints: () => PER_FIND * TARGET_COUNT + SPEED_BONUS,

  howto(round) {
    const spec = roundSpec(round);
    const names = data.targets.map((t) => t.name + (t.key === "binky" ? " (SAFETY PIN)" : "")).join(", ");
    return {
      title: spec.title,
      text: "TAP THE " + TARGET_COUNT + " HIDDEN BABY ITEMS: " + names + "." + (spec.mode === "night" ? " IT'S DARK. YOUR FINGER IS THE FLASHLIGHT." : ""),
      demo: "tap",
      points: "UP TO " + (PER_FIND * TARGET_COUNT + SPEED_BONUS) + " PTS"
    };
  },

  // Phones regenerate the scene from the seed; positions are never sent.
  content(round, ctx) {
    const spec = roundSpec(round);
    return {
      round,
      title: spec.title,
      subtitle: spec.subtitle || "",
      seed: ctx.seed,
      mode: spec.mode === "night" ? "night" : "normal",
      targetKeys: data.targets.map((t) => t.key),
      targetNames: Object.fromEntries(data.targets.map((t) => [t.key, t.name])),
      targetChars: Object.fromEntries(data.targets.map((t) => [t.key, t.ch]))
    };
  },

  // answers: { playerId: { a: { found: [keys], t: [msPerFind] }, t, final } }
  score(answers, round, ctx) {
    const { rows, roundMs } = summarize(answers, round, ctx);
    const out = {};
    for (const id in rows) {
      const r = rows[id];
      let pts = PER_FIND * r.n;
      if (r.n === TARGET_COUNT) pts += SPEED_BONUS * clamp(1 - r.t / roundMs, 0, 1);
      out[id] = Math.round(pts);
    }
    return out;
  },

  revealData(answers, round, ctx, points) {
    const { scene, rows } = summarize(answers, round, ctx);
    const names = Object.fromEntries((ctx.players || []).map((p) => [p.id, p.name]));
    const found = Object.fromEntries(scene.targets.map((t) => [t.key, 0]));
    let all5 = 0, fastest = null;
    for (const id in rows) {
      const r = rows[id];
      r.keys.forEach((k) => { found[k]++; });
      if (r.n === TARGET_COUNT) {
        all5++;
        if (!fastest || r.t < fastest.t) fastest = { id, name: names[id] || "", t: Math.round(r.t) };
      }
    }
    const best = Object.keys(rows).filter((id) => (points[id] || 0) > 0)
      .sort((a, b) => (points[b] || 0) - (points[a] || 0) || rows[a].t - rows[b].t).slice(0, 3);
    return {
      seed: ctx.seed,
      mode: scene.mode,
      targets: scene.targets.map((t) => ({ key: t.key, x: t.x, y: t.y, size: t.size, name: targetName(t.key) })),
      counts: { all5, found },
      fastest,
      best
    };
  },

  liveStat(answers, round, ctx) {
    const { rows } = summarize(answers, round, ctx);
    const names = Object.fromEntries((ctx.players || []).map((p) => [p.id, p.name]));
    const ids = Object.keys(rows);
    const bars = ids.map((id) => ({ id, name: names[id] || "?", value: rows[id].n, t: rows[id].t }))
      .sort((a, b) => b.value - a.value || a.t - b.t).slice(0, 10).map((b) => ({ id: b.id, name: b.name, value: b.value }));
    const avg = ids.length ? Math.round(10 * ids.reduce((s, id) => s + rows[id].n, 0) / ids.length) / 10 : 0;
    return { answered: ids.length, bars, avg };
  },

  // A bot finds 2 to 5 items at times spread over the round; its answer lands
  // when its last find does.
  botAnswer(round, ctx, bot, rng) {
    const roundMs = ctx.roundTime || ROUND_MS;
    const weights = [[2, 0.2], [3, 0.3], [4, 0.3], [5, 0.2]];
    let k = 5, roll = rng();
    for (const [n, w] of weights) { if (roll < w) { k = n; break; } roll -= w; }
    const keys = rng.shuffle(data.targets.map((t) => t.key)).slice(0, k);
    const times = keys.map(() => Math.round(2500 + rng() * (roundMs - 5000))).sort((a, b) => a - b);
    return { a: { found: keys, t: times }, delayMs: times[times.length - 1] };
  }
};
