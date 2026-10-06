// PRICE IS RIGHT: BABY EDITION (server side). Guess the Canadian price of real
// baby items with a slider. Reference implementation of the game contract.
import data from "../../public/data/price.js";
import { closeness } from "../scoring.js";

const ROUND_MS = 15000;

function roundSpec(round) {
  return data.rounds[round - 1];
}

export function roundAnswer(round) {
  const spec = roundSpec(round);
  return spec.items.reduce((sum, key) => sum + data.items[key].price, 0);
}

export default {
  id: "price",
  title: "PRICE IS RIGHT",
  tagline: "BABY EDITION",
  icon: "price",
  rounds: data.rounds.length,
  data,
  roundTime: () => ROUND_MS,
  autoEnd: true,
  progressive: false,
  maxPoints: () => 1150,

  howto(round) {
    const spec = roundSpec(round);
    return {
      title: spec.title,
      text: spec.items.length > 1
        ? "GUESS THE TOTAL PRICE OF THE BUNDLE. SLIDE, THEN LOCK IN. CLOSEST WINS."
        : "GUESS THE REAL CANADIAN PRICE. SLIDE, THEN LOCK IN. CLOSEST WINS.",
      demo: "slider",
      points: "UP TO 1150 PTS"
    };
  },

  // What every phone gets during the round. Never includes the answer.
  content(round) {
    const spec = roundSpec(round);
    return {
      title: spec.title,
      subtitle: spec.subtitle || "",
      items: spec.items.map((key) => {
        const it = data.items[key];
        return { key, name: it.name, detail: it.detail || "", image: it.image || "", emoji: it.emoji || "" };
      }),
      min: spec.min, max: spec.max, step: spec.step,
      currency: "CAD"
    };
  },

  // answers: { playerId: { a: <number guess>, t } }
  score(answers, round) {
    const answer = roundAnswer(round);
    const out = {};
    for (const id in answers) {
      const g = Number(answers[id].a);
      out[id] = closeness(g, answer, { max: 1000, bonusWithin: 0.1, bonus: 150 });
    }
    return out;
  },

  revealData(answers, round, ctx, points) {
    const spec = roundSpec(round);
    const answer = roundAnswer(round);
    const guesses = Object.keys(answers).map((id) => ({ id, g: Number(answers[id].a), pts: points[id] || 0 }))
      .filter((x) => isFinite(x.g)).sort((a, b) => Math.abs(a.g - answer) - Math.abs(b.g - answer));
    const best = guesses.slice(0, 3).map((x) => x.id);
    return {
      answer,
      min: spec.min, max: spec.max,
      items: spec.items.map((key) => ({ key, name: data.items[key].name, price: data.items[key].price, retailer: data.items[key].retailer || "", checked: data.items[key].checked || "" })),
      guesses: guesses.map((x) => ({ id: x.id, g: x.g })),
      best,
      extra: spec.extra || null,
      diaperNote: spec.diaperNote && data.items.diapers ? Math.round(answer / data.items.diapers.perDiaper) : null
    };
  },

  liveStat(answers) {
    return { answered: Object.keys(answers).length };
  },

  botAnswer(round, ctx, bot, rng) {
    const spec = roundSpec(round);
    const answer = roundAnswer(round);
    // Bots are mostly in the ballpark, a few are wild.
    const wild = rng() < 0.2;
    const spread = wild ? 1.2 : 0.35;
    let g = answer * (1 + (rng() - 0.5) * 2 * spread);
    g = Math.max(spec.min, Math.min(spec.max, Math.round(g / spec.step) * spec.step));
    return { a: g, delayMs: 2500 + rng() * (ROUND_MS - 4000) };
  }
};
