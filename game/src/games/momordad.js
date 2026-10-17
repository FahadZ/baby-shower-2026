// MOM OR DAD? (server side). Swipe each card left (MOM) or right (DAD): baby
// photos, childhood facts and predictions about the parents-to-be. The cards play
// in the order the hosts listed them, up to 7 a round, 6 seconds a card.
// 200 points per correct swipe, +100 for a clean sweep. Not Googleable.
import data from "../../public/data/momordad.js";
import { rngFor } from "../rng.js";

export const MIN_CARDS = 5;       // fewer answered cards than this: a demo round
export const MAX_CARDS = 7;       // a longer list is split into several rounds
export const CARD_MS = 6000;
export const SLACK_MS = 2000;
export const POINTS_PER_CARD = 200;
export const PERFECT_BONUS = 100;

const isSide = (v) => v === "mom" || v === "dad";
const otherSide = (v) => (v === "mom" ? "dad" : "mom");
const norm = (c, i, kind) => ({ i, kind, text: c.text, file: c.file, answer: String(c.answer || "").toLowerCase() });

// Split n cards into the fewest rounds of at most MAX_CARDS, sizes as even as
// possible, bigger rounds first (13 -> 7 + 6, 12 -> 6 + 6).
function chunk(list) {
  const parts = Math.max(1, Math.ceil(list.length / MAX_CARDS));
  const out = [];
  let at = 0;
  for (let k = 0; k < parts; k++) {
    const size = Math.floor(list.length / parts) + (k < list.length % parts ? 1 : 0);
    out.push(list.slice(at, at + size));
    at += size;
  }
  return out;
}

// The playable rounds, computed from the data. A list with at least MIN_CARDS
// answered cards plays all of them, in order, split into rounds of up to
// MAX_CARDS; a list with fewer plays MIN_CARDS cards with random DEMO answers
// (decided per round from the seed) so rehearsals run before the answers are in.
// The photo round only exists once the hosts have listed at least MIN_CARDS photos.
export function buildDecks(d) {
  const decks = [];
  const add = (title, kind, raw) => {
    const all = raw.map((c, i) => norm(c, i, kind));
    const answered = all.filter((c) => isSide(c.answer));
    if (answered.length >= MIN_CARDS) {
      const parts = chunk(answered);
      parts.forEach((cards, k) => decks.push({ title: parts.length > 1 ? title + " (" + (k + 1) + "/" + parts.length + ")" : title, kind, cards, demo: false }));
    } else {
      decks.push({ title, kind, cards: answered.concat(all.filter((c) => !isSide(c.answer))).slice(0, MIN_CARDS), demo: true });
    }
  };
  const photos = Array.isArray(d.photoCards) ? d.photoCards.filter((c) => c && c.file) : [];
  if (photos.length >= MIN_CARDS) add("WHO IS THIS BABY?", "photo", photos);
  add("WHO WAS THIS KID?", "text", (d.factCards || []).filter((c) => c && c.text));
  add("WHO WILL...?", "text", (d.futureCards || []).filter((c) => c && c.text));
  return decks;
}

export const DECKS = buildDecks(data);

const deckFor = (round, decks = DECKS) => decks[round - 1] || decks[decks.length - 1];
export const cardCount = (round, decks = DECKS) => deckFor(round, decks).cards.length;
export const roundMs = (round, decks = DECKS) => cardCount(round, decks) * CARD_MS + SLACK_MS;
export const maxPointsFor = (round, decks = DECKS) => cardCount(round, decks) * POINTS_PER_CARD + PERFECT_BONUS;

// A round's cards WITH their answers (server only, never sent as is), in the
// hosts' order. Only a demo round uses randomness: a private RNG seeded from
// ctx.seed + roundId, so content(), score() and revealData() always agree.
export function pickCards(round, ctx, decks = DECKS) {
  const deck = deckFor(round, decks);
  if (!deck.demo) return { title: deck.title, kind: deck.kind, cards: deck.cards.map((c) => ({ ...c })), demo: false };
  const roundId = (ctx && ctx.roundId) || "momordad-" + round;
  const rng = rngFor(ctx && ctx.seed != null ? ctx.seed : 0, roundId + ":cards");
  const cards = deck.cards.map((c) => (isSide(c.answer) ? { ...c } : { ...c, answer: rng() < 0.5 ? "mom" : "dad" }));
  return { title: deck.title, kind: deck.kind, cards, demo: true };
}

