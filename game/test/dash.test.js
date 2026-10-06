import { test } from "node:test";
import assert from "node:assert/strict";
import dash from "../src/games/dash.js";
import data from "../public/data/dash.js";
import { buildSchedule, scheduleLimits } from "../public/games/dash-schedule.js";
import { rngFor } from "../src/rng.js";

const ctxFor = (round, seed = 4242, players = []) => ({ roundId: "dash-" + round, round, seed, rng: rngFor(seed, "dash-" + round), data, roundTime: dash.roundTime(round), players, results: {}, order: ["dash"] });

test("schedule: deterministic per seed, sane items, twins use both lanes", () => {
  const a = buildSchedule({ seed: 4242, round: 1 });
  const b = buildSchedule({ seed: 4242, round: 1 });
  assert.deepEqual(a, b, "same seed, same schedule");
  assert.notDeepEqual(a, buildSchedule({ seed: 4243, round: 1 }), "a different seed changes it");
  assert.ok(a.length >= 15 && a.length <= 40, "round 1 spawns a reasonable number: " + a.length);
  for (let i = 0; i < a.length; i++) {
    const it = a[i];
    assert.ok(it.t >= 0 && it.t < data.duration);
    assert.equal(it.lane, 0);
    assert.ok(it.x > 0 && it.x < 1);
    assert.ok(["good", "gold", "bad"].includes(it.kind));
    assert.ok(it.speed > 0);
    if (i) assert.ok(a[i].t >= a[i - 1].t, "sorted by time");
  }
  assert.ok(!a.some((it) => it.kind === "gold"), "no gold in round 1");
  assert.ok(buildSchedule({ seed: 4242, round: 2 }).some((it) => it.kind === "gold"), "gold appears in round 2");
  const t = buildSchedule({ seed: 4242, round: 3, twins: true });
  assert.ok(t.some((it) => it.lane === 0) && t.some((it) => it.lane === 1), "twins fill both lanes");
  assert.ok(t.length > a.length, "round 3 is busier than round 1");
  const lim = scheduleLimits(a);
  assert.equal(lim.good + lim.gold + lim.bad, a.length);
  assert.equal(lim.max, lim.good + 3 * lim.gold);
});

