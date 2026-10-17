// WHERE'S THE BINKY? (client). A canvas full of emoji with five baby items
// hidden in it. Every phone regenerates the scene from content.seed with the
// shared generator, so everyone hunts the same picture. Progressive: each find
// is submitted as it happens, the final one when all five are in.
import { h, appendTo, wait, reduceMotion } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";
import { liveBars } from "../engine/stage.js";
import { mulberry32 } from "../engine/rng.js";
import { generateScene, hitTest, targetName, targetChar } from "./binky-scene.js";
import data from "../data/binky.js";

const TAU = Math.PI * 2;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const INK = "#1d1b18", GREEN = "#8cc523", RED = "#e0283a", GOLD = "#ffd84a", NIGHT = "#0c0e0b", CREAM = "#f3e6cf", CREAM2 = "#ead7b8";
const ease = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// ------------------------------------------------------------ drawing
// The whole scene once, at device resolution. Everything else is composited from it.
function renderBase(scene, pxW) {
  const k = pxW / scene.w;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(pxW));
  c.height = Math.max(1, Math.round(scene.h * k));
  const g = c.getContext("2d");
  g.scale(k, k);
  g.fillStyle = CREAM;
  g.fillRect(0, 0, scene.w, scene.h);
  g.fillStyle = CREAM2;
  for (let y = 0; y < scene.h; y += 100) for (let x = (y / 100) % 2 ? 100 : 0; x < scene.w; x += 200) g.fillRect(x, y, 100, 100);
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const gl of scene.glyphs) {
    g.save();
    g.translate(gl.x, gl.y);
    g.rotate(gl.rot || 0);
    g.font = gl.size + "px " + (data.shapes.includes(gl.ch) ? "sans-serif" : EMOJI_FONT);
    g.fillStyle = gl.color || INK;
    g.fillText(gl.ch, 0, 0);
    g.restore();
  }
  return c;
}

function ringPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRing(ctx, x, y, r, color, w) {
  ctx.lineJoin = "miter";
  ringPath(ctx, x, y, r);
  ctx.strokeStyle = INK; ctx.lineWidth = w + 4; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
}

