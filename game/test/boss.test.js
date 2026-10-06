import { test } from "node:test";
import assert from "node:assert/strict";
import boss, { pickQuestions, questionFor } from "../src/games/boss.js";
import data from "../public/data/boss.js";

const ROUND_MS = 10000;
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
const ctx = (seed, extra = {}) => ({ seed, roundId: "boss-1", round: 1, roundTime: ROUND_MS, players: players(5), results: {}, data, ...extra });

test("data: fifteen 4-option questions with a valid answer index and a fact", () => {
  assert.equal(data.questions.length, 15);
  for (const q of data.questions) {
    assert.equal(q.options.length, 4);
    assert.ok(q.answer >= 0 && q.answer < 4);
    assert.ok(q.q && q.fact);
    assert.equal(new Set(q.options).size, 4, "options are distinct");
  }
  assert.equal(data.boss.name, "KING BINKY");
  assert.equal(data.boss.hpPerPlayer, 4000);
  assert.equal(boss.rounds, 5);
  assert.equal(boss.roundTime(1), ROUND_MS);
  assert.equal(boss.maxPoints(1), 2000);
  assert.equal(boss.autoEnd, true);
  assert.equal(boss.progressive, false);
});

test("content: the same five distinct questions for a seed across rounds, never the answer", () => {
  const picks = pickQuestions(42);
  assert.equal(picks.length, 5);
  assert.equal(new Set(picks).size, 5, "five distinct questions");
  assert.deepEqual(pickQuestions(42), picks, "deterministic for a seed");
  const qs = [1, 2, 3, 4, 5].map((r) => boss.content(r, ctx(42, { round: r, roundId: "boss-" + r })));
  qs.forEach((c, i) => {
    assert.equal(c.round, i + 1);
    assert.equal(c.title, "BOSS BATTLE " + (i + 1) + "/5");
    assert.equal(c.q, data.questions[picks[i]].q);
    assert.deepEqual(c.options, data.questions[picks[i]].options);
    assert.equal("answer" in c, false, "content never includes the answer");
    assert.equal("fact" in c, false, "content never includes the fact");
    assert.equal(JSON.stringify(c).includes(data.questions[picks[i]].fact), false);
    assert.equal(c.bossName, "KING BINKY");
  });
  assert.equal(new Set(qs.map((c) => c.q)).size, 5);
  // A second call with the same seed agrees with the first (every round agrees).
  assert.deepEqual(boss.content(2, ctx(42, { round: 2 })), qs[1]);
  // Another seed is also valid content.
  const other = boss.content(1, ctx(7));
  assert.ok(data.questions.some((q) => q.q === other.q));
});

test("content: boss HP is hpPerPlayer x players (min 3) and carries over from earlier rounds", () => {
  const c1 = boss.content(1, ctx(42));
  assert.equal(c1.bossMax, 4000 * 5);
  assert.equal(c1.bossHp, c1.bossMax);
  const small = boss.content(1, ctx(42, { players: [] }));
  assert.equal(small.bossMax, 4000 * 3, "at least 3 players' worth of HP");
  const results = { "boss-1": { points: { a: 2000, b: 1200, c: 0 } } };
  const c2 = boss.content(2, ctx(42, { round: 2, results }));
  assert.equal(c2.bossMax, 20000);
  assert.equal(c2.bossHp, 20000 - 3200);
  const results3 = { ...results, "boss-2": { points: { a: 1600, b: 0 } } };
  const c3 = boss.content(3, ctx(42, { round: 3, results: results3 }));
  assert.equal(c3.bossHp, 20000 - 3200 - 1600);
  // A recorded bossMax from round 1 wins over a changed room size.
  const withMax = { "boss-1": { points: { a: 100 }, reveal: { bossMax: 48000 } } };
  const c2b = boss.content(2, ctx(42, { round: 2, results: withMax, players: players(2) }));
  assert.equal(c2b.bossMax, 48000);
  assert.equal(c2b.bossHp, 47900);
  // Never negative.
  const dead = boss.content(3, ctx(42, { round: 3, results: { "boss-1": { points: { a: 99999 } } } }));
  assert.equal(dead.bossHp, 0);
});

