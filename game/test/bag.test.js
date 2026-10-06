import { test } from "node:test";
import assert from "node:assert/strict";
import bag, { roundMask, roundItems, evaluate, rawScore } from "../src/games/bag.js";
import data from "../public/data/bag.js";
import { rotate, cells, dims, parseMask, canPlace, fillStats, validPlacement, expandItems, firstFit, greedyPack } from "../public/games/bag-shared.js";
import { rngFor } from "../src/rng.js";

const L = ["#.", "#.", "##"];
const T = ["###", ".#."];

test("rotate: quarter turns clockwise, four turns is the identity", () => {
  assert.deepEqual(rotate(["#", "#", "#"], 1), ["###"]);
  assert.deepEqual(rotate(["###"], 1), ["#", "#", "#"]);
  assert.deepEqual(rotate(L, 1), ["###", "#.."]);
  assert.deepEqual(rotate(L, 2), ["##", ".#", ".#"]);
  assert.deepEqual(rotate(L, 3), ["..#", "###"]);
  assert.deepEqual(rotate(L, 4), L);
  assert.deepEqual(rotate(L, -1), rotate(L, 3));
  assert.deepEqual(rotate(T, 2), [".#.", "###"]);
  assert.deepEqual(rotate(T, 1), [".#", "##", ".#"]);
  assert.deepEqual(cells(T), [[0, 0], [1, 0], [2, 0], [1, 1]]);
  assert.deepEqual(dims(rotate(["####", "####"], 1)), { w: 2, h: 4 });
  for (const key in data.items) {
    const s = data.items[key].shape;
    assert.deepEqual(rotate(s, 4), s, key + " rotates back to itself");
    assert.equal(cells(rotate(s, 1)).length, cells(s).length, key + " keeps its cell count");
  }
});

test("canPlace: inside the mask, not over the cut corner, not overlapping", () => {
  const mask = data.masks.everyday;
  const m = parseMask(mask);
  assert.equal(m.w, 8);
  assert.equal(m.h, 10);
  assert.equal(m.count, 78);
  const items = expandItems(data, ["diapers", "wipes", "bottle"]);
  assert.equal(canPlace(mask, [], items.diapers, 0, 1, 0), true);
  assert.equal(canPlace(mask, [], items.diapers, 0, 0, 0), false, "top-left corner is cut");
  assert.equal(canPlace(mask, [], items.wipes, 6, 0, 0), false, "top-right corner is cut");
  assert.equal(canPlace(mask, [], items.wipes, 1, 0, 0), true);
  assert.equal(canPlace(mask, [], items.diapers, 6, 5, 0), false, "sticks out on the right");
  assert.equal(canPlace(mask, [], items.bottle, 0, 8, 0), false, "sticks out at the bottom");
  assert.equal(canPlace(mask, [], items.bottle, 0, 7, 0), true);
  assert.equal(canPlace(mask, [], items.bottle, 5, 9, 1), true, "rotated bottle lies along the bottom");
  const placed = [{ key: "diapers", x: 0, y: 1, rot: 0 }];
  assert.equal(canPlace(mask, placed, items.wipes, 2, 2, 0, items), false, "overlaps the diapers");
  assert.equal(canPlace(mask, placed, items.wipes, 3, 1, 0, items), true);
  assert.equal(canPlace(mask, placed, items.wipes, 2, 2, 0, items, "diapers"), true, "skipping itself while moving");
  assert.equal(canPlace(mask, [], items.wipes, 1.5, 0, 0), false, "non-integer coordinates");
});

