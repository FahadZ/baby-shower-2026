// Celebration moves for podium winners. Thunderbolt, Cross Slash, Spin Attack
// and the Kirby puff use the real frames from the invite site; every other
// character gets a jump with a sparkle burst. All take a .av element.
import { h, wait, reduceMotion } from "./dom.js";
import { sfx } from "./audio.js";
import { bubble } from "./avatars.js";

const SVGNS = "http://www.w3.org/2000/svg";
const seq = (dir, name, n) => Array.from({ length: n }, (_, i) => dir + name + "-" + String(i + 1).padStart(2, "0") + ".png");
const CLOUD_ATK = seq("assets/cloud/", "atk", 12).filter((u, i) => i !== 7 && i !== 8);
const CLOUD_TWIRL = seq("assets/cloud/", "twirl", 25);
const CLOUD_WIN = seq("assets/cloud/", "win", 4);
const LINK_ARCS = ["right", "down", "left", "up"].map((d) => "assets/link/arc-" + d + ".png");
const KIRBY = { puffed: "assets/kirby/puffed-1.png", spit: "assets/kirby/spit-1.png", star: "assets/kirby/sword-1.png" };

export function preloadMoves() {
  [...CLOUD_ATK, ...CLOUD_TWIRL, ...CLOUD_WIN, ...LINK_ARCS, KIRBY.puffed, KIRBY.spit].forEach((u) => { new Image().src = u; });
}

function play(el, frames, opts) {
  if (!el.animate) return Promise.resolve();
  const a = el.animate(frames, Object.assign({ fill: "forwards" }, opts));
  return a.finished.catch(() => {});
}

function fxSvg(parent, x, y, w, h0, viewBox, inner) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "fx");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.style.left = x + "px"; svg.style.top = y + "px";
  svg.style.width = w + "px"; svg.style.height = h0 + "px";
  svg.innerHTML = inner || "";
  parent.appendChild(svg);
  return svg;
}

function zig(x0, y0, x1, y1, n, amp) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len, pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const t = i / n, o = (i % 2 ? 1 : -1) * amp * (0.5 + Math.random() * 0.7);
    pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]);
  }
  pts.push([x1, y1]);
  return pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
}
const boltLine = (pts, glow, core) =>
  `<polyline points="${pts}" fill="none" stroke="#ffe94a" stroke-width="${glow}" stroke-linejoin="bevel" stroke-linecap="round"/>` +
  `<polyline points="${pts}" fill="none" stroke="#fffbe0" stroke-width="${core}" stroke-linejoin="bevel" stroke-linecap="round"/>`;

