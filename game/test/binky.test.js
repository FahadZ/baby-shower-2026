import { test } from "node:test";
import assert from "node:assert/strict";
import binky from "../src/games/binky.js";
import { generateScene, hitTest } from "../public/games/binky-scene.js";
import data from "../public/data/binky.js";
import { rngFor } from "../src/rng.js";

const ctx = (seed = 42) => ({ seed, roundTime: binky.roundTime(), rng: rngFor(seed, "binky-1"), data, players: [{ id: "a", name: "Ann" }, { id: "b", name: "Bob" }, { id: "c", name: "Cy" }] });
const ans = (found, t, serverT = 20000) => ({ a: { found, t }, t: serverT, final: found.length === 5 });
const ALL = data.targets.map((t) => t.key);

test("scene: deterministic per seed and round, five spread-out targets in bounds", () => {
  for (const round of [1, 2, 3]) {
    const s1 = generateScene(42, round), s2 = generateScene(42, round);
    assert.deepEqual(s1, s2, "same seed + round gives the same scene");
    assert.equal(s1.w, 1000); assert.equal(s1.h, 1400);
    assert.equal(s1.targets.length, 5);
    assert.deepEqual(new Set(s1.targets.map((t) => t.key)), new Set(ALL));
    for (const t of s1.targets) {
      assert.ok(t.x > 0 && t.x < 1000 && t.y > 0 && t.y < 1400, "target in bounds");
      assert.ok(t.size >= data.sizeMin && t.size <= data.sizeMax, "target at distractor size");
    }
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = s1.targets[i], b = s1.targets[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 2 * data.hitRadius, "targets never share a tap radius");
    }
    const spec = data.rounds[round - 1];
    assert.ok(Math.abs(s1.glyphs.length - 5 - spec.density) <= spec.density * 0.1, "about the configured density");
    const idx = s1.glyphs.findIndex((g) => g.key);
    assert.ok(idx > 0 && idx + 5 < s1.glyphs.length, "some distractors are drawn after the targets");
    for (const g of s1.glyphs) assert.ok(typeof g.ch === "string" && isFinite(g.rot) && g.size > 0 && typeof g.color === "string");
  }
  assert.notDeepEqual(generateScene(42, 1).targets, generateScene(42, 2).targets, "rounds differ");
  assert.notDeepEqual(generateScene(42, 1).targets, generateScene(7, 1).targets, "seeds differ");
  assert.equal(generateScene(42, 3).mode, "night");
});

test("hitTest: nearest unfound target within the radius", () => {
  const s = generateScene(42, 1);
  const t = s.targets[0];
  assert.equal(hitTest(s, t.x + 30, t.y - 30, []).key, t.key);
  assert.equal(hitTest(s, t.x + 30, t.y - 30, [t.key]), null, "already found");
  assert.equal(hitTest(s, t.x + 200, t.y + 200, []), null, "too far");
});

test("content: carries the seed and names, never the positions", () => {
  const c = binky.content(1, ctx(42));
  assert.equal(c.seed, 42);
  assert.equal(c.mode, "normal");
  assert.equal(binky.content(3, ctx(42)).mode, "night");
  assert.deepEqual(c.targetKeys, ALL);
  assert.equal(c.targetNames.binky, "BINKY");
  assert.ok(!JSON.stringify(c).includes('"x"'), "no coordinates in content");
  assert.equal(binky.progressive, true);
  assert.equal(binky.autoEnd, false);
  assert.equal(binky.roundTime(1), 45000);
  assert.equal(binky.maxPoints(1), 1200);
});

