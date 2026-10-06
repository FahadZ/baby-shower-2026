// WHERE'S THE BINKY? scene generator, shared by the server (scoring, reveal)
// and every phone (drawing). Pure and deterministic: the same seed and round
// give the same scene everywhere, so the server never sends target positions.
import { hashSeed, mulberry32 } from "../engine/rng.js";
import data from "../data/binky.js";

const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function roundSpec(round) {
  return data.rounds[Math.min(Math.max(1, round | 0), data.rounds.length) - 1];
}

// Five target spots, spread out so no two are within data.targetGap of each other
// (the tap radius is far smaller, so a tap is never ambiguous).
function placeTargets(rng, W, H) {
  const margin = 110;
  for (let attempt = 0; attempt < 400; attempt++) {
    const pts = [];
    let ok = true;
    for (let i = 0; i < data.targets.length && ok; i++) {
      const x = margin + rng() * (W - margin * 2);
      const y = margin + rng() * (H - margin * 2);
      if (pts.some((p) => dist(p.x, p.y, x, y) < data.targetGap)) ok = false;
      else pts.push({ x: Math.round(x), y: Math.round(y) });
    }
    if (ok) return pts;
  }
  // Practically unreachable; a fixed grid keeps the game playable regardless.
  return data.targets.map((_, i) => ({ x: 200 + (i % 2) * 600, y: 200 + i * 250 }));
}

function glyph(rng, x, y, ch, size, color) {
  return { x: Math.round(x), y: Math.round(y), ch, size: Math.round(size), rot: Math.round((rng() * 2 - 1) * 100) / 100, color };
}

function distractorGlyph(rng, W, H, sizeLo, sizeHi) {
  const useShape = rng() < 0.12 && data.shapes.length > 0;
  const ch = useShape ? rng.pick(data.shapes) : rng.pick(data.distractors);
  const color = useShape ? rng.pick(data.shapeColors) : "#1d1b18";
  const size = useShape ? sizeLo * 0.7 + rng() * (sizeHi - sizeLo) * 0.5 : sizeLo + rng() * (sizeHi - sizeLo);
  return glyph(rng, 10 + rng() * (W - 20), 10 + rng() * (H - 20), ch, size, color);
}

export function generateScene(seed, round) {
  const spec = roundSpec(round);
  const rng = mulberry32(hashSeed(String(seed) + ":" + round));
  const W = data.w, H = data.h;
  const spots = placeTargets(rng, W, H);
  const order = rng.shuffle(data.targets);
  const targets = order.map((t, i) => ({ key: t.key, x: spots[i].x, y: spots[i].y, size: Math.round(data.targetSizeMin + rng() * (data.targetSizeMax - data.targetSizeMin)) }));
  const targetGlyphs = targets.map((t) => {
    const def = data.targets.find((d) => d.key === t.key);
    return { x: t.x, y: t.y, ch: def.ch, size: t.size, rot: Math.round((rng() * 0.7 - 0.35) * 100) / 100, color: "#1d1b18", key: t.key };
  });

  const n = spec.density;
  const nAfter = Math.round(n * spec.after);
  const before = [];
  for (let i = 0; i < n - nAfter; i++) before.push(distractorGlyph(rng, W, H, data.sizeMin, data.sizeMax));

  // Glyphs drawn on top of the targets: a few deliberate overlappers that clip an
  // edge of each target, then random ones that keep clear of the target centres.
  const after = [];
  const coverCount = targets.map(() => 0);
  targets.forEach((t, i) => {
    for (let k = 0; k < spec.overlappers; k++) {
      const a = rng() * TAU, d = t.size * 0.62 + rng() * t.size * 0.25;
      const size = data.sizeMin + rng() * 14;
      after.push(glyph(rng, Math.min(W - 10, Math.max(10, t.x + Math.cos(a) * d)), Math.min(H - 10, Math.max(10, t.y + Math.sin(a) * d)), rng.pick(data.distractors), size, "#1d1b18"));
      coverCount[i]++;
    }
  });
  let guard = 0;
  while (after.length < nAfter + spec.overlappers * targets.length && guard++ < n * 20) {
    const g = distractorGlyph(rng, W, H, data.sizeMin, data.sizeMax);
    let ok = true;
    for (let i = 0; i < targets.length && ok; i++) {
      const d = dist(g.x, g.y, targets[i].x, targets[i].y);
      const near = targets[i].size * 0.9, around = targets[i].size * 1.5;
      if (d < near) ok = false;
      else if (d < around && coverCount[i] >= spec.cover) ok = false;
    }
    if (!ok) continue;
    targets.forEach((t, i) => { if (dist(g.x, g.y, t.x, t.y) < t.size * 1.5) coverCount[i]++; });
    after.push(g);
  }

  return { w: W, h: H, mode: spec.mode, glyphs: before.concat(targetGlyphs, after), targets };
}

// Nearest unfound target within the tap radius, or null.
export function hitTest(scene, x, y, foundKeys, radius = data.hitRadius) {
  let best = null, bd = Infinity;
  for (const t of scene.targets) {
    if (foundKeys && foundKeys.includes(t.key)) continue;
    const d = dist(x, y, t.x, t.y);
    if (d <= radius && d < bd) { bd = d; best = t; }
  }
  return best;
}

export const targetName = (key) => {
  const t = data.targets.find((d) => d.key === key);
  return t ? t.name : String(key).toUpperCase();
};
export const targetChar = (key) => {
  const t = data.targets.find((d) => d.key === key);
  return t ? t.ch : "?";
};
