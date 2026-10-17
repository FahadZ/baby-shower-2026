import { test } from "node:test";
import assert from "node:assert/strict";
import game, { buildDecks, pickCards, pointsFor, CARDS_PER_ROUND, ROUND_MS, MAX_POINTS } from "../src/games/momordad.js";
import data from "../public/data/momordad.js";
import { rngFor } from "../src/rng.js";

// A ctx shaped like logic.roundCtx(): a fresh rng every time, like the engine.
function ctxFor(round, seed = 42) {
  const roundId = "momordad-" + round;
  return { roundId, round, seed, rng: rngFor(seed, roundId), data, roundTime: ROUND_MS, players: [], results: {}, order: [] };
}

const answerFor = (picks, t = 1000, final = true) => ({ a: { picks }, t, final });
const flip = (s) => (s === "mom" ? "dad" : "mom");

test("rounds are computed from the data: no photos -> 2 rounds, 5+ photos -> 3", () => {
  assert.equal(data.photoCards.length, 0, "ships without photos; the hosts add them");
  assert.equal(game.rounds, 2);
  assert.equal(buildDecks(data).map((d) => d.title).join("|"), "WHO WAS THIS BABY?|WHO WILL...?");
  const photos = Array.from({ length: 5 }, (_, k) => ({ file: (k % 2 ? "dad" : "mom") + "-" + k + ".jpg", answer: k % 2 ? "dad" : "mom" }));
  const decks = buildDecks({ ...data, photoCards: photos });
  assert.equal(decks.length, 3);
  assert.equal(decks[0].kind, "photo");
  assert.equal(decks[0].title, "WHO IS THIS BABY?");
  assert.equal(buildDecks({ ...data, photoCards: photos.slice(0, 4) }).length, 2, "four photos are not enough");
  assert.equal(game.roundTime(1), 32000);
  assert.equal(game.maxPoints(1), 1100);
  assert.equal(game.autoEnd, true);
  assert.equal(game.progressive, false);
});

test("content has 5 cards per round with text/file only, never the answers", () => {
  for (let round = 1; round <= game.rounds; round++) {
    const c = game.content(round, ctxFor(round));
    assert.equal(c.cards.length, CARDS_PER_ROUND);
    assert.ok(c.title && c.parents && c.parents.mom && c.parents.dad);
    assert.equal(c.cardMs, 6000);
    for (const card of c.cards) {
      assert.deepEqual(Object.keys(card).sort(), ["i", "kind", "text"]);
      assert.equal(card.kind, "text");
      assert.ok(card.text.length > 0);
    }
    assert.ok(!JSON.stringify(c).toLowerCase().includes('"answer"'), "no answer field anywhere in content");
    const cardsJson = JSON.stringify(c.cards).toLowerCase();
    assert.ok(!cardsJson.includes('"mom"') && !cardsJson.includes('"dad"'), "no mom/dad values on the cards");
    // Draft data has blank answers, so this is flagged as a demo round.
    assert.equal(c.demoAnswers, true);
  }
  const photos = Array.from({ length: 6 }, (_, k) => ({ file: "mom-" + k + ".jpg", answer: "mom" }));
  const decks = buildDecks({ ...data, photoCards: photos });
  const picked = pickCards(1, ctxFor(1), decks);
  assert.equal(picked.kind, "photo");
  assert.equal(picked.demo, false);
  assert.ok(picked.cards.every((c) => c.file && c.answer === "mom"));
});

test("scoring: 200 per correct pick, +100 for all five, nulls and junk score 0", () => {
  const round = 1;
  const { cards } = pickCards(round, ctxFor(round));
  const right = cards.map((c) => c.answer);
  const answers = {
    perfect: answerFor(right),
    three: answerFor(right.map((s, k) => (k < 3 ? s : flip(s)))),
    nulls: answerFor([null, null, null, null, null]),
    nothing: answerFor([]),
    wrong: answerFor(right.map(flip)),
    junk: { a: "mom", t: 10, final: true },
    bare: { a: right, t: 10, final: true },
    partial: { a: { picks: right.slice(0, 2) }, t: 10, final: false }
  };
  const pts = game.score(answers, round, ctxFor(round));
  assert.equal(pts.perfect, 1100);
  assert.equal(pts.three, 600);
  assert.equal(pts.nulls, 0);
  assert.equal(pts.nothing, 0);
  assert.equal(pts.wrong, 0);
  assert.equal(pts.junk, 0);
  assert.equal(pts.bare, 1100, "a bare array of picks is accepted too");
  assert.equal(pts.partial, 400);
  assert.equal(pointsFor(5), MAX_POINTS);
  assert.equal(pointsFor(4), 800);
  assert.equal(Object.keys(game.score({}, round, ctxFor(round))).length, 0);
});