test("score: 200 per find, 1200 for all five instantly, junk ignored, partials", () => {
  const c = ctx(42);
  const answers = {
    none: ans([], []),
    all0: ans(ALL, [0, 0, 0, 0, 0]),
    allHalf: ans(ALL, [1000, 2000, 3000, 4000, 22500]),
    allLate: ans(ALL, [1000, 2000, 3000, 4000, 99999]),
    junk: ans(["bottle", "nope", "bottle", 42, null, "sock"], [100, 200, 300, 400, 500, 600]),
    three: ans(["duck", "rattle", "binky"], [500, 600, 700]),
    noT: { a: { found: ALL }, t: 9000, final: true },
    garbage: { a: "lol", t: 1000, final: true }
  };
  const pts = binky.score(answers, 1, c);
  assert.equal(pts.none, 0);
  assert.equal(pts.all0, 1200);
  assert.equal(pts.allHalf, 1100);
  assert.equal(pts.allLate, 1000, "late finish still gets the five finds");
  assert.equal(pts.junk, 400, "junk and duplicates are ignored");
  assert.equal(pts.three, 600);
  assert.equal(pts.noT, 1000 + Math.round(200 * (1 - 9000 / 45000)), "falls back to the server timestamp");
  assert.equal(pts.garbage, 0);
  for (const id in pts) assert.ok(pts[id] >= 0 && pts[id] <= binky.maxPoints(1));
});

test("revealData and liveStat: targets, counts, fastest, bars", () => {
  const c = ctx(42);
  const answers = { a: ans(ALL, [1, 2, 3, 4, 12000]), b: ans(ALL, [1, 2, 3, 4, 8000]), c: ans(["sock", "duck"], [100, 200]) };
  const pts = binky.score(answers, 2, c);
  const r = binky.revealData(answers, 2, c, pts);
  assert.equal(r.seed, 42);
  assert.equal(r.mode, "normal");
  assert.equal(r.targets.length, 5);
  assert.deepEqual(r.targets.map((t) => ({ key: t.key, x: t.x, y: t.y })), generateScene(42, 2).targets.map((t) => ({ key: t.key, x: t.x, y: t.y })));
  assert.equal(r.targets[0].name.length > 0, true);
  assert.equal(r.counts.all5, 2);
  assert.equal(r.counts.found.sock, 3);
  assert.equal(r.counts.found.bottle, 2);
  assert.deepEqual(r.fastest, { id: "b", name: "Bob", t: 8000 });
  assert.deepEqual(r.best, ["b", "a", "c"]);
  const live = binky.liveStat(answers, 2, c);
  assert.equal(live.answered, 3);
  assert.equal(live.bars[0].id, "b");
  assert.equal(live.bars[0].value, 5);
  assert.equal(live.bars[0].name, "Bob");
  assert.equal(live.bars[2].value, 2);
  assert.equal(live.avg, 4);
  assert.equal(binky.revealData({}, 1, c, {}).fastest, null);
});

test("botAnswer: valid distinct keys, ascending times, lands with the last find", () => {
  const c = ctx(42);
  for (let i = 0; i < 40; i++) {
    const rng = rngFor(42, "binky-1:bots:" + i);
    const b = binky.botAnswer(1, c, { id: "bot" + i }, rng);
    assert.ok(Array.isArray(b.a.found) && b.a.found.length >= 2 && b.a.found.length <= 5);
    assert.equal(new Set(b.a.found).size, b.a.found.length, "distinct");
    b.a.found.forEach((k) => assert.ok(ALL.includes(k)));
    assert.equal(b.a.t.length, b.a.found.length);
    for (let j = 1; j < b.a.t.length; j++) assert.ok(b.a.t[j] >= b.a.t[j - 1]);
    assert.ok(b.delayMs > 0 && b.delayMs < c.roundTime);
    assert.equal(b.delayMs, b.a.t[b.a.t.length - 1]);
    const pts = binky.score({ x: { a: b.a, t: b.delayMs, final: true } }, 1, c).x;
    assert.equal(pts >= 200 * b.a.found.length, true);
  }
  assert.ok(binky.howto(3).text.includes("FLASHLIGHT"));
  assert.ok(!binky.howto(1).text.includes("FLASHLIGHT"));
});
