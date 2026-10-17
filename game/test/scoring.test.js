import { test } from "node:test";
import assert from "node:assert/strict";
import { closeness, speedPoints, relative, orderingPoints, rankBy } from "../src/scoring.js";

test("closeness: exact answer gets max plus bonus, far guesses get 0", () => {
  assert.equal(closeness(100, 100), 1150);
  assert.equal(closeness(105, 100), Math.round(1000 * 0.95 * 0.95) + 150);
  assert.equal(closeness(250, 100), 0);
  assert.equal(closeness(0, 100), 0);
  assert.equal(closeness(NaN, 100), 0);
  assert.equal(closeness("x", 100), 0);
});

test("speedPoints: base for correct, more for faster", () => {
  assert.equal(speedPoints(false, 1000, 1000), 0);
  assert.equal(speedPoints(true, 0, 10000), 600);
  assert.equal(speedPoints(true, 10000, 10000), 1000);
  assert.equal(speedPoints(true, 5000, 10000, { scale: 2 }), 1600);
});

test("relative: best gets 1000, others pro rata, all-zero gives zeros", () => {
  assert.deepEqual(relative({ a: 10, b: 5, c: 0 }), { a: 1000, b: 500, c: 0 });
  assert.deepEqual(relative({ a: 0, b: 0 }), { a: 0, b: 0 });
});

test("orderingPoints: perfect order, reversed order, partial", () => {
  const correct = ["a", "b", "c", "d", "e"];
  assert.equal(orderingPoints(correct, correct), 1200);
  assert.equal(orderingPoints(["e", "d", "c", "b", "a"], correct), 0);
  assert.equal(orderingPoints(["b", "a", "c", "d", "e"], correct), 900);
  assert.equal(orderingPoints(["a", "b"], correct), 0);
  assert.equal(orderingPoints(["a", "b", "c", "d", "x"], correct), 0);
});

test("rankBy: ties share a rank", () => {
  const { ranks, sorted } = rankBy({ a: 10, b: 20, c: 20, d: 0 });
  assert.deepEqual(ranks, { b: 1, c: 1, a: 3, d: 4 });
  assert.equal(sorted[0] === "b" || sorted[0] === "c", true);
});