test("content: public, seeded, no schedule inside", () => {
  const c = dash.content(3, ctxFor(3));
  assert.equal(c.round, 3);
  assert.equal(c.seed, 4242);
  assert.equal(c.twins, true);
  assert.equal(c.duration, 20000);
  assert.ok(!("items" in c) && !("schedule" in c));
  assert.equal(dash.content(1, ctxFor(1)).twins, false);
  assert.match(dash.howto(1).text, /DON'T TAP THE DIAPERS/);
  assert.match(dash.howto(2).text, /GOLD BOTTLES/);
  assert.match(dash.howto(3).text, /TWO LANES/);
  assert.equal(dash.progressive, true);
  assert.equal(dash.autoEnd, false);
});

test("score: relative to the best, capped at the schedule's max, junk is 0", () => {
  const ctx = ctxFor(2);
  const lim = scheduleLimits(buildSchedule(dash.content(2, ctx)));
  assert.ok(lim.good >= 10 && lim.gold >= 2, "round 2 offers enough to catch: " + JSON.stringify(lim));
  const aceScore = 10 + 3 * 2;
  const answers = {
    ace: { a: { caught: 10, gold: 2, bad: 0, score: aceScore }, t: 19000, final: true },
    half: { a: { caught: 5, gold: 1, bad: 0, score: 8 }, t: 19000, final: true },
    oops: { a: { caught: 3, gold: 0, bad: 5, score: -2 }, t: 19000, final: true },
    cheat: { a: { caught: 999, gold: 999, bad: 0, score: 99999 }, t: 100, final: true },
    liar: { a: { caught: 2, gold: 0, bad: 0, score: 500 }, t: 100, final: true },
    junk: { a: "lol", t: 100, final: true },
    nan: { a: { caught: NaN, gold: "x", bad: null, score: Infinity }, t: 100, final: true },
    empty: { a: null, t: 100, final: true }
  };
  const pts = dash.score(answers, 2, ctx);
  assert.equal(pts.cheat, 1000, "a cheat is capped at the schedule's max and takes the top");
  assert.equal(pts.ace, Math.round(1000 * aceScore / lim.max));
  assert.equal(pts.half, Math.round(1000 * 8 / lim.max));
  assert.equal(pts.oops, 0);
  assert.equal(pts.liar, Math.round(1000 * 2 / lim.max), "score is cross-checked against the counts");
  assert.equal(pts.junk, 0);
  assert.equal(pts.nan, 0);
  assert.equal(pts.empty, 0);
  // Without the cheater the best gets 1000.
  delete answers.cheat;
  const p2 = dash.score(answers, 2, ctx);
  assert.equal(p2.ace, 1000);
  assert.equal(p2.half, 500);
  // All zero -> zeros.
  const z = dash.score({ a: { a: { caught: 0, gold: 0, bad: 2, score: -2 } }, b: { a: { caught: 0, gold: 0, bad: 0, score: 0 } } }, 1, ctxFor(1));
  assert.deepEqual(z, { a: 0, b: 0 });
  assert.deepEqual(dash.score({}, 1, ctxFor(1)), {});
});

test("revealData and liveStat: top lists, totals, names", () => {
  const players = [{ id: "p1", name: "Ann" }, { id: "p2", name: "Bob" }, { id: "p3", name: "Cy" }];
  const ctx = ctxFor(1, 4242, players);
  const answers = {
    p1: { a: { caught: 5, gold: 0, bad: 1, score: 4 }, t: 1000, final: false },
    p2: { a: { caught: 9, gold: 0, bad: 0, score: 9 }, t: 1000, final: false },
    p3: { a: { caught: 1, gold: 0, bad: 0, score: 1 }, t: 1000, final: false }
  };
  const pts = dash.score(answers, 1, ctx);
  const r = dash.revealData(answers, 1, ctx, pts);
  assert.equal(r.top.length, 3);
  assert.equal(r.top[0].id, "p2");
  assert.deepEqual(r.top[1], { id: "p1", raw: 4, caught: 5, gold: 0, bad: 1 });
  assert.equal(r.totalCaught, 15);
  assert.equal(r.best, 9);
  assert.ok(r.max > 0);
  const live = dash.liveStat(answers, 1, ctx);
  assert.equal(live.answered, 3);
  assert.deepEqual(live.bars[0], { id: "p2", name: "Bob", value: 9 });
  assert.equal(live.bars.length, 3);
  // Top lists are capped.
  const many = {};
  for (let i = 0; i < 30; i++) many["q" + i] = { a: { caught: i, gold: 0, bad: 0, score: i }, t: 1 };
  assert.equal(dash.revealData(many, 1, ctx, {}).top.length, 5);
  assert.equal(dash.liveStat(many, 1, ctx).bars.length, 10);
});

test("botAnswer: numeric, within the schedule, lands late in the round", () => {
  for (const round of [1, 2, 3]) {
    const ctx = ctxFor(round);
    const lim = scheduleLimits(buildSchedule(dash.content(round, ctx)));
    const rng = rngFor(4242, "dash-" + round + ":bots");
    for (let i = 0; i < 25; i++) {
      const b = dash.botAnswer(round, ctx, { id: "bot" + i }, rng);
      for (const k of ["caught", "gold", "bad", "score"]) assert.ok(Number.isFinite(b.a[k]), k + " is numeric");
      assert.ok(b.a.caught <= lim.good && b.a.gold <= lim.gold && b.a.bad <= lim.bad);
      assert.equal(b.a.score, b.a.caught + 3 * b.a.gold - b.a.bad);
      assert.ok(b.delayMs >= 15000 && b.delayMs < dash.roundTime(round));
    }
    if (round === 1) assert.equal(lim.gold, 0);
  }
});

test("sprites: every pixel map is 11x11 and uses palette colours", () => {
  for (const kind of ["good", "gold", "bad"]) {
    const rows = data.sprites[kind];
    assert.equal(rows.length, 11, kind + " has 11 rows");
    rows.forEach((row) => {
      assert.equal(row.length, 11, kind + " row is 11 wide: " + row);
      for (const ch of row) assert.ok(ch === "." || data.palette[ch], kind + " unknown colour " + ch);
    });
  }
});

test("practice: one slow lane, no gold, fewer items than round 1", () => {
  const c = dash.practice(ctxFor(1));
  assert.match(c.title, /PRACTICE/);
  assert.equal(c.twins, false);
  const items = buildSchedule(c);
  assert.ok(items.length > 5);
  assert.ok(items.every((it) => it.kind !== "gold" && it.lane === 0));
  assert.ok(items.length < buildSchedule({ round: 1, seed: c.seed }).length);
});