function drawCross(ctx, x, y, s, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "square";
  for (const [c, w] of [[INK, 9], [RED, 5]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
  }
  ctx.restore();
}

// A canvas that shows one scene: fits itself to its CSS width, composites the
// base image with the flashlight, rings, misses and an optional zoom camera.
// fitViewport: the canvas never reaches below the visible part of the window (phones, where
// the address bar and touch-action: none would otherwise hide the bottom of the pile).
// pan: on a map taller than that, keep the full width and scroll the scene under the finger
// instead of shrinking it (day rounds; at night the finger is the torch, so no panning).
function createView(canvas, scene, { night = false, fitViewport = false, pan = false } = {}) {
  const ctx = canvas.getContext("2d");
  const st = { night, light: night ? { x: scene.w / 2, y: scene.h / 2 } : null, rings: [], marks: [], zoom: null, panY: 0 };
  let base = null, cssW = 0, cssH = 0, dpr = 1, raf = 0, animUntil = 0, alive = true;

  // Pixels from the canvas top to the bottom of the visible window, page scrolled to the top.
  function availHeight() {
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 800;
    const top = canvas.getBoundingClientRect().top + (window.scrollY || 0);
    return Math.max(300, Math.floor(vh - top - 14));
  }

  function fit() {
    if (!alive) return false;
    const parent = canvas.parentElement;
    const w0 = fitViewport && parent ? parent.clientWidth : (canvas.clientWidth || canvas.getBoundingClientRect().width);
    if (!w0) { requestAnimationFrame(fit); return false; }
    dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = w0, hFull = w0 * scene.h / scene.w, hUse = hFull;
    if (fitViewport) {
      const avail = availHeight();
      if (hFull > avail) {
        if (pan) hUse = avail;                                              // keep the width, scroll the rest
        else { w = Math.floor(avail * scene.w / scene.h); hUse = avail; }  // shrink to fit, whole map visible
      }
      canvas.style.width = w + "px";
    }
    cssW = w; cssH = hUse;
    canvas.style.height = cssH + "px";
    const pxW = Math.round(cssW * dpr), pxH = Math.round(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW; canvas.height = pxH;
      base = renderBase(scene, pxW);
    }
    setPan(st.panY);
    paint(performance.now());
    return true;
  }

  const scale = () => cssW / scene.w;
  const maxPan = () => Math.max(0, scene.h * scale() - cssH);
  const canPan = () => pan && maxPan() > 1;
  function setPan(y) { st.panY = Math.max(0, Math.min(maxPan(), y || 0)); }
  // The torch never shrinks below a thumb-friendly size on screen, whatever the scale.
  const lightRadius = () => Math.max(data.flashlight, 100 / Math.max(0.01, scale()));

  // Scene units -> canvas px, through the camera: a zoom (reveal tour) or the pan offset.
  function map(ux, uy) {
    const s = scale();
    if (!st.zoom) return [ux * s, uy * s - st.panY];
    return [(ux - st.zoom.x) * s * st.zoom.k + cssW / 2, (uy - st.zoom.y) * s * st.zoom.k + cssH / 2];
  }

  function paint(now) {
    if (!base) return;
    const s = scale() * (st.zoom ? st.zoom.k : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cssW, cssH);
    const drawScene = () => {
      const [ox, oy] = map(0, 0);
      ctx.drawImage(base, ox, oy, scene.w * s, scene.h * s);
    };
    if (st.night) {
      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, cssW, cssH);
      if (st.light) {
        const [lx, ly] = map(st.light.x, st.light.y);
        const r = lightRadius() * s;
        ctx.save();
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.clip();
        drawScene();
        // Warm centre, darker rim: a torch beam rather than a hard porthole.
        const g = ctx.createRadialGradient(lx, ly, r * 0.55, lx, ly, r);
        g.addColorStop(0, "rgba(255,216,74,.10)");
        g.addColorStop(1, "rgba(0,0,0,.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,216,74,.7)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.stroke();
      }
    } else {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, cssW, cssH);
      drawScene();
    }
    for (const rg of st.rings) {
      const age = rg.born ? (now - rg.born) / 260 : 1;
      const pop = age < 1 ? 1 + (1 - ease(Math.max(0, age))) * 0.8 : 1;
      const [x, y] = map(rg.x, rg.y);
      drawRing(ctx, x, y, (rg.size * 0.8 + 12) * s * pop, rg.color || GREEN, Math.max(3, 5 * s * (st.zoom ? st.zoom.k : 1)));
    }
    st.marks = st.marks.filter((m) => m.until > now);
    for (const m of st.marks) {
      const [x, y] = map(m.x, m.y);
      drawCross(ctx, x, y, Math.max(8, 26 * s), Math.min(1, (m.until - now) / 200));
    }
    // A scroll thumb on the right while the map is taller than the canvas.
    if (canPan() && !st.zoom) {
      const trackH = cssH - 16, thumbH = Math.max(24, trackH * cssH / (scene.h * scale()));
      const y = 8 + (trackH - thumbH) * (st.panY / Math.max(1, maxPan()));
      ctx.fillStyle = "rgba(29,27,24,.22)"; ctx.fillRect(cssW - 11, 8, 6, trackH);
      ctx.fillStyle = "rgba(29,27,24,.75)"; ctx.fillRect(cssW - 11, y, 6, thumbH);
    }
  }

  function loop(now) {
    raf = 0;
    paint(now);
    if (alive && now < animUntil) raf = requestAnimationFrame(loop);
  }
  function request(ms = 0) {
    animUntil = Math.max(animUntil, performance.now() + ms);
    if (!raf && alive) raf = requestAnimationFrame(loop);
  }
  // Pointer -> scene units, through the same camera.
  function toUnits(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (cssW / Math.max(1, r.width)), py = (e.clientY - r.top) * (cssH / Math.max(1, r.height));
    const s = scale();
    let x, y;
    if (!st.zoom) { x = px / s; y = (py + st.panY) / s; }
    else { x = (px - cssW / 2) / (s * st.zoom.k) + st.zoom.x; y = (py - cssH / 2) / (s * st.zoom.k) + st.zoom.y; }
    return [Math.max(0, Math.min(scene.w, x)), Math.max(0, Math.min(scene.h, y))];
  }
  function destroy() { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  return { st, fit, request, toUnits, destroy, isAlive: () => alive, scale, canPan, setPan, panY: () => st.panY, lightRadius };
}

// cap is a height budget on big screens; the width follows the scene's aspect (h / w).
function sceneCanvas({ big = false, night = false, cap = "70vh", aspect = 1.4 } = {}) {
  return h("canvas", {
    class: "game-surface", width: "10", height: "14", "aria-label": "The toy pile",
    style: { display: "block", width: big ? "min(100%, calc(" + cap + " / " + aspect.toFixed(4) + "))" : "100%", margin: "0 auto", border: "4px solid " + INK, boxShadow: "4px 4px 0 #000", background: night ? NIGHT : CREAM }
  });
}

// Target chips: a big glyph (the thing to look for) over a small label.
const chipStyle = (on, big) => ({
  display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: big ? "92px" : "62px",
  padding: big ? "8px 10px 6px" : "6px 6px 4px", border: "3px solid " + INK, fontSize: big ? ".8em" : ".6em", lineHeight: "1.2",
  background: on ? GREEN : "#2b2f27", color: on ? INK : "#bdb29c", boxShadow: "2px 2px 0 #000", whiteSpace: "nowrap", transition: "background .15s"
});
const glyphStyle = (big) => ({ fontSize: big ? "44px" : "34px", lineHeight: "1", fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" });

function chipRow(keys, names, chars, { big = false } = {}) {
  const chips = {};
  const row = h("div", { class: "row", style: { justifyContent: "center", flexWrap: "wrap", gap: "6px", margin: "0 0 10px" } });
  keys.forEach((k) => {
    chips[k] = h("span", { style: chipStyle(false, big), dataset: { key: k } },
      h("span", { style: glyphStyle(big), "aria-hidden": "true" }, chars[k] || targetChar(k)),
      h("span", null, names[k] || targetName(k)));
    row.appendChild(chips[k]);
  });
  return { row, chips, light(k, on = true) { if (chips[k]) Object.assign(chips[k].style, chipStyle(on, big)); } };
}

// ----------------------------------------------------------- module
let current = null;   // the phone's live round
let stage = null;     // the TV / STAGE view
let demoStop = null;  // the how-to loop

export default {
  id: "binky",
  progressive: true,

  // A finger wanders over a few glyphs, taps the bottle, a ring pops. Loops.
  howtoDemo(el, content) {
    const night = content && content.mode === "night";
    const canvas = h("canvas", { "aria-hidden": "true", style: { display: "block", width: "100%", height: "clamp(150px, 30vh, 340px)", border: "3px solid " + INK, background: night ? NIGHT : CREAM } });
    el.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(99);
    const W = 300, H = 150;
    const glyphs = [];
    for (let i = 0; i < 16; i++) glyphs.push({ x: 12 + rng() * (W - 24), y: 12 + rng() * (H - 24), ch: rng.pick(data.distractors), size: 16 + rng() * 14, rot: rng() * 1.2 - 0.6 });
    const target = { x: 96, y: 78, ch: data.targets[0].ch, size: 26 };
    const from = { x: 250, y: 140 };
    let raf = 0, t0 = performance.now(), on = true;
    function frame(now) {
      if (!on) return;
      const w = canvas.clientWidth || 300, hc = canvas.clientHeight || 150, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hc * dpr); }
      // Fit the 300x150 demo inside the canvas (the TV is much wider than it is tall).
      const k = Math.min(w / W, hc / H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = night ? NIGHT : CREAM;
      ctx.fillRect(0, 0, w, hc);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (w - W * k) / 2, dpr * (hc - H * k) / 2);
      const p = ((now - t0) % 2600) / 2600;
      const travel = Math.min(1, p / 0.45);
      const fx = from.x + (target.x - from.x) * easeInOut(travel), fy = from.y + 6 + (target.y - from.y) * easeInOut(travel);
      const tapped = p > 0.5;
      const press = p > 0.45 && p < 0.55 ? 0.85 : 1;
      const drawScene = () => {
        ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const g of glyphs.concat(target)) { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot || 0); ctx.font = g.size + "px " + EMOJI_FONT; ctx.fillText(g.ch, 0, 0); ctx.restore(); }
      };
      if (night) {
        ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.beginPath(); ctx.arc(fx, fy - 4, 42, 0, TAU); ctx.clip(); drawScene(); ctx.restore();
        ctx.strokeStyle = "rgba(255,216,74,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy - 4, 42, 0, TAU); ctx.stroke();
      } else drawScene();
      if (tapped) drawRing(ctx, target.x, target.y, 22 + (p < 0.6 ? (0.6 - p) * 60 : 0), GREEN, 4);
      ctx.save(); ctx.translate(fx, fy); ctx.scale(press, press); ctx.font = "34px " + EMOJI_FONT; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("👆", 0, 0); ctx.restore();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    demoStop = () => { on = false; cancelAnimationFrame(raf); };
    return demoStop;
  },

  mount(el, content, api) {
    const round = content.round || 1;
    const scene = generateScene(content.seed, round, content.spec || null);
    const night = content.mode === "night";
    const keys = content.targetKeys || data.targets.map((t) => t.key);
    const names = content.targetNames || {}, chars = content.targetChars || {};
    const found = [], times = [];
    const t0 = performance.now();

    const counter = h("div", { class: "counter center", "aria-live": "polite", style: { fontSize: "1.6em", margin: "0 0 6px" } }, "FOUND 0/" + keys.length);
    const chips = chipRow(keys, names, chars);
    const canvas = sceneCanvas({ night, aspect: scene.h / scene.w });
    const after = h("div", { class: "center", style: { marginTop: "12px" } });
    const hint = h("p", { class: "tiny center", style: { marginTop: "8px" } }, night ? "DRAG TO SEARCH: THE LIGHT FLOATS ABOVE YOUR FINGER AND STAYS WHERE YOU LEAVE IT. TAP AN ITEM TO GRAB IT." : "TAP AN ITEM WHEN YOU SPOT IT.");
    appendTo(el,
      h("h2", { class: "title", style: { fontSize: "1.2em", margin: "4px 0" } }, content.title || "WHERE'S THE BINKY?"),
      content.subtitle ? h("p", { class: "sub", style: { marginBottom: "8px" } }, content.subtitle) : null,
      counter, chips.row, canvas, hint,
      after);

    // The whole canvas stays on screen. A map taller than that scrolls under the finger
    // by day; at night the finger is the torch, so the night map shrinks to fit instead.
    const view = createView(canvas, scene, { night, fitViewport: true, pan: !night });
    // A phone that reloaded mid-round keeps what it already found.
    const prev = api.you && api.you() && api.you().myAnswer;
    if (prev && Array.isArray(prev.found)) {
      prev.found.forEach((k, i) => {
        const t = scene.targets.find((x) => x.key === k);
        if (!t || found.includes(k)) return;
        found.push(k); times.push(Number(prev.t && prev.t[i]) || 0);
        view.st.rings.push({ x: t.x, y: t.y, size: t.size, color: GREEN, born: 0 });
        chips.light(k);
      });
      counter.textContent = "FOUND " + found.length + "/" + keys.length;
    }
    view.fit();
    if (view.canPan()) hint.textContent = "DRAG UP AND DOWN TO LOOK THROUGH THE PILE. TAP AN ITEM TO GRAB IT.";

    function celebrate() {
      api.sfx("win");
      api.vibrate([30, 40, 60]);
      const secs = (times[times.length - 1] / 1000).toFixed(1);
      appendTo(after,
        h("div", { class: "stamp pop", style: { borderColor: GREEN, color: GREEN, fontSize: "1.3em" } }, "ALL FOUND!"),
        h("p", { class: "sub", style: { marginTop: "10px" } }, "+ SPEED BONUS · " + secs + "s"));
    }

    function foundOne(t) {
      found.push(t.key);
      times.push(Math.round(performance.now() - t0));
      view.st.rings.push({ x: t.x, y: t.y, size: t.size, color: GREEN, born: performance.now() });
      api.sfx("coin");
      api.vibrate(20);
      chips.light(t.key);
      counter.textContent = "FOUND " + found.length + "/" + keys.length;
      const done = found.length >= keys.length;
      // One submit per find; the fifth one is final.
      api.submit({ found: found.slice(), t: times.slice() }, { final: done, label: "FOUND " + found.length + "/" + keys.length });
      view.request(300);
      if (done) celebrate();
    }

    // The one tap path: real taps and the rehearsal autoplay both come through here.
    function tapAt(x, y) {
      if (!view.isAlive()) return false;
      if (found.length >= keys.length) { view.request(); return false; }
      const hit = hitTest(scene, x, y, found);
      if (hit) { foundOne(hit); return true; }
      view.st.marks.push({ x, y, until: performance.now() + 450 });
      api.sfx("blip");
      view.request(450);
      return false;
    }

    // Night mode: the beam floats above the finger (fingers cover what they touch), it
    // keeps shining where you leave it, a drag searches and a clean tap grabs. The offset
    // is at least 72 screen px however small the canvas got.
    const lightAt = (x, y) => {
      const off = Math.max(data.lightOffset, 72 / view.scale());
      view.st.light = { x, y: Math.max(view.lightRadius() * 0.6, y - off) };
      view.request();
    };
    // Day mode on a tall map: a drag scrolls the pile, a clean tap grabs. Small day maps
    // grab on the way down, as before.
    let press = null;
    const onDown = (e) => {
      e.preventDefault();
      const [x, y] = view.toUnits(e);
      if (!night && !view.canPan()) { tapAt(x, y); return; }
      press = { x, y, cx: e.clientX, cy: e.clientY, pan0: view.panY(), moved: false, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (night) lightAt(x, y);
    };
    const onMove = (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 10) press.moved = true;
      if (night) { const [x, y] = view.toUnits(e); lightAt(x, y); return; }
      if (press.moved) { view.setPan(press.pan0 + (press.cy - e.clientY)); view.request(); }
    };
    const onUp = (e) => {
      if (!press || e.pointerId !== press.id) return;
      const was = press; press = null;
      if (!was.moved) tapAt(was.x, was.y);
    };
    const onResize = () => view.fit();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);

    current = {
      scene, keys, found, tapAt,
      destroy() {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        window.removeEventListener("resize", onResize);
        view.destroy();
      }
    };
  },

  unmount() {
    if (current) { try { current.destroy(); } catch (e) { /* ignore */ } current = null; }
    if (stage) { try { stage.destroy(); } catch (e) { /* ignore */ } stage = null; }
    if (demoStop) { try { demoStop(); } catch (e) { /* ignore */ } demoStop = null; }
  },

  // Rehearsal: "tap" 3 to 5 targets (and one miss) through the real tap path.
  autoplay(el, content, api) {
    const s = current;
    if (!s) return;
    const n = 3 + Math.floor(Math.random() * 3);
    const picks = s.scene.targets.slice().sort(() => Math.random() - 0.5).slice(0, n);
    let delay = 600 + Math.random() * 800;
    setTimeout(() => { if (current === s) s.tapAt(Math.random() * s.scene.w, Math.random() * s.scene.h); }, delay);
    picks.forEach((t) => {
      delay += 1000 + Math.random() * 2000;
      setTimeout(() => { if (current === s) s.tapAt(t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 40); }, delay);
    });
  },

  async reveal(el, reveal, api) {
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const round = reveal.round || (api.results && api.results.round) || 1;
    if (!reveal.targets || reveal.seed == null) { appendTo(el, h("p", { class: "sub" }, "NO REVEAL DATA.")); return; }
    const scene = generateScene(reveal.seed, round);
    const myFound = new Set(you && you.myAnswer && Array.isArray(you.myAnswer.found) ? you.myAnswer.found : []);
    const mine = reveal.targets.filter((t) => myFound.has(t.key)).length;

    const canvas = sceneCanvas({ big: api.big, cap: api.tv ? "80vh" : "60vh", aspect: scene.h / scene.w });
    const tally = h("div", null);
    appendTo(el, h("h2", { class: "title" }, "WHERE WERE THEY?"), api.tv ? h("div", { class: "tv-two", style: { alignItems: "center" } }, h("div", null, canvas), tally) : [canvas, tally]);
    const view = createView(canvas, scene, { night: false, fitViewport: !api.big });
    view.fit();
    const alive = () => el.isConnected && view.isAlive();
    const quick = reduceMotion();

    // Camera tour: dive onto the first item, glide to each of the others, pull back out.
    // A tall map is drawn smaller, so the dive goes proportionally deeper.
    const K = 3 * Math.max(1, scene.h / data.h);
    const clampCenter = (x, y, k) => [Math.max(scene.w / (2 * k), Math.min(scene.w - scene.w / (2 * k), x)), Math.max(scene.h / (2 * k), Math.min(scene.h - scene.h / (2 * k), y))];
    const full = { x: scene.w / 2, y: scene.h / 2, k: 1 };
    async function glide(from, to, ms) {
      if (quick) { view.st.zoom = to.k === 1 ? null : to; view.request(); return; }
      const start = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          if (!alive()) { done(); return; }
          const p = Math.min(1, (now - start) / ms), e = easeInOut(p);
          view.st.zoom = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
          view.request();
          if (p < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
      });
    }
    await wait(api.big ? 900 : 500);
    let cam = full;
    for (const t of reveal.targets) {
      if (!alive()) return;
      const [cx, cy] = clampCenter(t.x, t.y, K);
      const to = { x: cx, y: cy, k: K };
      api.sfx("pop");
      view.st.rings.push({ x: t.x, y: t.y, size: t.size, color: you ? (myFound.has(t.key) ? GREEN : RED) : GOLD, born: performance.now() + (quick ? 0 : 350) });
      await glide(cam, to, 700);
      cam = to;
      await wait(quick ? 150 : 250);
    }
    await glide(cam, full, 600);
    view.st.zoom = null;
    view.request();
    if (!alive()) return;

    // The tally.
    const all5 = reveal.counts ? reveal.counts.all5 || 0 : 0;
    api.sfx(all5 ? "coin" : "thunk");
    const chips = chipRow(reveal.targets.map((t) => t.key), Object.fromEntries(reveal.targets.map((t) => [t.key, t.name])), {}, { big: api.big });
    reveal.targets.forEach((t) => {
      const n = reveal.counts && reveal.counts.found ? reveal.counts.found[t.key] || 0 : 0;
      chips.chips[t.key].textContent = targetChar(t.key) + " " + t.name + " ×" + n;
      chips.light(t.key, n > 0);
    });
    const fast = reveal.fastest && (byId[reveal.fastest.id] || { name: reveal.fastest.name || "?" });
    appendTo(tally,
      h("div", { class: "panel dark center pop", style: { marginTop: "14px" } },
        h("div", { class: "counter", style: { fontSize: "1.5em" } }, all5 + (all5 === 1 ? " PLAYER" : " PLAYERS") + " FOUND ALL 5"),
        chips.row,
        fast ? h("div", { class: "row", style: { justifyContent: "center", gap: "10px", marginTop: "6px" } },
          fast.avatar ? spriteEl(fast.avatar, { size: "sm", cls: "hop" }) : null,
          h("span", { class: "tiny", style: { color: GOLD } }, "FASTEST: " + fast.name + " · " + (reveal.fastest.t / 1000).toFixed(1) + "s")) : h("p", { class: "tiny", style: { margin: "6px 0 0" } }, "NOBODY FOUND ALL FIVE. THEY'RE SNEAKY.")));
    if (you) {
      const missed = reveal.targets.filter((t) => !myFound.has(t.key)).map((t) => t.name);
      appendTo(tally, h("div", { class: "panel center" },
        h("strong", { style: { fontSize: "1.3em" } }, "YOU FOUND " + mine + "/" + reveal.targets.length),
        h("br"),
        h("span", { class: "tiny", style: { color: "#6b3510" } }, mine === reveal.targets.length ? "CLEAN SWEEP!" : "MISSED: " + missed.join(", "))));
    }
    const best = (reveal.best || []).map((id) => byId[id]).filter(Boolean);
    if (best.length) {
      const wrap = h("div", { class: "row", style: { justifyContent: "center", gap: "14px", marginTop: "10px" } });
      best.forEach((r, i) => wrap.appendChild(h("div", { class: "center" }, spriteEl(r.avatar, { cls: "hop" }), h("div", { class: "tiny" }, (i === 0 ? "TOP: " : "") + r.name))));
      appendTo(tally, h("p", { class: "sub" }, "SHARPEST EYES"), wrap);
    }
  },

  // TV / host STAGE: the scene (no rings) beside a live bar race of found counts.
  stageView(el, content, api) {
    const round = content.round || 1;
    const scene = generateScene(content.seed, round, content.spec || null);
    const night = content.mode === "night";
    const keys = content.targetKeys || data.targets.map((t) => t.key);
    const canvas = sceneCanvas({ big: true, night, cap: "68vh", aspect: scene.h / scene.w });
    const chips = chipRow(keys, content.targetNames || {}, content.targetChars || {}, { big: true });
    keys.forEach((k) => chips.light(k, true));
    const count = h("div", { class: "counter center", dataset: { role: "binky-count" } }, "0 SEARCHING");
    const avg = h("p", { class: "sub" }, "");
    const barsWrap = h("div", null);
    appendTo(el,
      h("h2", { class: "title big" }, content.title || "WHERE'S THE BINKY?"),
      content.subtitle ? h("p", { class: "sub" }, content.subtitle) : null,
      h("div", { class: api.tv ? "tv-two" : "stack", style: api.tv ? { alignItems: "center" } : null },
        h("div", null, canvas),
        h("div", null, chips.row, count, avg, h("p", { class: "label center" }, "FOUND SO FAR"), barsWrap)));
    const bars = liveBars(barsWrap, { max: 10 });
    const view = createView(canvas, scene, { night });
    view.fit();
    // At night the TV's flashlight roams on its own so the crowd sees the pile.
    let raf = 0, alive = true;
    if (night) {
      const t0 = performance.now();
      const roam = (now) => {
        if (!alive) return;
        const t = (now - t0) / 1000;
        view.st.light = { x: scene.w / 2 + Math.sin(t * 0.7) * scene.w * 0.36, y: scene.h / 2 + Math.cos(t * 0.45) * scene.h * 0.38 };
        view.request();
        raf = requestAnimationFrame(roam);
      };
      raf = requestAnimationFrame(roam);
    }
    const onResize = () => view.fit();
    window.addEventListener("resize", onResize);
    stage = { destroy() { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); view.destroy(); } };
    return {
      update(live, snap) {
        const n = live && live.answered != null ? live.answered : (snap && snap.answerCount) || 0;
        count.textContent = n + " SEARCHING";
        avg.textContent = live && live.avg != null ? "AVG " + live.avg + " OF " + keys.length + " FOUND" : "";
        if (live && live.bars) bars.update(live.bars, { unit: "/" + keys.length });
      }
    };
  }
};