test("fillStats and validPlacement: counts, essentials, overlap dropped", () => {
  const mask = data.masks.everyday;
  const items = roundItems(1);
  const empty = fillStats(mask, [], items);
  assert.equal(empty.cellsUsed, 0);
  assert.equal(empty.cellsTotal, 78);
  assert.equal(empty.missingEssentials, 4);
  assert.equal(empty.valid, true);
  const good = [
    { key: "diapers", x: 0, y: 1, rot: 0 },
    { key: "wipes", x: 3, y: 1, rot: 0 },
    { key: "bottle", x: 5, y: 1, rot: 0 },
    { key: "pacifier", x: 7, y: 1, rot: 0 },
    { key: "blanket", x: 0, y: 4, rot: 0 }
  ];
  const st = fillStats(mask, good, items);
  assert.equal(st.cellsUsed, 9 + 4 + 3 + 1 + 8);
  assert.equal(st.value, 9 + 4 + 4 + 2 + 8);
  assert.equal(st.missingEssentials, 0);
  assert.equal(st.essentialsTotal, 4);
  assert.equal(st.fillPct, Math.round(100 * 25 / 78));
  assert.equal(st.valid, true);
  const bad = good.concat([{ key: "book", x: 0, y: 4, rot: 0 }]);   // on top of the blanket
  const st2 = fillStats(mask, bad, items);
  assert.equal(st2.valid, false);
  assert.equal(st2.cellsUsed, st.cellsUsed, "the overlapping item is dropped");
  assert.deepEqual(validPlacement(mask, bad, items).map((p) => p.key), good.map((p) => p.key));
  // Order matters: the first of two overlapping items wins.
  const swapped = [{ key: "book", x: 0, y: 4, rot: 0 }].concat(good);
  assert.deepEqual(validPlacement(mask, swapped, items).map((p) => p.key), ["book", "diapers", "wipes", "bottle", "pacifier"]);
  // Garbage is ignored.
  assert.deepEqual(validPlacement(mask, [null, { key: "nope", x: 0, y: 0 }, { key: "wipes", x: "1", y: "1", rot: 7 }], items), [{ key: "wipes", x: 1, y: 1, rot: 3 }]);
  assert.equal(fillStats(mask, "not a list", items).cellsUsed, 0);
});

test("twins round: instance ids map to base items, essentials counted per instance", () => {
  const items = roundItems(3);
  assert.equal(items["diapers#2"].base, "diapers");
  assert.equal(items["diapers#2"].essential, true);
  const st = fillStats(roundMask(3), [{ key: "diapers", x: 0, y: 1, rot: 0 }, { key: "diapers#2", x: 3, y: 1, rot: 0 }], items);
  assert.equal(st.essentialsTotal, 8);
  assert.equal(st.essentialsPlaced, 2);
  assert.equal(st.missingEssentials, 6);
  assert.equal(bag.roundTime(3), 30000);
  assert.equal(bag.roundTime(1), 45000);
  assert.equal(bag.roundTime(2), 45000);
});

test("rounds: round 2 offers more item cells than bag cells; round 1 fits", () => {
  const spec2 = data.rounds[1];
  const items2 = roundItems(2);
  const cellsOffered = spec2.items.reduce((s, id) => s + cells(items2[id].shape).length, 0);
  assert.ok(cellsOffered > parseMask(roundMask(2)).count, "day trip: choices matter");
  assert.equal(spec2.items.length, 18);
  const spec1 = data.rounds[0];
  const items1 = roundItems(1);
  assert.equal(spec1.items.length, 12);
  assert.ok(spec1.items.reduce((s, id) => s + cells(items1[id].shape).length, 0) < parseMask(roundMask(1)).count);
  for (const r of [1, 2, 3]) {
    const its = roundItems(r);
    for (const e of data.essentials) assert.ok(Object.values(its).some((it) => it.base === e), "round " + r + " offers " + e);
  }
  const c = bag.content(1);
  assert.equal(c.items.length, 12);
  assert.equal(c.essentialsTotal, 4);
  assert.deepEqual(c.mask, data.masks.everyday);
  assert.equal(bag.howto(1).text.includes("DRAG"), true);
});

test("score: empty is 0, overlap dropped, essentials penalised, best gets 1000", () => {
  assert.deepEqual(bag.score({}, 1), {});
  assert.deepEqual(bag.score({ a: { a: { placed: [] }, t: 1 }, b: { a: null, t: 1 } }, 1), { a: 0, b: 0 });
  const full = [
    { key: "diapers", x: 0, y: 1, rot: 0 },
    { key: "wipes", x: 3, y: 1, rot: 0 },
    { key: "bottle", x: 5, y: 1, rot: 0 },
    { key: "pacifier", x: 7, y: 1, rot: 0 },
    { key: "blanket", x: 0, y: 4, rot: 0 }
  ];
  const noBinky = full.filter((p) => p.key !== "pacifier");   // everything but the binky
  const sameCellsNoBinky = noBinky.concat([{ key: "socks", x: 7, y: 1, rot: 0 }]);
  const cheat = full.concat([{ key: "book", x: 0, y: 4, rot: 0 }, { key: "teddy", x: 0, y: 4, rot: 0 }]);
  const answers = {
    best: { a: { placed: full }, t: 1 },
    missing: { a: { placed: noBinky }, t: 1 },
    cheat: { a: { placed: cheat }, t: 1 },
    nothing: { a: { placed: [] }, t: 1 }
  };
  const pts = bag.score(answers, 1);
  assert.equal(pts.best, 1000);
  assert.equal(pts.cheat, 1000, "overlapping extras are dropped, nothing gained");
  assert.equal(pts.nothing, 0);
  assert.ok(pts.missing < pts.best);
  const evBest = evaluate(answers.best.a, 1), evMissing = evaluate(answers.missing.a, 1);
  assert.equal(evBest.raw, 25 + 27);
  assert.equal(evMissing.raw, (24 + 25) - data.essentialPenalty);
  assert.equal(pts.missing, Math.round(1000 * evMissing.raw / evBest.raw));
  assert.equal(evaluate({ placed: cheat }, 1).placed.length, full.length);
  // The penalty bites even with identical coverage, but never below zero.
  assert.ok(rawScore(fillStats(roundMask(1), sameCellsNoBinky, roundItems(1))) < rawScore(fillStats(roundMask(1), full, roundItems(1))));
  assert.equal(rawScore({ cellsUsed: 1, value: 1, missingEssentials: 4 }), 0);
  // The answer may also be the bare list.
  assert.equal(bag.score({ x: { a: full, t: 1 } }, 1).x, 1000);
});