test("demo-answer fallback is deterministic for a seed and differs across seeds", () => {
  const a = pickCards(2, ctxFor(2, 7));
  const b = pickCards(2, ctxFor(2, 7));
  assert.deepEqual(a, b);
  assert.equal(a.demo, true);
  assert.ok(a.cards.every((c) => c.answer === "mom" || c.answer === "dad"));
  // A ctx whose rng was already used (as score() and revealData() share one) still agrees.
  const used = ctxFor(2, 7);
  for (let k = 0; k < 17; k++) used.rng();
  assert.deepEqual(pickCards(2, used), a);
  assert.deepEqual(game.content(2, ctxFor(2, 7)), game.content(2, ctxFor(2, 7)));
  const other = pickCards(2, ctxFor(2, 8));
  assert.notDeepEqual(other.cards.map((c) => c.i + c.answer), a.cards.map((c) => c.i + c.answer));
  // Partly filled data: the answered cards are all used, the rest is demo-filled.
  const partial = { ...data, factCards: data.factCards.map((c, k) => (k < 3 ? { ...c, answer: "mom" } : c)) };
  const p = pickCards(1, ctxFor(1, 3), buildDecks(partial));
  assert.equal(p.demo, true);
  assert.equal(p.cards.length, 5);
  assert.equal(p.cards.filter((c) => c.i < 3).length, 3, "every answered card is in the round");
  const full = { ...data, factCards: data.factCards.map((c, k) => ({ ...c, answer: k % 2 ? "dad" : "mom" })) };
  const f = pickCards(1, ctxFor(1, 3), buildDecks(full));
  assert.equal(f.demo, false);
  assert.ok(f.cards.every((c) => c.answer === (c.i % 2 ? "dad" : "mom")), "real answers are kept");
  // The same five cards come out of content() and score() for the same seed.
  const content = game.content(1, ctxFor(1, 11));
  assert.deepEqual(content.cards.map((c) => c.i), pickCards(1, ctxFor(1, 11)).cards.map((c) => c.i));
});

test("revealData: answers, room split, best three, perfect count and demo flag", () => {
  const round = 2;
  const { cards } = pickCards(round, ctxFor(round));
  const right = cards.map((c) => c.answer);
  const answers = {
    a: answerFor(right, 500),
    b: answerFor(right, 900),
    c: answerFor(right.map((s, k) => (k === 0 ? flip(s) : s)), 700),
    d: answerFor([null, null, null, null, null], 100),
    e: answerFor(right.map(flip), 100)
  };
  const ctx = ctxFor(round);
  const points = game.score(answers, round, ctx);
  const r = game.revealData(answers, round, ctx, points);
  assert.equal(r.cards.length, 5);
  assert.deepEqual(r.cards.map((c) => c.answer), right);
  r.cards.forEach((c, k) => {
    assert.equal(c.momPct + c.dadPct, 100);
    assert.equal(c.text, cards[k].text);
    assert.equal(c.kind, "text");
  });
  // Card 0: a, b right; c, e wrong -> 50/50 whatever the answer is.
  assert.equal(r.cards[0].momPct, 50);
  // Card 1: a, b, c right; e wrong -> 75% for the right side.
  assert.equal(right[1] === "mom" ? r.cards[1].momPct : r.cards[1].dadPct, 75);
  assert.deepEqual(r.best, ["a", "b", "c"], "ties broken by speed");
  assert.equal(r.perfect, 2);
  assert.equal(r.demoAnswers, true);
  assert.ok(r.parents && r.parents.mom.name);
  assert.equal(r.title, "WHO WILL...?");
  const empty = game.revealData({}, round, ctxFor(round), {});
  assert.deepEqual(empty.best, []);
  assert.ok(empty.cards.every((c) => c.momPct === 0 && c.dadPct === 0));
});

test("liveStat, howto and botAnswer", () => {
  const round = 1;
  assert.deepEqual(game.liveStat({ x: answerFor([], 1, false), y: answerFor([], 1, true) }), { answered: 2, locked: 1 });
  const how = game.howto(round);
  assert.equal(how.title, "WHO WAS THIS BABY?");
  assert.match(how.text, /SWIPE LEFT FOR MOM, RIGHT FOR DAD/);
  const rng = rngFor(1, "bots");
  const seen = new Set();
  for (let k = 0; k < 20; k++) {
    const b = game.botAnswer(round, ctxFor(round), { id: "bot" + k }, rng);
    assert.equal(b.a.picks.length, 5);
    assert.ok(b.a.picks.every((p) => p === "mom" || p === "dad"));
    assert.ok(b.delayMs > 20000 && b.delayMs < 30000, "bots finish just before the cards run out");
    seen.add(game.score({ b: { a: b.a, t: 1 } }, round, ctxFor(round)).b);
  }
  assert.ok(seen.size > 1, "bots are not all identical");
});
