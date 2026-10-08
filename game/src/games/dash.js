// DIAPER DASH (server side). A 20 s reflex round: pacifiers fall, tap the good
// ones, avoid the diapers. Phones build the identical spawn schedule from
// content.seed; the server only needs it for the score cap.
import data from "../../public/data/dash.js";
import { buildSchedule, scheduleLimits, roundSpec } from "../../public/games/dash-schedule.js";
import { relative, clamp } from "../scoring.js";

const ROUND_MS = data.duration;

function contentFor(round, seed) {
  const spec = roundSpec(round);
  return { round, title: spec.title, subtitle: spec.subtitle, seed, twins: !!spec.twins, duration: ROUND_MS, rate: spec.rate, speed: spec.speed };
}

function limitsFor(round, seed) {
  return scheduleLimits(buildSchedule(contentFor(round, seed)));
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : NaN);

// One player's answer -> { caught, gold, bad, raw } with junk turned into zeros.
function cleanAnswer(a, lim) {
  if (!a || typeof a !== "object") return { caught: 0, gold: 0, bad: 0, vomit: 0, raw: 0 };
  const caught = clamp(Math.round(num(a.caught) || 0), 0, lim.good);
  const gold = clamp(Math.round(num(a.gold) || 0), 0, lim.gold);
  const bad = clamp(Math.round(num(a.bad) || 0), 0, lim.bad);
  const vomit = clamp(Math.round(num(a.vomit) || 0), 0, lim.vomit || 0);
  const reported = num(a.score);
  const fromCounts = caught * data.points.good + gold * data.points.gold + bad * data.points.bad + vomit * data.points.vomit;
  const raw = clamp(Math.round(isNaN(reported) ? fromCounts : Math.min(reported, fromCounts)), 0, lim.max);
  return { caught, gold, bad, vomit, raw };
}

function cleaned(answers, round, seed) {
  const lim = limitsFor(round, seed);
  const out = {};
  for (const id in answers) out[id] = cleanAnswer(answers[id] && answers[id].a, lim);
  return { lim, out };
}

export default {
  id: "dash",
  title: "DIAPER DASH",
  tagline: "CATCH THE GOOD STUFF",
  icon: "dash",
  rounds: data.rounds.length,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: false,
  progressive: true,
  maxPoints: () => 1000,

  howto(round) {
    const spec = roundSpec(round);
    let text = "TAP THE FALLING PACIFIERS. DON'T TAP THE POOPIES.";
    if (spec.goldShare > 0) text += " GOLD BOTTLES ARE WORTH 3.";
    if (spec.vomitShare > 0) text += " VOMIT COSTS 5.";
    if (spec.wind) text += " THE WIND BLOWS EVERYTHING SIDEWAYS.";
    if (spec.twins) text += " TWO LANES, TWO HANDS.";
    return { title: spec.title, text, demo: "tap", points: "UP TO 1000 PTS" };
  },

  content(round, ctx) {
    return contentFor(round, ctx.seed);
  },

  // PRACTICE: one slow lane, no gold, so people can try tapping before round 1.
  // `spec` overrides the round's rate and speed on the phone.
  practice(ctx) {
    const spec = { rate: 0.9, speed: 0.8, speedSpread: 0.5, goldShare: 0, badShare: 0.25, vomitShare: 0, wind: 0 };
    return { ...contentFor(1, ctx.seed), title: "PRACTICE: WARM-UP", subtitle: "NOTHING COUNTS. TAP THE PACIFIERS, SKIP THE POOPIES.", rate: spec.rate, speed: spec.speed, spec };
  },

  // answers: { playerId: { a: { caught, gold, bad, score }, t, final } }
  score(answers, round, ctx) {
    const { out } = cleaned(answers, round, ctx.seed);
    const raw = {};
    for (const id in out) raw[id] = out[id].raw;
    return relative(raw, 1000);
  },

  revealData(answers, round, ctx) {
    const { lim, out } = cleaned(answers, round, ctx.seed);
    const rows = Object.keys(out).map((id) => ({ id, raw: out[id].raw, caught: out[id].caught, gold: out[id].gold, bad: out[id].bad, vomit: out[id].vomit }));
    rows.sort((a, b) => b.raw - a.raw || b.caught - a.caught || a.id.localeCompare(b.id));
    const n = rows.length;
    const sum = rows.reduce((s, r) => s + r.raw, 0);
    return {
      top: rows.slice(0, 5),
      max: lim.max,
      best: n ? rows[0].raw : 0,
      avg: n ? Math.round(sum / n) : 0,
      answered: n,
      totalCaught: rows.reduce((s, r) => s + r.caught + r.gold, 0),
      totalGold: rows.reduce((s, r) => s + r.gold, 0),
      totalBad: rows.reduce((s, r) => s + r.bad, 0),
      totalVomit: rows.reduce((s, r) => s + r.vomit, 0),
      wind: !!roundSpec(round).wind,
      twins: !!roundSpec(round).twins
    };
  },

  liveStat(answers, round, ctx) {
    const { out } = cleaned(answers, round, ctx.seed);
    const names = {};
    (ctx.players || []).forEach((p) => { names[p.id] = p.name; });
    const bars = Object.keys(out).map((id) => ({ id, name: names[id] || "?", value: out[id].raw }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 10);
    return { answered: Object.keys(answers).length, bars };
  },

  // Bots catch a share of what the schedule offers; a few are butterfingers.
  botAnswer(round, ctx, bot, rng) {
    const lim = limitsFor(round, ctx.seed);
    const skill = 0.15 + rng() * 0.8;
    const sloppy = rng() < 0.3;
    const caught = clamp(Math.round(lim.good * skill * (0.85 + rng() * 0.3)), 0, lim.good);
    const gold = clamp(Math.round(lim.gold * skill * (0.5 + rng() * 0.6)), 0, lim.gold);
    const bad = clamp(Math.round(lim.bad * (1 - skill) * (sloppy ? 0.5 : 0.15) * rng() * 2), 0, lim.bad);
    const vomit = clamp(Math.round((lim.vomit || 0) * (1 - skill) * (sloppy ? 0.6 : 0.1) * rng() * 2), 0, lim.vomit || 0);
    const score = caught * data.points.good + gold * data.points.gold + bad * data.points.bad + vomit * data.points.vomit;
    // Answers are progressive and only the last counts, so bots land late in the round.
    return { a: { caught, gold, bad, vomit, score }, delayMs: 15000 + rng() * 4500 };
  }
};
