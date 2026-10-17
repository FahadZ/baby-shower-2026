import { test } from "node:test";
import assert from "node:assert/strict";
import game, { buildDecks, pickCards, pointsFor, cardCount, roundMs, maxPointsFor, MIN_CARDS, MAX_CARDS, CARD_MS } from "../src/games/momordad.js";
import data from "../public/data/momordad.js";
import { rngFor } from "../src/rng.js";

// A ctx shaped like logic.roundCtx(): a fresh rng every time, like the engine.
function ctxFor(round, seed = 42) {
  const roundId = "momordad-" + round;
  return { roundId, round, seed, rng: rngFor(seed, roundId), data, roundTime: roundMs(round), players: [], results: {}, order: [] };
}

const answerFor = (picks, t = 1000, final = true) => ({ a: { picks }, t, final });
const flip = (s) => (s === "mom" ? "dad" : "mom");
const card = (text, answer) => ({ text, answer });

test("the shipped data: every card answered, played in order, rounds of at most seven", () => {
  for (const c of data.factCards.concat(data.futureCards)) assert.ok(c.answer === "mom" || c.answer === "dad", c.text);
  assert.equal(data.photoCards.length, 0, "ships without photos; the hosts add them");
  const decks = buildDecks(data);
  assert.equal(game.rounds, decks.length);
  assert.ok(decks.every((d) => !d.demo && d.cards.length >= MIN_CARDS && d.cards.length <= MAX_CARDS));
  // Facts play first, in the file's order, then the predictions.
  const facts = decks.filter((d) => d.title.startsWith("WHO WAS THIS KID?"));
  assert.deepEqual(facts.flatMap((d) => d.cards.map((c) => c.text)), data.factCards.map((c) => c.text));
  assert.deepEqual(decks[decks.length - 1].cards.map((c) => c.text), data.futureCards.map((c) => c.text));
  assert.equal(game.warnings().length, 0);
});

test("lists split into near-equal rounds of at most seven; timer and points follow the card count", () => {
  const facts = (n) => Array.from({ length: n }, (_, k) => card("FACT " + k, k % 2 ? "dad" : "mom"));
  const sizes = (n) => buildDecks({ factCards: facts(n), futureCards: facts(6) }).map((d) => d.cards.length);
  assert.deepEqual(sizes(6), [6, 6]);
  assert.deepEqual(sizes(7), [7, 6]);
  assert.deepEqual(sizes(12), [6, 6, 6]);
  assert.deepEqual(sizes(13), [7, 6, 6]);
  assert.deepEqual(sizes(14), [7, 7, 6]);
  assert.deepEqual(sizes(15), [5, 5, 5, 6]);
  const decks = buildDecks({ factCards: facts(14), futureCards: facts(6) });
  assert.deepEqual(decks.map((d) => d.title), ["WHO WAS THIS KID? (1/2)", "WHO WAS THIS KID? (2/2)", "WHO WILL...?"]);
  assert.equal(cardCount(1, decks), 7);
  assert.equal(roundMs(1, decks), 7 * CARD_MS + 2000);
  assert.equal(roundMs(3, decks), 6 * CARD_MS + 2000);
  assert.equal(maxPointsFor(1, decks), 7 * 200 + 100);
  assert.equal(maxPointsFor(3, decks), 6 * 200 + 100);
  for (let r = 1; r <= game.rounds; r++) {
    assert.equal(game.roundTime(r), cardCount(r) * CARD_MS + 2000);
    assert.equal(game.maxPoints(r), cardCount(r) * 200 + 100);
    assert.match(game.howto(r).text, new RegExp(cardCount(r) + " CARDS"));
  }
  assert.equal(game.autoEnd, true);
  assert.equal(game.progressive, false);
});

test("photos: a round of their own once five are listed", () => {
  const photos = Array.from({ length: 5 }, (_, k) => ({ file: "p" + k + ".jpg", answer: k % 2 ? "dad" : "mom" }));
  const decks = buildDecks({ ...data, photoCards: photos });
  assert.equal(decks.length, buildDecks(data).length + 1);
  assert.equal(decks[0].kind, "photo");
  assert.equal(decks[0].title, "WHO IS THIS BABY?");
  assert.equal(buildDecks({ ...data, photoCards: photos.slice(0, 4) }).length, buildDecks(data).length, "four photos are not enough");
  const picked = pickCards(1, ctxFor(1), decks);
  assert.equal(picked.demo, false);
  assert.ok(picked.cards.every((c) => c.file));
});

test("content: the round's cards with text only, never the answers", () => {
  for (let round = 1; round <= game.rounds; round++) {
    const c = game.content(round, ctxFor(round));
    assert.equal(c.cards.length, cardCount(round));
    assert.equal(c.count, cardCount(round));
    assert.ok(c.title && c.parents && c.parents.mom && c.parents.dad);
    assert.equal(c.cardMs, CARD_MS);
    assert.equal(c.demoAnswers, false);
    for (const k of c.cards) assert.deepEqual(Object.keys(k).sort(), ["i", "kind", "text"]);
    assert.ok(!JSON.stringify(c).toLowerCase().includes('"answer"'), "no answer field anywhere in content");
    const cardsJson = JSON.stringify(c.cards).toLowerCase();
    assert.ok(!cardsJson.includes('"mom"') && !cardsJson.includes('"dad"'), "no mom/dad values on the cards");
    // The same cards in the same order whatever the seed.
    assert.deepEqual(c.cards, game.content(round, ctxFor(round, 99)).cards);
  }
});