test("revealData and liveStat describe the room", () => {
  const full = [{ key: "diapers", x: 0, y: 1, rot: 0 }, { key: "wipes", x: 3, y: 1, rot: 0 }, { key: "bottle", x: 5, y: 1, rot: 0 }, { key: "pacifier", x: 7, y: 1, rot: 0 }];
  const answers = { p1: { a: { placed: full }, t: 5 }, p2: { a: { placed: full.slice(0, 2) }, t: 6 }, p3: { a: { placed: [] }, t: 7 } };
  const ctx = { players: [{ id: "p1", name: "Ann" }, { id: "p2", name: "Bob" }, { id: "p3", name: "Cy" }], roundTime: 45000 };
  const pts = bag.score(answers, 1, ctx);
  const r = bag.revealData(answers, 1, ctx, pts);
  assert.equal(r.winner.id, "p1");
  assert.equal(r.winner.placed.length, 4);
  assert.equal(r.winner.stats.missingEssentials, 0);
  assert.equal(r.top.length, 3);
  assert.equal(r.top[0].id, "p1");
  assert.equal(r.top[0].fillPct, Math.round(100 * 17 / 78));
  assert.equal(r.perfectEssentials, 1);
  assert.equal(r.avgFill, Math.round((Math.round(1700 / 78) + Math.round(1300 / 78) + 0) / 3));
  assert.deepEqual(r.mask, data.masks.everyday);
  assert.ok(r.items.diapers && r.items.diapers.shape && typeof r.items.diapers.value === "number");
  const live = bag.liveStat(answers, 1, ctx);
  assert.equal(live.answered, 3);
  assert.equal(live.bars[0].name, "Ann");
  assert.equal(live.bars[0].value, Math.round(100 * 17 / 78));
  assert.equal(live.bars.length, 3);
  const none = bag.revealData({}, 1, ctx, {});
  assert.equal(none.winner, null);
  assert.deepEqual(none.top, []);
});

test("bots: every greedy placement is valid, lands inside the round, and is spread over time", () => {
  for (const round of [1, 2, 3]) {
    const mask = roundMask(round), items = roundItems(round);
    const ctx = { roundTime: bag.roundTime(round), players: [] };
    const rng = rngFor(42, "bag-" + round + ":bots");
    let packedCells = 0;
    for (let i = 0; i < 40; i++) {
      const res = bag.botAnswer(round, ctx, { id: "bot" + i }, rng);
      const st = fillStats(mask, res.a.placed, items);
      assert.equal(st.valid, true, "round " + round + " bot " + i + " valid");
      assert.ok(res.a.placed.length >= 1);
      assert.ok(res.delayMs >= 3000 && res.delayMs <= ctx.roundTime, "delay inside the round");
      assert.ok(res.a.placed.every((p) => items[p.key]), "only this round's items");
      packedCells += st.cellsUsed;
    }
    assert.ok(packedCells / 40 > 15, "bots pack something substantial on average");
  }
  // Deterministic for a seed.
  const a = bag.botAnswer(2, { roundTime: 45000 }, { id: "b" }, rngFor(7, "x"));
  const b = bag.botAnswer(2, { roundTime: 45000 }, { id: "b" }, rngFor(7, "x"));
  assert.deepEqual(a, b);
  // greedyPack with the full list fills a good chunk of the everyday bag.
  const gp = greedyPack(roundMask(1), data.rounds[0].items, roundItems(1), rngFor(1, "gp"), { fraction: 1 });
  assert.ok(fillStats(roundMask(1), gp, roundItems(1)).fillPct >= 40);
  assert.deepEqual(firstFit(roundMask(1), [], roundItems(1).diapers, 0, roundItems(1)), { x: 1, y: 0 }, "reading order skips the cut corner");
});
