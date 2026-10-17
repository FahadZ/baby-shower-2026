// DIAPER DASH spawn schedule. Built from content.seed with the shared seeded
// RNG so every phone (and the server, for the score cap) gets the identical
// sequence of falling items. Pure: no DOM, no I/O.
import { rngFor } from "../engine/rng.js";
import data from "../data/dash.js";

export function roundSpec(round) {
  return data.rounds[Math.max(0, Math.min(data.rounds.length, round | 0) - 1)] || data.rounds[0];
}

// content: { seed, round, twins?, duration? }. Returns items sorted by time:
// { id, t (ms), lane, x (0..1 of the lane), kind, speed (canvas heights/s), phase, wobble }
export function buildSchedule(content) {
  const round = (content && content.round) || 1;
  // content.spec (the practice round) overrides the round's rate, speed and shares.
  const spec = content && content.spec ? { ...roundSpec(round), ...content.spec } : roundSpec(round);
  const twins = content && content.twins != null ? !!content.twins : !!spec.twins;
  const duration = (content && content.duration) || data.duration;
  const rng = rngFor(content && content.seed != null ? content.seed : 0, "dash-" + round + ":schedule");
  const lanes = twins ? 2 : 1;
  const lastSpawn = duration - 1500;   // the last item still has time to fall
  const items = [];
  let id = 0;
  for (let lane = 0; lane < lanes; lane++) {
    let t = 500 + rng() * 400;
    let prevX = -1, prevT = -1e9;
    while (t < lastSpawn) {
      const r = rng();
      const vomitShare = spec.vomitShare || 0;
      const kind = r < spec.badShare ? "bad" : r < spec.badShare + vomitShare ? "vomit" : r < spec.badShare + vomitShare + spec.goldShare ? "gold" : "good";
      let x = 0.12 + rng() * 0.76;
      // Keep items that spawn close together apart horizontally.
      if (t - prevT < 700 && Math.abs(x - prevX) < 0.2) x = x < 0.5 ? x + 0.3 : x - 0.3;
      // Every item has its own speed: a wide random factor keeps the stream unpredictable.
      const spread = spec.speedSpread != null ? spec.speedSpread : 0.2;
      const speed = data.baseSpeed * spec.speed * (1 - spread / 2 + rng() * spread);
      items.push({ id: id++, t: Math.round(t), lane, x: +x.toFixed(3), kind, speed: +speed.toFixed(4), phase: +(rng() * 6.283).toFixed(3), wobble: +(0.015 + rng() * 0.02).toFixed(4) });
      prevX = x; prevT = t;
      t += (1000 / spec.rate) * (0.55 + rng() * 0.9);
      t = Math.max(t, prevT + 220);
    }
    // A gold round always shows at least two gold bottles per lane.
    if (spec.goldShare > 0) {
      const mine = items.filter((it) => it.lane === lane);
      let gold = mine.filter((it) => it.kind === "gold").length;
      for (let k = 1; gold < 2 && k <= 2; k++) {
        const target = duration * k / 3;
        const pick = mine.filter((it) => it.kind === "good").sort((a, b) => Math.abs(a.t - target) - Math.abs(b.t - target))[0];
        if (pick) { pick.kind = "gold"; gold++; }
      }
    }
  }
  items.sort((a, b) => a.t - b.t || a.lane - b.lane);
  items.forEach((it, i) => { it.id = i; });
  return items;
}

// Counts and the theoretical best raw score for a schedule.
export function scheduleLimits(items) {
  let good = 0, gold = 0, bad = 0, vomit = 0;
  for (const it of items) { if (it.kind === "good") good++; else if (it.kind === "gold") gold++; else if (it.kind === "vomit") vomit++; else bad++; }
  return { good, gold, bad, vomit, max: good * data.points.good + gold * data.points.gold };
}
