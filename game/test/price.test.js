import { test } from "node:test";
import assert from "node:assert/strict";
import price, { windowFor } from "../src/games/price.js";
import data from "../public/data/price.js";
import { rngFor } from "../src/rng.js";

const ctxFor = (round, seed = 11) => ({ roundId: "price-" + round, round, seed, rng: rngFor(seed, "price-" + round), data, roundTime: 15000, players: [], results: {}, order: ["price"] });

test("window: the answer lands somewhere between 15% and 85% of the bar, seeded per room", () => {
  for (let round = 1; round <= data.rounds.length; round++) {
    const spec = data.rounds[round - 1];
    const answer = spec.items.reduce((s, k) => s + data.items[k].price, 0);
    const spots = new Set();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = windowFor(round, ctxFor(round, seed));
      assert.equal(w.max - w.min, spec.max - spec.min, "same span as the data");
      assert.ok(w.min >= 0 && w.min % spec.step === 0, "snapped to the step, never negative");
      assert.ok(answer > w.min && answer < w.max, "answer inside the window");
      const f = (answer - w.min) / (w.max - w.min);
      assert.ok(f >= 0.14 && f <= 0.86, "answer at " + f.toFixed(2) + " of the bar");
      spots.add(Math.round(f * 20));
      assert.deepEqual(windowFor(round, ctxFor(round, seed)), w, "deterministic per seed");
    }
    assert.ok(spots.size >= 3, "different rooms get different spots: " + [...spots].join(","));
    const c = price.content(round, ctxFor(round, 3));
    const r = price.revealData({}, round, ctxFor(round, 3), {});
    assert.equal(c.min, r.min); assert.equal(c.max, r.max);
    assert.ok(!("answer" in c));
  }
});
