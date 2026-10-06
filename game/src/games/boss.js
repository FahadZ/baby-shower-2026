// BOSS BATTLE (server side). The classic 4-option quiz saved for last and
// framed as a boss fight: three questions, 10 s each, double points, and every
// correct answer deals its points as damage to KING BINKY. The room defeats
// the boss together, so the HP carries over from round to round via ctx.results.
import data from "../../public/data/boss.js";
import { speedPoints } from "../scoring.js";
import { rngFor } from "../rng.js";

const ROUND_MS = 10000;
const ROUNDS = 3;
const MAX_POINTS = 2000;
const MIN_PLAYERS = 3;
const BOT_CORRECT_P = 0.55;

// The three questions for a whole game: one seeded pick shared by every round
// (and by every phone, if it ever needs to reproduce it).
export function pickQuestions(seed) {
  const rng = rngFor(seed, "boss-pick");
  const idx = data.questions.map((_, i) => i);
  return rng.shuffle(idx).slice(0, ROUNDS);
}

export function questionFor(round, ctx) {
  const picks = pickQuestions(ctx.seed);
  return data.questions[picks[round - 1]];
}

function playerCount(ctx) {
  return Math.max(MIN_PLAYERS, (ctx.players || []).length);
}

function roundIdOf(r) { return "boss-" + r; }

// Points already dealt in earlier boss rounds are the damage so far.
function damageBefore(round, ctx) {
  let dmg = 0;
  for (let r = 1; r < round; r++) {
    const res = ctx.results && ctx.results[roundIdOf(r)];
    if (!res || !res.points) continue;
    for (const id in res.points) dmg += Math.max(0, Number(res.points[id]) || 0);
  }
  return dmg;
}

// The max HP is fixed by the room size when the fight starts. Later rounds
// reuse what round 1 recorded so the bar never jumps if someone joins mid-fight.
function bossMaxFor(round, ctx) {
  for (let r = 1; r < round; r++) {
    const res = ctx.results && ctx.results[roundIdOf(r)];
    const m = res && res.reveal && Number(res.reveal.bossMax);
    if (m > 0) return m;
  }
  return data.boss.hpPerPlayer * playerCount(ctx);
}

function sumPoints(points) {
  let s = 0;
  for (const id in points) s += Math.max(0, Number(points[id]) || 0);
  return s;
}

export default {
  id: "boss",
  title: "BOSS BATTLE",
  tagline: "FINAL BOSS: " + data.boss.name,
  icon: "boss",
  rounds: ROUNDS,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: true,
  progressive: false,
  maxPoints: () => MAX_POINTS,

  howto(round) {
    return {
      title: round === 1 ? "FINAL BOSS: " + data.boss.name : "BOSS BATTLE " + round + "/" + ROUNDS,
      text: "FINAL BOSS. TAP THE RIGHT ANSWER FAST. EVERY CORRECT ANSWER HITS THE BOSS. DOUBLE POINTS.",
      demo: "boss",
      points: "UP TO " + MAX_POINTS + " PTS"
    };
  },

  // What every phone gets. Never includes the answer or the fact.
  content(round, ctx) {
    const q = questionFor(round, ctx);
    const bossMax = bossMaxFor(round, ctx);
    const bossHp = Math.max(0, bossMax - damageBefore(round, ctx));
    return {
      round,
      title: "BOSS BATTLE " + round + "/" + ROUNDS,
      q: q.q,
      options: q.options.slice(),
      bossName: data.boss.name,
      bossMax,
      bossHp
    };
  },

  // answers: { playerId: { a: <option index>, t } }
  score(answers, round, ctx) {
    const q = questionFor(round, ctx);
    const roundMs = (ctx && ctx.roundTime) || ROUND_MS;
    const out = {};
    for (const id in answers) {
      const a = answers[id];
      const correct = Number(a.a) === q.answer;
      const t = Math.max(0, Number(a.t) || 0);
      out[id] = speedPoints(correct, roundMs - t, roundMs, { scale: 2 });
    }
    return out;
  },

  revealData(answers, round, ctx, points) {
    const q = questionFor(round, ctx);
    const split = [0, 0, 0, 0];
    const correctIds = [];
    for (const id in answers) {
      const a = Number(answers[id].a);
      if (a >= 0 && a < 4) split[a]++;
      if (a === q.answer) correctIds.push(id);
    }
    correctIds.sort((x, y) => (answers[x].t || 0) - (answers[y].t || 0));
    const bossMax = bossMaxFor(round, ctx);
    const bossHpBefore = Math.max(0, bossMax - damageBefore(round, ctx));
    const damage = sumPoints(points || {});
    const bossHpAfter = Math.max(0, bossHpBefore - damage);
    return {
      answer: q.answer,
      fact: q.fact,
      q: q.q,
      options: q.options.slice(),
      split,
      correctCount: correctIds.length,
      answered: Object.keys(answers).length,
      damage,
      bossName: data.boss.name,
      bossMax,
      bossHpBefore,
      bossHpAfter,
      defeated: bossHpAfter <= 0,
      alreadyDown: bossHpBefore <= 0,
      lastRound: round >= ROUNDS,
      best: correctIds.slice(0, 3)
    };
  },

  liveStat(answers) {
    return { answered: Object.keys(answers).length };
  },

  // Bots: right a bit more than half the time, tapping between 1.5 s and 8 s.
  botAnswer(round, ctx, bot, rng) {
    const q = questionFor(round, ctx);
    const correct = rng() < BOT_CORRECT_P;
    let a = q.answer;
    if (!correct) {
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
      a = wrong[Math.floor(rng() * wrong.length)];
    }
    return { a, delayMs: 1500 + rng() * 6500 };
  }
};