test("scoring: 200 per correct pick, +100 for all of them, nulls and junk score 0", () => {
  const round = 1;
  const { cards } = pickCards(round, ctxFor(round));
  const n = cards.length;
  const right = cards.map((c) => c.answer);
  const answers = {
    perfect: answerFor(right),
    three: answerFor(right.map((s, k) => (k < 3 ? s : flip(s)))),
    nulls: answerFor(right.map(() => null)),
    nothing: answerFor([]),
    wrong: answerFor(right.map(flip)),
    junk: { a: "mom", t: 10, final: true },
    bare: { a: right, t: 10, final: true },
    partial: { a: { picks: right.slice(0, 2) }, t: 10, final: false },
    extra: answerFor(right.concat(["mom", "dad"]))
  };
  const pts = game.score(answers, round, ctxFor(round));
  assert.equal(pts.perfect, n * 200 + 100);
  assert.equal(pts.three, 600);
  assert.equal(pts.nulls, 0);
  assert.equal(pts.nothing, 0);
  assert.equal(pts.wrong, 0);
  assert.equal(pts.junk, 0);
  assert.equal(pts.bare, n * 200 + 100, "a bare array of picks is accepted too");
  assert.equal(pts.partial, 400);
  assert.equal(pts.extra, n * 200 + 100, "picks past the last card are ignored");
  assert.equal(pointsFor(n, n), game.maxPoints(round));
  assert.equal(pointsFor(n - 1, n), (n - 1) * 200);
  assert.equal(Object.keys(game.score({}, round, ctxFor(round))).length, 0);
});

test("demo fallback: fewer than five answered cards plays five with seeded random answers", () => {
  const blank = { ...data, factCards: data.factCards.map((c, k) => ({ ...c, answer: k < 3 ? "mom" : "" })) };
  const decks = buildDecks(blank);
  assert.equal(decks[0].demo, true);
  assert.equal(decks[0].cards.length, MIN_CARDS);
  const a = pickCards(1, ctxFor(1, 7), decks);
  assert.deepEqual(a, pickCards(1, ctxFor(1, 7), decks));
  assert.equal(a.demo, true);
  assert.ok(a.cards.every((c) => c.answer === "mom" || c.answer === "dad"));
  assert.equal(a.cards.filter((c) => c.i < 3 && c.answer === "mom").length, 3, "the answered cards keep their answers");
  // A ctx whose rng was already used (as score() and revealData() share one) still agrees.
  const used = ctxFor(1, 7);
  for (let k = 0; k < 17; k++) used.rng();
  assert.deepEqual(pickCards(1, used, decks), a);
  const seeds = new Set(Array.from({ length: 12 }, (_, s) => pickCards(1, ctxFor(1, s), decks).cards.map((c) => c.answer).join("")));
  assert.ok(seeds.size > 1, "different seeds give different demo answers");
});

test("revealData: answers, room split, best three, perfect count", () => {
  const round = game.rounds;
  const { cards } = pickCards(round, ctxFor(round));
  const right = cards.map((c) => c.answer);
  const answers = {
    a: answerFor(right, 500),
    b: answerFor(right, 900),
    c: answerFor(right.map((s, k) => (k === 0 ? flip(s) : s)), 700),
    d: answerFor(right.map(() => null), 100),
    e: answerFor(right.map(flip), 100)
  };
  const ctx = ctxFor(round);
  const points = game.score(answers, round, ctx);
  const r = game.revealData(answers, round, ctx, points);
  assert.equal(r.cards.length, cards.length);
  assert.deepEqual(r.cards.map((c) => c.answer), right);
  r.cards.forEach((c, k) => {
    assert.equal(c.momPct + c.dadPct, 100);
    assert.equal(c.text, cards[k].text);
  });
  assert.equal(r.cards[0].momPct, 50);
  assert.equal(right[1] === "mom" ? r.cards[1].momPct : r.cards[1].dadPct, 75);
  assert.deepEqual(r.best, ["a", "b", "c"], "ties broken by speed");
  assert.equal(r.perfect, 2);
  assert.equal(r.demoAnswers, false);
  assert.equal(r.title, "WHO WILL...?");
  const empty = game.revealData({}, round, ctxFor(round), {});
  assert.deepEqual(empty.best, []);
  assert.ok(empty.cards.every((c) => c.momPct === 0 && c.dadPct === 0));
});

test("liveStat, howto and botAnswer", () => {
  const round = 1;
  assert.deepEqual(game.liveStat({ x: answerFor([], 1, false), y: answerFor([], 1, true) }), { answered: 2, locked: 1 });
  assert.match(game.howto(round).title, /^WHO WAS THIS KID\?/);
  assert.match(game.howto(round).text, /SWIPE LEFT FOR MOM, RIGHT FOR DAD/);
  const n = cardCount(round);
  const rng = rngFor(1, "bots");
  const seen = new Set();
  for (let k = 0; k < 20; k++) {
    const b = game.botAnswer(round, ctxFor(round), { id: "bot" + k }, rng);
    assert.equal(b.a.picks.length, n);
    assert.ok(b.a.picks.every((p) => p === "mom" || p === "dad"));
    assert.ok(b.delayMs > (n - 1) * CARD_MS && b.delayMs < n * CARD_MS, "bots finish just before the cards run out");
    seen.add(game.score({ b: { a: b.a, t: 1 } }, round, ctxFor(round)).b);
  }
  assert.ok(seen.size > 1, "bots are not all identical");
});