function sparkles(av, n = 8) {
  const w = av.offsetWidth, hh = av.offsetHeight;
  const all = [];
  for (let i = 0; i < n; i++) {
    const s = h("span", { class: "spark" });
    s.style.left = (w / 2 - 6) + "px"; s.style.top = (hh / 2 - 6) + "px";
    av.appendChild(s);
    const a = (i / n) * Math.PI * 2, d = Math.max(w, hh) * (0.7 + Math.random() * 0.4);
    all.push(play(s, [{ transform: "translate(0,0) scale(.4)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(1.2)`, opacity: 0 }],
      { duration: 650, easing: "steps(6)" }).then(() => s.remove()));
  }
  return Promise.all(all);
}

async function jump(av) {
  const img = av.querySelector("img");
  sfx("jump");
  await play(img, [
    { transform: "none" }, { transform: "translateY(-45%) scaleY(1.08)", offset: 0.35 },
    { transform: "translateY(0) scaleY(.92)", offset: 0.7 }, { transform: "none" }
  ], { duration: 650, easing: "steps(8)" });
  sfx("coin");
  await sparkles(av, 10);
  img.getAnimations().forEach((a) => a.cancel());
}

async function thunderbolt(av) {
  const img = av.querySelector("img");
  const b = { x: 0, y: 0, w: av.offsetWidth, h: av.offsetHeight };
  const cx = b.w * 0.45, cy = b.h * 0.5;
  img.style.transformOrigin = "50% 100%";
  bubble(av, "PIKA... PIKA...", 1300);
  sfx("charge");
  const cheeks = [[0.3, 0.45], [0.6, 0.45]];
  const sparks = cheeks.map((c) => fxSvg(av, b.w * c[0] - 10, b.h * c[1] - 10, 20, 20, "0 0 28 28"));
  const crackle = setInterval(() => {
    sparks.forEach((el) => {
      el.innerHTML = boltLine(zig(3, 14, 25, 14, 4, 6), 3, 1.2) + boltLine(zig(14, 3, 14, 25, 4, 6), 3, 1.2);
      el.style.opacity = Math.random() < 0.8 ? "1" : "0";
    });
  }, 80);
  await play(img, [
    { transform: "none", filter: "none" },
    { transform: "scale(1.05,.9)", filter: "brightness(1.15)", offset: 0.3 },
    { transform: "scale(1.06,.88) translateX(-2%)", filter: "brightness(1.3) drop-shadow(0 0 4px #ffe94a)", offset: 0.55 },
    { transform: "scale(1.06,.88) translateX(2%)", filter: "brightness(1.15)", offset: 0.75 },
    { transform: "scale(1.08,.86)", filter: "brightness(1.4) drop-shadow(0 0 6px #ffe94a)" }
  ], { duration: 1000, easing: "steps(8)" });
  clearInterval(crackle);
  sparks.forEach((el) => el.remove());
  bubble(av, "CHUUU!", 1500);
  sfx("thunder");
  const R = Math.max(b.w, b.h) * 0.95;
  const ring = fxSvg(av, cx - R * 0.7, cy - R * 0.7, R * 1.4, R * 1.4, "0 0 100 100",
    '<circle cx="50" cy="50" r="42" fill="none" stroke="#fff36b" stroke-width="5"/><circle cx="50" cy="50" r="42" fill="none" stroke="#fffbe0" stroke-width="2"/>');
  play(ring, [{ transform: "scale(.25)", opacity: 1 }, { transform: "scale(1.35)", opacity: 0 }], { duration: 550, easing: "ease-out" });
  const burst = fxSvg(av, cx - R, cy - R, R * 2, R * 2, "-100 -100 200 200");
  const angles = [-160, -120, -85, -50, -15, 20, 140, 175];
  let tick = 0;
  const discharge = () => {
    tick++;
    let html = "";
    angles.forEach((deg, i) => {
      if ((tick + i) % 4 === 0) return;
      const r = deg * Math.PI / 180, inner = 34, outer = 66 + Math.random() * 30;
      html += boltLine(zig(Math.cos(r) * inner, Math.sin(r) * inner, Math.cos(r) * outer, Math.sin(r) * outer, 5, 9), 7, 2.5);
    });
    burst.innerHTML = html;
  };
  discharge();
  const crack = setInterval(discharge, 75);
  await play(img, [
    { transform: "scale(1.08,.86)", filter: "brightness(1.4) drop-shadow(0 0 6px #ffe94a)" },
    { transform: "translateY(-18%) scale(.96,1.06)", filter: "brightness(1.9) drop-shadow(0 0 12px #ffe94a)", offset: 0.12 },
    { transform: "translateY(-18%) translateX(-2%)", filter: "brightness(1.4) drop-shadow(0 0 7px #ffe94a)", offset: 0.3 },
    { transform: "translateY(-18%) translateX(2%)", filter: "brightness(1.9) drop-shadow(0 0 12px #ffe94a)", offset: 0.48 },
    { transform: "translateY(-18%) translateX(-2%)", filter: "brightness(1.4) drop-shadow(0 0 7px #ffe94a)", offset: 0.66 },
    { transform: "translateY(-16%)", filter: "brightness(1.8) drop-shadow(0 0 10px #ffe94a)", offset: 0.82 },
    { transform: "scale(1.05,.93)", filter: "brightness(1.2) drop-shadow(0 0 4px #ffe94a)", offset: 0.93 },
    { transform: "none", filter: "none" }
  ], { duration: 1400, easing: "steps(12)" });
  clearInterval(crack);
  ring.remove();
  await play(burst, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "steps(2)" });
  burst.remove();
  img.getAnimations().forEach((a) => a.cancel());
  img.style.transformOrigin = "";
}

async function playFrames(el, frames, ms, onFrame) {
  for (let i = 0; i < frames.length; i++) {
    el.src = frames[i];
    if (onFrame) onFrame(i);
    await wait(ms);
  }
}

// Cloud: the Brave Exvius swing then the victory twirl, overlaid on the sprite.
async function slash(av) {
  const img = av.querySelector("img");
  const hh = av.offsetHeight;
  const ov = h("img", { class: "fx-sprite px", src: CLOUD_WIN[0], alt: "", "aria-hidden": "true" });
  // The frame canvas is wider than the standing sprite; centre it on him.
  ov.style.height = (hh * 1.45) + "px";
  ov.style.left = "50%"; ov.style.bottom = "0";
  ov.style.transform = "translateX(-50%)";
  av.appendChild(ov);
  img.style.visibility = "hidden";
  await wait(100);
  await playFrames(ov, CLOUD_ATK, 80, (i) => { if (i === 1) sfx("slash"); });
  await wait(120);
  await playFrames(ov, CLOUD_TWIRL, 65, (i) => { if (i === 9 || i === 15) sfx("whoosh"); });
  await playFrames(ov, CLOUD_WIN, 110);
  img.style.visibility = "";
  ov.remove();
  await sparkles(av, 8);
}

// Link: charge, then the Spin Attack arcs sweep around him twice.
async function spin(av) {
  const img = av.querySelector("img");
  const w = av.offsetWidth, hh = av.offsetHeight;
  sfx("charge");
  img.style.transformOrigin = "50% 100%";
  const crouch = img.animate ? img.animate([{ transform: "none" }, { transform: "scale(1.04,.94)" }], { duration: 500, fill: "forwards", easing: "steps(3)" }) : null;
  await wait(600);
  if (crouch) crouch.cancel();
  bubble(av, "HYAAAH!", 1200);
  sfx("spin");
  const size = Math.max(w, hh) * 2.2;
  const arc = h("img", { class: "fx-sprite px", alt: "", "aria-hidden": "true" });
  arc.style.width = size + "px";
  arc.style.left = (w / 2 - size / 2) + "px"; arc.style.top = (hh / 2 - size / 2) + "px";
  av.appendChild(arc);
  const facing = [1, 1, -1, -1];
  for (let t = 0; t < 8; t++) {
    arc.src = LINK_ARCS[t % 4];
    img.style.transform = "scaleX(" + facing[t % 4] + ")";
    await wait(75);
  }
  arc.remove();
  img.style.transform = "";
  img.style.transformOrigin = "";
  await sparkles(av, 8);
}

// Kirby: inhale, puff up, spit a star.
async function kirby(av) {
  const img = av.querySelector("img");
  const src = img.src;
  sfx("inhale");
  await play(img, [{ transform: "none" }, { transform: "scale(1.15)" }], { duration: 400, easing: "steps(4)" });
  img.src = KIRBY.puffed;
  await wait(500);
  sfx("spit");
  img.src = KIRBY.spit;
  const star = h("span", { class: "spark" });
  star.style.left = "70%"; star.style.top = "45%"; star.style.width = "18px"; star.style.height = "18px";
  av.appendChild(star);
  await play(star, [{ transform: "translateX(0) rotate(0)", opacity: 1 }, { transform: "translateX(90px) rotate(360deg)", opacity: 0 }], { duration: 600, easing: "steps(6)" });
  star.remove();
  img.src = src;
  img.getAnimations().forEach((a) => a.cancel());
  sfx("coin");
  await sparkles(av, 8);
}

const MOVES = { jump, thunderbolt, slash, spin, kirby };

export async function playMove(av, name) {
  if (!av || av.dataset.busy) return;
  const fn = MOVES[name] || jump;
  if (reduceMotion()) { sfx("coin"); return; }
  av.dataset.busy = "1";
  try { await fn(av); } catch (e) { /* keep going */ }
  finally {
    av.querySelectorAll(".fx, .fx-sprite, .spark").forEach((n) => n.remove());
    const img = av.querySelector("img");
    if (img) { img.style.filter = ""; img.style.visibility = ""; img.style.transform = ""; img.getAnimations && img.getAnimations().forEach((a) => a.cancel()); }
    delete av.dataset.busy;
  }
}
