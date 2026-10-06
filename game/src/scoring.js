// Pure scoring helpers shared by every game. Every round is worth up to
// MAX points so games stay comparable on the leaderboard.
export const MAX = 1000;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Slider / number guesses: 1000 at the exact answer, falling off quadratically
// with relative error, +bonus when inside ±bonusWithin.
export function closeness(guess, answer, opts = {}) {
  const { max = MAX, bonusWithin = 0.10, bonus = 150 } = opts;
  if (typeof guess !== "number" || !isFinite(guess) || !(answer > 0)) return 0;
  const err = Math.abs(guess - answer) / answer;
  let pts = max * Math.pow(clamp(1 - err, 0, 1), 2);
  if (err <= bonusWithin) pts += bonus;
  return Math.round(pts);
}

// Correct/incorrect with a speed bonus: base for being right, up to bonus for speed.
export function speedPoints(correct, timeLeftMs, roundMs, opts = {}) {
  const { base = 600, bonus = 400, scale = 1 } = opts;
  if (!correct) return 0;
  const frac = roundMs > 0 ? clamp(timeLeftMs / roundMs, 0, 1) : 0;
  return Math.round((base + bonus * frac) * scale);
}

// Arcade-style rounds: the best raw score gets max, everyone else pro rata.
export function relative(rawById, max = MAX) {
  const out = {};
  let best = 0;
  for (const id in rawById) best = Math.max(best, rawById[id] || 0);
  for (const id in rawById) out[id] = best > 0 ? Math.round(max * clamp((rawById[id] || 0) / best, 0, 1)) : 0;
  return out;
}

// Ordering rounds: fraction of concordant pairs, +perfectBonus when exact.
export function orderingPoints(order, correct, opts = {}) {
  const { max = MAX, perfectBonus = 200 } = opts;
  if (!Array.isArray(order) || order.length !== correct.length) return 0;
  const pos = {};
  correct.forEach((k, i) => { pos[k] = i; });
  if (order.some((k) => pos[k] === undefined)) return 0;
  let good = 0, total = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      total++;
      if (pos[order[i]] < pos[order[j]]) good++;
    }
  }
  const perfect = good === total;
  return Math.round(max * (total ? good / total : 0)) + (perfect ? perfectBonus : 0);
}

// Competition ranking: ties share a rank (1, 1, 3). Returns {id: rank}.
export function rankBy(valueById, ids) {
  const list = (ids || Object.keys(valueById)).slice();
  list.sort((a, b) => (valueById[b] || 0) - (valueById[a] || 0));
  const ranks = {};
  let prevVal = null, prevRank = 0;
  list.forEach((id, i) => {
    const v = valueById[id] || 0;
    if (v !== prevVal) { prevRank = i + 1; prevVal = v; }
    ranks[id] = prevRank;
  });
  return { ranks, sorted: list };
}
