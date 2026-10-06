// MOM OR DAD? (server side). Five cards a round, swiped left (MOM) or right
// (DAD): baby photos, childhood facts and predictions about the parents-to-be.
// 200 points per correct swipe, +100 for a clean sweep. Not Googleable.
import data from "../../public/data/momordad.js";
import { rngFor } from "../rng.js";

export const CARDS_PER_ROUND = 5;
export const CARD_MS = 6000;
export const ROUND_MS = CARDS_PER_ROUND * CARD_MS + 2000; // 32 s: 5 cards + slack
export const POINTS_PER_CARD = 200;
export const PERFECT_BONUS = 100;
export const MAX_POINTS = CARDS_PER_ROUND * POINTS_PER_CARD + PERFECT_BONUS; // 1100

const HOWTO_TEXT = "SWIPE LEFT FOR MOM, RIGHT FOR DAD. 6 SECONDS A CARD, 5 CARDS.";

const isSide = (v) => v === "mom" || v === "dad";
const otherSide = (v) => (v === "mom" ? "dad" : "mom");

// The playable rounds, computed from the data: the photo round only exists when
// the hosts have listed at least five photos; the two text rounds always play.
export function buildDecks(d) {
  const decks = [];
  const photos = Array.isArray(d.photoCards) ? d.photoCards.filter((c) => c && c.file) : [];
  if (photos.length >= CARDS_PER_ROUND) decks.push({ title: "WHO IS THIS BABY?", kind: "photo", cards: photos });
  decks.push({ title: "WHO WAS THIS BABY?", kind: "text", cards: (d.factCards || []).filter((c) => c && c.text) });
  decks.push({ title: "WHO WILL...?", kind: "text", cards: (d.futureCards || []).filter((c) => c && c.text) });
  return decks;
}

export const DECKS = buildDecks(data);

const deckFor = (round, decks = DECKS) => decks[round - 1] || decks[decks.length - 1];

// The five cards of a round WITH their answers (server only, never sent as is).
// The engine hands score() and revealData() one shared ctx (and botAnswer() one
// ctx for every bot), so ctx.rng may already be partly consumed; a private RNG
// seeded from ctx.seed + roundId gives every call the same five cards in the
// same order. Rounds with fewer than five answered cards are topped up from the
// blank ones with DEMO answers so rehearsals run before the hosts fill them in.
export function pickCards(round, ctx, decks = DECKS) {
  const deck = deckFor(round, decks);
  const roundId = (ctx && ctx.roundId) || "momordad-" + round;
  const rng = rngFor(ctx && ctx.seed != null ? ctx.seed : 0, roundId + ":cards");
  const all = deck.cards.map((c, i) => ({ i, kind: deck.kind, text: c.text, file: c.file, answer: String(c.answer || "").toLowerCase() }));
  const answered = all.filter((c) => isSide(c.answer));
  const blank = all.filter((c) => !isSide(c.answer));
  let cards = rng.shuffle(answered).slice(0, CARDS_PER_ROUND);
  let demo = false;
  if (cards.length < CARDS_PER_ROUND) {
    const fill = rng.shuffle(blank).slice(0, CARDS_PER_ROUND - cards.length).map((c) => ({ ...c, answer: rng() < 0.5 ? "mom" : "dad" }));
    if (fill.length) demo = true;
    cards = rng.shuffle(cards.concat(fill));
  }
  return { title: deck.title, kind: deck.kind, cards, demo };
}

const publicCard = (c) => (c.kind === "photo" ? { i: c.i, kind: "photo", file: c.file } : { i: c.i, kind: "text", text: c.text });

function picksOf(answer) {
  const a = answer && answer.a;
  const list = Array.isArray(a) ? a : a && Array.isArray(a.picks) ? a.picks : [];
  return list.slice(0, CARDS_PER_ROUND).map((p) => (isSide(p) ? p : null));
}

function correctCount(picks, cards) {
  let n = 0;
  cards.forEach((c, k) => { if (picks[k] === c.answer) n++; });
  return n;
}

export function pointsFor(correct) {
  return correct * POINTS_PER_CARD + (correct >= CARDS_PER_ROUND ? PERFECT_BONUS : 0);
}

export default {
  id: "momordad",
  title: "MOM OR DAD?",
  tagline: "SWIPE LEFT OR RIGHT",
  icon: "momordad",
  rounds: DECKS.length,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: true,
  progressive: false,
  maxPoints: () => MAX_POINTS,

  howto(round) {
    return { title: deckFor(round).title, text: HOWTO_TEXT, demo: "swipe", points: "UP TO " + MAX_POINTS + " PTS" };
  },

  // What every phone gets: the five cards (text or photo file), never the answers.
  content(round, ctx) {
    const picked = pickCards(round, ctx);
    return {
      title: picked.title,
      kind: picked.kind,
      cards: picked.cards.map(publicCard),
      parents: data.parents,
      count: CARDS_PER_ROUND,
      cardMs: CARD_MS,
      demoAnswers: picked.demo
    };
  },

  // answers: { playerId: { a: { picks: ["mom"|"dad"|null, ...] }, t, final } }
  score(answers, round, ctx) {
    const { cards } = pickCards(round, ctx);
    const out = {};
    for (const id in answers) out[id] = pointsFor(correctCount(picksOf(answers[id]), cards));
    return out;
  },

  revealData(answers, round, ctx, points) {
    const picked = pickCards(round, ctx);
    const ids = Object.keys(answers);
    const tally = picked.cards.map(() => ({ mom: 0, dad: 0 }));
    const rows = ids.map((id) => {
      const picks = picksOf(answers[id]);
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
      perfect: rows.filter((r) => r.correct >= CARDS_PER_ROUND).length,
      demoAnswers: picked.demo
    };
  },

  // answered = anyone who has swiped at least one card; locked = sent all five.
  liveStat(answers) {
    const ids = Object.keys(answers);
    return { answered: ids.length, locked: ids.filter((id) => answers[id].final).length };
  },

  // Bots get each card right 60% of the time and finish just before the cards run out.
  botAnswer(round, ctx, bot, rng) {
    const { cards } = pickCards(round, ctx);
    const picks = cards.map((c) => (rng() < 0.6 ? c.answer : otherSide(c.answer)));
    return { a: { picks }, delayMs: CARDS_PER_ROUND * CARD_MS - 400 - rng() * 2500 };
  }
};