const publicCard = (c) => (c.kind === "photo" ? { i: c.i, kind: "photo", file: c.file } : { i: c.i, kind: "text", text: c.text });

function picksOf(answer, n) {
  const a = answer && answer.a;
  const list = Array.isArray(a) ? a : a && Array.isArray(a.picks) ? a.picks : [];
  return list.slice(0, n).map((p) => (isSide(p) ? p : null));
}

function correctCount(picks, cards) {
  let n = 0;
  cards.forEach((c, k) => { if (picks[k] === c.answer) n++; });
  return n;
}

export function pointsFor(correct, total) {
  return correct * POINTS_PER_CARD + (total > 0 && correct >= total ? PERFECT_BONUS : 0);
}

export default {
  id: "momordad",
  title: "MOM OR DAD?",
  tagline: "SWIPE LEFT OR RIGHT",
  icon: "momordad",
  rounds: DECKS.length,
  data,
  roundTime: (round) => roundMs(round),
  autoEnd: true,
  progressive: false,
  maxPoints: (round) => maxPointsFor(round),

  // Host-only reminder while a round is playing random DEMO answers.
  warnings() {
    return DECKS.filter((d) => d.demo).map((d) => "MOM OR DAD \"" + d.title + "\": FEWER THAN " + MIN_CARDS + " CARDS HAVE AN ANSWER, SO THE ROUND USES RANDOM ANSWERS.");
  },

  howto(round) {
    const n = cardCount(round);
    return { title: deckFor(round).title, text: "SWIPE LEFT FOR MOM, RIGHT FOR DAD. " + CARD_MS / 1000 + " SECONDS A CARD, " + n + " CARDS.", demo: "swipe", points: "UP TO " + maxPointsFor(round) + " PTS" };
  },

  // What every phone gets: the round's cards (text or photo file), never the answers.
  content(round, ctx) {
    const picked = pickCards(round, ctx);
    return {
      title: picked.title,
      kind: picked.kind,
      cards: picked.cards.map(publicCard),
      parents: data.parents,
      count: picked.cards.length,
      cardMs: CARD_MS,
      demoAnswers: picked.demo
    };
  },

  // answers: { playerId: { a: { picks: ["mom"|"dad"|null, ...] }, t, final } }
  score(answers, round, ctx) {
    const { cards } = pickCards(round, ctx);
    const out = {};
    for (const id in answers) out[id] = pointsFor(correctCount(picksOf(answers[id], cards.length), cards), cards.length);
    return out;
  },

  revealData(answers, round, ctx, points) {
    const picked = pickCards(round, ctx);
    const ids = Object.keys(answers);
    const tally = picked.cards.map(() => ({ mom: 0, dad: 0 }));
    const rows = ids.map((id) => {
      const picks = picksOf(answers[id], picked.cards.length);
      picks.forEach((p, k) => { if (p && tally[k]) tally[k][p]++; });
      return { id, correct: correctCount(picks, picked.cards), pts: (points && points[id]) || 0, t: answers[id].t || 0 };
    });
    rows.sort((a, b) => b.pts - a.pts || a.t - b.t);
    return {
      title: picked.title,
      kind: picked.kind,
      parents: data.parents,
      cards: picked.cards.map((c, k) => {
        const n = tally[k].mom + tally[k].dad;
        const momPct = n ? Math.round((100 * tally[k].mom) / n) : 0;
        return { ...publicCard(c), answer: c.answer, momPct, dadPct: n ? 100 - momPct : 0 };
      }),
      best: rows.filter((r) => r.pts > 0).slice(0, 3).map((r) => r.id),
      perfect: rows.filter((r) => r.correct >= picked.cards.length).length,
      demoAnswers: picked.demo
    };
  },

  // answered = anyone who has swiped at least one card; locked = swiped them all.
  liveStat(answers) {
    const ids = Object.keys(answers);
    return { answered: ids.length, locked: ids.filter((id) => answers[id].final).length };
  },

  // Bots get each card right 60% of the time and finish just before the cards run out.
  botAnswer(round, ctx, bot, rng) {
    const { cards } = pickCards(round, ctx);
    const picks = cards.map((c) => (rng() < 0.6 ? c.answer : otherSide(c.answer)));
    return { a: { picks }, delayMs: cards.length * CARD_MS - 400 - rng() * 2500 };
  }
};
