import { test } from "node:test";
import assert from "node:assert/strict";
import game, { roundSpec, validAnswer } from "../src/games/order.js";
import data from "../public/data/order.js";
import { rngFor } from "../src/rng.js";

const ctxFor = (round, seed = 7) => ({ roundId: "order-" + round, round, seed, rng: rngFor(seed, "order-" + round), data, roundTime: 30000, players: [], results: {}, order: ["order"] });
const same = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

test("data: every round has 5 unique items, correct lists exactly those keys, hints present", () => {
  assert.equal(game.rounds, 3);
  data.rounds.forEach((r) => {
    assert.equal(r.items.length, 5, r.title);
    const keys = r.items.map((it) => it.key);
    assert.equal(new Set(keys).size, 5);
    assert.deepEqual(r.correct.slice().sort(), keys.slice().sort());
    r.items.forEach((it) => { assert.ok(it.label && it.emoji && it.hint, it.key); });
    assert.ok(r.title && r.prompt && r.topLabel && r.bottomLabel);
  });
  assert.equal(game.roundTime(1), 30000);
  assert.equal(game.maxPoints(1), 1200);
  assert.equal(game.autoEnd, true);
  assert.equal(game.progressive, false);
});

test("content: never contains the answer, never in the correct order, same on every phone", () => {
  for (let round = 1; round <= 3; round++) {
    const spec = roundSpec(round);
    for (let seed = 1; seed <= 200; seed++) {
      const c = game.content(round, ctxFor(round, seed));
      assert.equal(c.correct, undefined);
      assert.equal(JSON.stringify(c).includes("hint"), false, "no hints during play");
      assert.equal(c.items.length, 5);
      const keys = c.items.map((it) => it.key);
      assert.deepEqual(keys.slice().sort(), spec.correct.slice().sort());
      assert.equal(same(keys, spec.correct), false, "seed " + seed + " round " + round + " was shuffled into the correct order");
      c.items.forEach((it) => { assert.ok(it.label && it.emoji); assert.equal(it.hint, undefined); });
      assert.equal(c.title, spec.title);
      assert.equal(c.topLabel, spec.topLabel);
      assert.equal(c.bottomLabel, spec.bottomLabel);
    }
    const a = game.content(round, ctxFor(round, 99)), b = game.content(round, ctxFor(round, 99));
    assert.deepEqual(a, b, "deterministic for a seed");
  }
});

test("score: perfect 1200, reversed 0, one adjacent swap 900, junk 0", () => {
  const correct = roundSpec(1).correct;
  const swapped = correct.slice(); [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  const answers = {
    perfect: { a: correct.slice(), t: 1000 },
    reversed: { a: correct.slice().reverse(), t: 2000 },
    swap: { a: swapped, t: 3000 },
    short: { a: correct.slice(0, 4), t: 100 },
    long: { a: correct.concat("lay"), t: 100 },
    dupes: { a: ["lay", "lay", "lay", "lay", "lay"], t: 100 },
    junk: { a: ["x", "y", "z", "w", "v"], t: 100 },
    str: { a: "lay,open,wipe,slide,tabs", t: 100 },
    num: { a: 5, t: 100 },
    nil: { a: null, t: 100 },
    obj: { a: { a: correct }, t: 100 },
    nums: { a: [0, 1, 2, 3, 4], t: 100 }
  };
  const pts = game.score(answers, 1, ctxFor(1));
  assert.equal(pts.perfect, 1200);
  assert.equal(pts.reversed, 0);
  assert.equal(pts.swap, 900);
  for (const k of ["short", "long", "dupes", "junk", "str", "num", "nil", "obj", "nums"]) assert.equal(pts[k], 0, k);
  assert.deepEqual(game.score({}, 2, ctxFor(2)), {});
  assert.equal(validAnswer(correct, roundSpec(1)), true);
});

test("revealData: correct order, hints, perfect count, best three, per-position tallies", () => {
  const ctx = ctxFor(2, 5);
  const correct = roundSpec(2).correct;
  const swapped = correct.slice(); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const answers = {
    a: { a: correct.slice(), t: 4000 },
    b: { a: correct.slice(), t: 2000 },
    c: { a: swapped, t: 1000 },
    d: { a: correct.slice().reverse(), t: 1000 },
    e: { a: "junk", t: 1000 }
  };
  const pts = game.score(answers, 2, ctx);
  const r = game.revealData(answers, 2, ctx, pts);
  assert.deepEqual(r.correct, correct);
  assert.equal(r.items.length, 5);
  r.items.forEach((it) => assert.ok(it.hint));
  assert.equal(r.perfect, 2);
  assert.equal(r.answered, 4, "only valid answers count");
  assert.deepEqual(r.best, ["b", "a", "c"], "by points then speed");
  assert.equal(r.positions[correct[0]].right, 2);
  assert.equal(r.positions[correct[1]].right, 2);
  assert.equal(r.positions[correct[2]].right, 4, "the middle survives a reversal");
  assert.equal(r.positions[correct[4]].right, 3);
  assert.deepEqual(r.shuffled, game.content(2, ctxFor(2, 5)).items.map((it) => it.key), "reveal reproduces the phones' shuffle");
  const empty = game.revealData({}, 1, ctxFor(1), {});
  assert.equal(empty.perfect, 0);
  assert.deepEqual(empty.best, []);
  assert.equal(game.liveStat(answers).answered, 5);
});

test("bots: always a valid order, mostly close to correct, delays inside the round", () => {
  for (let round = 1; round <= 3; round++) {
    const spec = roundSpec(round);
    const rng = rngFor(123, "order-" + round + ":bots");
    let perfect = 0;
    for (let i = 0; i < 100; i++) {
      const { a, delayMs } = game.botAnswer(round, ctxFor(round), { id: "bot" + i }, rng);
      assert.ok(validAnswer(a, spec));
      assert.ok(delayMs >= 5000 && delayMs <= 25000);
      if (same(a, spec.correct)) perfect++;
    }
    assert.ok(perfect > 5 && perfect < 60, "some bots are perfect, most are not: " + perfect);
  }
});

test("howto text and points", () => {
  const hw = game.howto(1);
  assert.equal(hw.text, "DRAG THE TILES INTO ORDER, FIRST AT THE TOP. LOCK IN WHEN YOU'RE HAPPY.");
  assert.equal(hw.points, "UP TO 1200 PTS");
  assert.equal(hw.title, roundSpec(1).title);
});

test("practice: five numbers, shuffled, with the correct order attached", () => {
  const c = game.practice(ctxFor(1));
  assert.match(c.title, /PRACTICE/);
  assert.equal(c.items.length, 5);
  assert.deepEqual(c.correct, ["one", "two", "three", "four", "five"]);
  assert.ok(!same(c.items.map((it) => it.key), c.correct), "never handed out already in order");
  assert.ok(validAnswer(c.items.map((it) => it.key), { correct: c.correct }));
});