test("score: correct at t=0 is 2000, correct at the buzzer is 1200, wrong is 0", () => {
  const c = ctx(42);
  const q = questionFor(1, c);
  const wrong = (q.answer + 1) % 4;
  const answers = {
    fast: { a: q.answer, t: 0 },
    slow: { a: q.answer, t: ROUND_MS },
    mid: { a: q.answer, t: ROUND_MS / 2 },
    late: { a: q.answer, t: ROUND_MS + 5000 },
    nope: { a: wrong, t: 10 },
    str: { a: String(q.answer), t: 0 },
    junk: { a: "x", t: 0 }
  };
  const pts = boss.score(answers, 1, c);
  assert.equal(pts.fast, 2000);
  assert.equal(pts.slow, 1200);
  assert.equal(pts.mid, 1600);
  assert.equal(pts.late, 1200, "overtime (host extended) still earns the base");
  assert.equal(pts.nope, 0);
  assert.equal(pts.str, 2000, "a numeric string index still counts");
  assert.equal(pts.junk, 0);
  assert.equal(Object.keys(pts).length, 7);
  assert.deepEqual(boss.score({}, 1, c), {});
});

test("revealData: answer, fact, split, damage, HP before/after and the defeated flag", () => {
  const c = ctx(42, { players: players(3) }); // bossMax 12000
  const q = questionFor(1, c);
  const wrong = (q.answer + 1) % 4;
  const answers = { a: { a: q.answer, t: 500 }, b: { a: q.answer, t: 100 }, c: { a: wrong, t: 200 }, d: { a: q.answer, t: 900 }, e: { a: q.answer, t: 9000 } };
  const pts = boss.score(answers, 1, c);
  const r = boss.revealData(answers, 1, c, pts);
  assert.equal(r.answer, q.answer);
  assert.equal(r.fact, q.fact);
  assert.equal(r.split.reduce((s, n) => s + n, 0), 5);
  assert.equal(r.split[q.answer], 4);
  assert.equal(r.split[wrong], 1);
  assert.equal(r.correctCount, 4);
  assert.equal(r.answered, 5);
  assert.equal(r.damage, pts.a + pts.b + pts.d + pts.e);
  assert.equal(r.bossMax, 12000);
  assert.equal(r.bossHpBefore, 12000);
  assert.equal(r.bossHpAfter, Math.max(0, 12000 - r.damage));
  assert.deepEqual(r.best, ["b", "a", "d"], "fastest three correct");
  assert.equal(r.defeated, 12000 - r.damage <= 0);
  assert.equal(r.lastRound, false);

  // The last round with most of the HP already gone: this hit finishes the boss.
  const results = { "boss-1": { points: { a: 2000, b: 2000 } }, "boss-2": { points: { a: 2000, b: 2000 } }, "boss-3": { points: { a: 2000 } }, "boss-4": { points: { a: 800 } } };
  const c3 = ctx(42, { round: 5, roundId: "boss-5", players: players(3), results });
  const q3 = questionFor(5, c3);
  const a3 = { a: { a: q3.answer, t: 0 }, b: { a: (q3.answer + 2) % 4, t: 0 } };
  const p3 = boss.score(a3, 5, c3);
  const r3 = boss.revealData(a3, 5, c3, p3);
  assert.equal(r3.bossHpBefore, 1200);
  assert.equal(r3.damage, 2000);
  assert.equal(r3.bossHpAfter, 0);
  assert.equal(r3.defeated, true);
  assert.equal(r3.lastRound, true);
  assert.equal(r3.alreadyDown, false);

  // Not enough damage: still standing.
  const a3b = { b: { a: (q3.answer + 2) % 4, t: 0 } };
  const r3b = boss.revealData(a3b, 5, c3, boss.score(a3b, 5, c3));
  assert.equal(r3b.damage, 0);
  assert.equal(r3b.bossHpAfter, 1200);
  assert.equal(r3b.defeated, false);
  assert.deepEqual(r3b.best, []);
});

test("liveStat and botAnswer", () => {
  assert.deepEqual(boss.liveStat({ a: { a: 1 }, b: { a: 2 } }), { answered: 2 });
  const c = ctx(42);
  const q = questionFor(1, c);
  let seq = 0.1;
  const rng = () => { seq = (seq + 0.37) % 1; return seq; };
  let right = 0;
  for (let i = 0; i < 40; i++) {
    const b = boss.botAnswer(1, c, { id: "bot" }, rng);
    assert.ok(b.a >= 0 && b.a < 4 && Number.isInteger(b.a));
    assert.ok(b.delayMs >= 1500 && b.delayMs <= 8000);
    if (b.a === q.answer) right++;
  }
  assert.ok(right > 0 && right < 40, "bots are sometimes right, sometimes wrong");
});

test("howto text", () => {
  const h = boss.howto(1);
  assert.equal(h.text, "FINAL BOSS. TAP THE RIGHT ANSWER FAST. EVERY CORRECT ANSWER HITS THE BOSS. DOUBLE POINTS.");
  assert.equal(h.points, "UP TO 2000 PTS");
  assert.ok(boss.howto(2).title.includes("2/5"));
});
