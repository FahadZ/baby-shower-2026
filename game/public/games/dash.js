// DIAPER DASH (client). A 20 s reflex arcade on a canvas: pacifiers fall from
// the top, tap the good ones, avoid the diapers. The spawn schedule is built
// from content.seed so every phone sees the identical stream; the server only
// ever sees { caught, gold, bad, score }, submitted progressively.
import { h, appendTo, wait, reduceMotion, countUp } from "../engine/dom.js";
import { spriteEl, hop } from "../engine/avatars.js";
import { liveBars } from "../engine/stage.js";
import data from "../data/dash.js";
import { buildSchedule } from "./dash-schedule.js";

const SIZE = data.itemSize;            // CSS px per item on phones
const HIT_R = data.hitRadius;          // CSS px, generous
const GRID = data.sprites.good.length; // 11 pixel rows
const FONT = "'Press Start 2P', ui-monospace, monospace";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- sprites
// Pixel maps from data/dash.js rendered once per (kind, dpr, size) into tiny canvases.
const spriteCache = {};
function sprite(kind, dpr, size = SIZE) {
  const key = kind + "@" + dpr + "@" + size;
  if (spriteCache[key]) return spriteCache[key];
  const rows = data.sprites[kind];
  const px = Math.max(1, Math.round((size / GRID) * dpr));
  const c = document.createElement("canvas");
  c.width = px * GRID; c.height = px * GRID;
  const g = c.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      g.fillStyle = data.palette[ch] || "#f0f";
      g.fillRect(x * px, y * px, px, px);
    }
  });
  spriteCache[key] = c;
  return c;
}

// A sprite as a DOM node (legends, reveal).
function spriteNode(kind, size = 28, glow = false) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = h("canvas", { "aria-hidden": "true", style: { width: size + "px", height: size + "px", verticalAlign: "middle", imageRendering: "pixelated" } });
  c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (glow) { g.shadowColor = "#ffd84a"; g.shadowBlur = 6 * dpr; }
  g.drawImage(sprite(kind, dpr, size), 0, 0, c.width, c.height);
  return c;
}

// ------------------------------------------------------------------ engine
// Runs the falling-items loop on a canvas. Modes: play (phones), spectate (TV,
// same stream, no taps), demo (how-to card, endless loop with a ghost finger).
function createDash(canvas, content, opts = {}) {
  const g2 = canvas.getContext("2d");
  const twins = !!content.twins;
  const duration = content.duration || data.duration;
  const spec = data.rounds[clamp((content.round || 1) - 1, 0, data.rounds.length - 1)];
  const schedule = opts.demo ? [] : buildSchedule(content);
  const reduced = !!opts.reduced;
  const S = opts.size || SIZE;
  const state = { caught: 0, gold: 0, bad: 0, score: 0, missed: 0, ended: false, dirty: false };
  if (opts.resume) {
    state.caught = opts.resume.caught | 0; state.gold = opts.resume.gold | 0; state.bad = opts.resume.bad | 0;
    state.score = Number(opts.resume.score) || 0;
  }
  const live = [];
  const fx = { floats: [], rings: [], bits: [] };
  let dpr = 1, W = 1, H = 1;
  let next = 0, running = true, raf = 0;
  let shakeUntil = 0, flashUntil = 0, lastDemoSpawn = 0, demoN = 0;
  const t0 = performance.now() - (opts.elapsed || 0);
  const gt = () => performance.now() - t0;
  // prefers-reduced-motion: wobble only; the game still needs things to fall.
  const wobbleScale = reduced ? 0.15 : 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  const laneW = () => (twins ? W / 2 : W);
  function pos(it, t) {
    const age = (t - it.born) / 1000;
    const lw = laneW();
    const wob = Math.sin(age * 3.4 + it.phase) * it.wobble * wobbleScale * lw;
    const x = clamp(it.lane * lw + it.x * lw + wob, it.lane * lw + S / 2, (it.lane + 1) * lw - S / 2);
    return { x, y: (it.y0 + it.speed * age) * H };
  }

  function spawn(s, born) {
    if (live.length >= data.maxLive) return;
    live.push({ id: s.id, lane: s.lane, x: s.x, kind: s.kind, speed: s.speed, phase: s.phase, wobble: s.wobble, born, y0: -0.1, hit: false, hitAt: 0 });
  }

  function burst(x, y, color, t) {
    const n = reduced ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      fx.bits.push({ x, y, vx: Math.cos(a) * (90 + Math.random() * 80), vy: Math.sin(a) * (90 + Math.random() * 80) - 60, color, born: t });
    }
  }

  // The one tap function: pointer, autoplay and the demo all come through here.
  function tap(cx, cy) {
    if (!running || state.ended || opts.spectate) return null;
    const t = gt();
    let best = null, bd = Infinity;
    for (const it of live) {
      if (it.hit) continue;
      const p = pos(it, t);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d <= HIT_R && d < bd) { bd = d; best = it; }
    }
    fx.rings.push({ x: cx, y: cy, born: t, hit: !!best });
    if (!best) return null;
    best.hit = true; best.hitAt = t;
    const p = pos(best, t);
    const pts = data.points[best.kind];
    if (best.kind === "bad") {
      state.bad++; state.score += pts;
      fx.floats.push({ x: p.x, y: p.y, text: String(pts), color: "#ff6b78", born: t });
      shakeUntil = t + 260; flashUntil = t + 180;
      if (opts.sfx) opts.sfx("error");
      if (opts.vibrate) opts.vibrate(30);
    } else {
      if (best.kind === "gold") state.gold++; else state.caught++;
      state.score += pts;
      const color = best.kind === "gold" ? "#ffd84a" : "#8cc523";
      fx.floats.push({ x: p.x, y: p.y, text: "+" + pts, color, born: t });
      burst(p.x, p.y, color, t);
      if (opts.sfx) opts.sfx("coin");
      if (opts.vibrate) opts.vibrate(10);
    }
    state.dirty = true;
    if (opts.onScore) opts.onScore(state, best.kind);
    return best.kind;
  }

  // Live items that can still be tapped, lowest on screen first.
  function targets() {
    const t = gt();
    return live.filter((it) => !it.hit).map((it) => ({ it, p: pos(it, t) })).filter((o) => o.p.y > 0 && o.p.y < H).sort((a, b) => b.p.y - a.p.y);
  }

  function demoTick(t) {
    if (t - lastDemoSpawn > 950) {
      lastDemoSpawn = t;
      const cycle = spec.goldShare > 0 ? ["good", "bad", "good", "gold", "good", "bad"] : ["good", "bad", "good", "good", "bad", "good"];
      const kind = cycle[demoN % cycle.length];
      const lane = twins ? demoN % 2 : 0;
      spawn({ id: demoN, lane, x: 0.2 + ((demoN * 7) % 5) * 0.15, kind, speed: 0.34, phase: demoN, wobble: 0.025 }, t);
      demoN++;
    }
    // A ghost finger taps the lowest good item once it is two thirds down.
    for (const o of targets()) {
      if (o.it.kind !== "bad" && o.p.y > H * 0.62) { tap(o.p.x + 6, o.p.y + 6); break; }
    }
  }

  function sparkle(g, x, y, t) {
    const k = (Math.sin(t / 110) + 1) / 2;
    const s = 2 + 4 * k;
    g.fillStyle = "#fff2a8";
    g.fillRect(x - s / 2, y - 1, s, 2);
    g.fillRect(x - 1, y - s / 2, 2, s);
  }

  function draw(t) {
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.imageSmoothingEnabled = false;
    g2.clearRect(0, 0, W, H);
    g2.save();
    if (t < shakeUntil && !reduced) g2.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    // Backdrop: night nursery with a brick floor; a divider when twins.
    g2.fillStyle = "#2b2f27"; g2.fillRect(-12, -12, W + 24, H + 24);
    g2.fillStyle = "rgba(255,255,255,.05)";
    for (let y = 18; y < H; y += 36) for (let x = 14 + ((y / 36) % 2) * 18; x < W; x += 36) g2.fillRect(x, y, 2, 2);
    g2.fillStyle = "#4b4a45"; g2.fillRect(0, H - 8, W, 8);
    g2.fillStyle = "#6b6a63"; for (let x = 0; x < W; x += 22) g2.fillRect(x, H - 8, 11, 3);
    if (twins) {
      g2.fillStyle = "#ead7b8"; g2.fillRect(W / 2 - 2, 0, 4, H);
      g2.fillStyle = "#1d1b18"; g2.fillRect(W / 2 - 4, 0, 2, H); g2.fillRect(W / 2 + 2, 0, 2, H);
    }
    // Items.
    for (const it of live) {
      const p = pos(it, t);
      const img = sprite(it.kind, dpr, S);
      let s = S;
      if (it.hit) { const k = clamp((t - it.hitAt) / 220, 0, 1); s = S * (1 + 0.6 * k); g2.globalAlpha = 1 - k; }
      if (it.kind === "gold") { g2.shadowColor = "#ffd84a"; g2.shadowBlur = 12 + 6 * Math.sin(t / 120); }
      g2.drawImage(img, Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      g2.shadowBlur = 0; g2.globalAlpha = 1;
      if (it.kind === "gold" && !it.hit) sparkle(g2, p.x + S * 0.42, p.y - S * 0.38, t + it.phase * 100);
    }
    // Particles, tap rings, floating text.
    for (let i = fx.bits.length - 1; i >= 0; i--) {
      const b = fx.bits[i], age = (t - b.born) / 1000;
      if (age > 0.45) { fx.bits.splice(i, 1); continue; }
      g2.globalAlpha = 1 - age / 0.45;
      g2.fillStyle = b.color;
      g2.fillRect(b.x + b.vx * age - 3, b.y + b.vy * age + 160 * age * age - 3, 6, 6);
    }
    g2.globalAlpha = 1;
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i], k = (t - r.born) / 260;
      if (k > 1) { fx.rings.splice(i, 1); continue; }
      g2.strokeStyle = r.hit ? "#f3e6cf" : "rgba(243,230,207,.45)";
      g2.lineWidth = 3;
      g2.globalAlpha = 1 - k;
      const rad = 10 + 26 * k;
      g2.strokeRect(r.x - rad, r.y - rad, rad * 2, rad * 2);
    }
    g2.globalAlpha = 1;
    g2.font = Math.round(S * 0.32) + "px " + FONT;
    g2.textAlign = "center";
    for (let i = fx.floats.length - 1; i >= 0; i--) {
      const f = fx.floats[i], k = (t - f.born) / 750;
      if (k > 1) { fx.floats.splice(i, 1); continue; }
      g2.globalAlpha = 1 - k * k;
      g2.fillStyle = "#1d1b18"; g2.fillText(f.text, f.x + 2, f.y - S * 0.6 - 40 * k + 2);
      g2.fillStyle = f.color; g2.fillText(f.text, f.x, f.y - S * 0.6 - 40 * k);
    }
    g2.globalAlpha = 1;
    g2.restore();
    if (t < flashUntil) { g2.fillStyle = "rgba(224,40,58,.28)"; g2.fillRect(0, 0, W, H); }
  }

  function frame() {
    if (!running) return;
    if (opts.demo && !canvas.isConnected) { stop(); return; }
    const t = gt();
    if (opts.demo) demoTick(t);
    else if (!state.ended) {
      while (next < schedule.length && schedule[next].t <= t) { spawn(schedule[next], schedule[next].t); next++; }
      if (t >= duration) { state.ended = true; if (opts.onEnd) opts.onEnd(state); }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const it = live[i];
      if (it.hit) { if (t - it.hitAt > 220) live.splice(i, 1); continue; }
      if (pos(it, t).y > H + S) { if (it.kind !== "bad") state.missed++; live.splice(i, 1); }
    }
    draw(t);
    if (state.ended && t > duration + 3000) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  }

  return { state, tap, targets, stop, time: gt, canvas };
}

// --------------------------------------------------------------- module
let game = null, stageGame = null, demoGame = null, submitTimer = null, finish = null, bestEl = null, roomBest = "";

function hudText(st) {
  return ["CAUGHT ", h("strong", null, String(st.caught + st.gold)), " · OOPS ", h("strong", null, String(st.bad)), " · SCORE ", h("strong", null, String(st.score))];
}

function stopAll() {
  clearInterval(submitTimer); submitTimer = null;
  if (game) game.stop(); game = null;
  if (stageGame) stageGame.stop(); stageGame = null;
  if (demoGame) demoGame.stop(); demoGame = null;
  bestEl = null;
}

export default {
  id: "dash",
  progressive: true,

  // How-to card: a mini stream with a ghost finger catching the good stuff.
  howtoDemo(el, content) {
    if (demoGame) demoGame.stop();
    const tv = document.documentElement.dataset.screen === "tv";
    const canvas = h("canvas", { class: "game-surface", "aria-hidden": "true", style: { display: "block", width: "100%", height: tv ? "240px" : "170px", border: "3px solid #1d1b18" } });
    const lg = tv ? 40 : 24;
    const legend = h("div", { class: "row", style: { justifyContent: "center", gap: "14px", marginTop: "8px", fontSize: ".65em", flexWrap: "wrap" } },
      h("span", null, spriteNode("good", lg), " +1"),
      (content.round || 1) >= 2 ? h("span", null, spriteNode("gold", lg, true), " +3") : null,
      h("span", null, spriteNode("bad", lg), " −1"));
    appendTo(el, canvas, legend);
    demoGame = createDash(canvas, { round: content.round || 1, twins: !!content.twins, duration: 1e9 }, { demo: true, reduced: reduceMotion(), size: tv ? 66 : SIZE });
    const mine = demoGame;
    return () => { mine.stop(); if (demoGame === mine) demoGame = null; };
  },

  mount(el, content, api) {
    stopAll();
    const you = api.you && api.you();
    const prev = you && you.myAnswer && typeof you.myAnswer === "object" ? you.myAnswer : null;
    const hud = h("p", { class: "sub", style: { margin: "2px 0 6px", fontSize: ".85em" }, "aria-live": "off" });
    bestEl = h("p", { class: "tiny center", style: { margin: "0 0 6px", minHeight: "1.4em" } }, roomBest);
    const canvas = h("canvas", { class: "game-surface", "aria-label": "Diaper Dash: tap the falling pacifiers", style: { display: "block", width: "100%", height: "70vh", maxHeight: "640px", border: "4px solid #1d1b18", boxShadow: "4px 4px 0 #000", touchAction: "none" } });
    const wrap = h("div", { class: "game-surface", style: { position: "relative" } }, canvas);
    appendTo(el,
      h("p", { class: "tiny center", style: { margin: "0 0 2px" } }, content.title + (content.twins ? " · TWO LANES" : "")),
      hud, bestEl, wrap);
    let me = null, finalSent = false;
    const send = (final) => {
      if (finalSent || !me) return;
      const st = me.state;
      st.dirty = false;
      api.submit({ caught: st.caught, gold: st.gold, bad: st.bad, score: st.score }, { final });
      if (final) finalSent = true;
    };
    const updateHud = () => { if (me) hud.replaceChildren(...hudText(me.state)); };
    // Where is the round on the server clock? Late joiners pick the stream up mid-fall.
    const elapsed = clamp((api.roundTime || content.duration) - api.timeLeft(), 0, content.duration);
    me = game = createDash(canvas, content, {
      elapsed, resume: prev, reduced: reduceMotion(), sfx: api.sfx, vibrate: api.vibrate,
      onScore() {
        updateHud();
        // In the final stretch every tap goes straight out so the last one counts.
        if (api.timeLeft() < 2500) send(false);
      },
      onEnd(st) {
        send(true);
        clearInterval(submitTimer); submitTimer = null;
        wrap.appendChild(h("div", { class: "center", style: { position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(43,47,39,.55)" } },
          h("div", { class: "stamp" }, "TIME!"),
          h("p", { class: "sub mt", style: { color: "#f3e6cf" } }, "SCORE " + st.score)));
      }
    });
    updateHud();
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      me.tap(e.clientX - r.left, e.clientY - r.top);
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    submitTimer = setInterval(() => { if (me.state.dirty) send(false); }, 1000);
    // The server clock ends the round; send the final tally on the way out regardless.
    finish = () => { if (!finalSent && (me.state.dirty || me.state.ended)) send(true); };
  },

  unmount() {
    if (finish) { try { finish(); } catch (e) { /* ignore */ } finish = null; }
    stopAll();
  },

  // The room's leader, straight from the live stat.
  onLive(stat) {
    const top = stat && stat.bars && stat.bars[0];
    roomBest = top && top.value > 0 ? "ROOM BEST: " + top.name + " · " + top.value : "";
    if (bestEl) bestEl.textContent = roomBest;
  },

  // Rehearsal: a thumb that taps the lowest good item every 300-500 ms, 85% accurate.
  autoplay() {
    const me = game;
    if (!me) return;
    const tick = () => {
      if (game !== me || me.state.ended) return;
      const list = me.targets();
      const good = list.filter((o) => o.it.kind !== "bad");
      const bad = list.filter((o) => o.it.kind === "bad");
      const pick = Math.random() < 0.85 ? (good[0] || null) : (bad[0] || good[0] || null);
      if (pick) me.tap(pick.p.x + (Math.random() - 0.5) * 16, pick.p.y + (Math.random() - 0.5) * 16);
      setTimeout(tick, 300 + Math.random() * 200);
    };
    setTimeout(tick, 300);
  },

  async reveal(el, reveal, api) {
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const top = (reveal.top || []).filter((r) => byId[r.id]);
    appendTo(el,
      h("h2", { class: "title" }, "TOP CATCHERS"),
      h("p", { class: "sub" }, (reveal.answered || 0) + " PLAYED · " + (reveal.max || 0) + " POSSIBLE"));
    const race = h("div", { class: "live-bars", style: { margin: "0 0 14px", gap: "10px" } });
    el.appendChild(race);
    const max = Math.max(1, ...top.map((r) => r.raw));
    let bestSprite = null;
    for (let i = 0; i < top.length; i++) {
      const r = top[i], p = byId[r.id];
      const isMe = you && p.id === you.id;
      const fill = h("i", { style: { width: "0%", background: i === 0 ? "#ffd84a" : "#8cc523" } });
      const v = h("span", { class: "v" }, "0");
      const sp = spriteEl(p.avatar, { size: "sm" });
      race.appendChild(h("div", { class: "lb", style: { fontSize: api.big ? "1em" : ".8em" } },
        sp, h("span", { class: "nm", style: { color: isMe ? "#ffd84a" : "" } }, p.name + (isMe ? " (YOU)" : "")), h("span", { class: "bar", style: { height: "18px" } }, fill), v));
      if (i === 0) bestSprite = sp;
      await wait(50);
      api.sfx("coin");
      fill.style.transition = "width .55s steps(10)";
      fill.style.width = Math.round(100 * r.raw / max) + "%";
      await countUp(v, 0, r.raw, 550, { onTick: () => api.sfx("tick", 0.03), every: 3 });
      v.textContent = String(r.raw);
      await wait(120);
    }
    if (bestSprite) {
      hop(bestSprite);
      api.sfx("win");
      const p = byId[top[0].id];
      el.appendChild(h("div", { class: "callout" }, "TOP CATCHER: " + p.name, h("small", null, (top[0].caught + top[0].gold) + " CAUGHT · " + top[0].gold + " GOLD · " + top[0].bad + " OOPS")));
    } else {
      el.appendChild(h("p", { class: "sub" }, "NOBODY CAUGHT A THING. THE DIAPERS WIN."));
    }
    el.appendChild(h("div", { class: "panel center", style: { marginTop: "14px" } },
      h("div", { style: { fontSize: "1.8em", color: "#6b3510", lineHeight: "1.3" } }, spriteNode("good", 30), " ", String(reveal.totalCaught || 0)),
      h("div", { class: "tiny", style: { color: "#6b3510" } }, "PACIFIERS CAUGHT BY THE ROOM"),
      reveal.totalBad ? h("div", { class: "tiny", style: { color: "#6b3510", marginTop: "4px" } }, spriteNode("bad", 18), " " + reveal.totalBad + " DIAPERS TAPPED. EW.") : null,
      reveal.avg ? h("div", { class: "tiny", style: { color: "#6b3510" } }, "AVERAGE SCORE " + reveal.avg) : null));
    if (you) {
      const mine = you.myAnswer && typeof you.myAnswer === "object" ? you.myAnswer : null;
      const caught = mine ? (mine.caught | 0) + (mine.gold | 0) : 0, bad = mine ? mine.bad | 0 : 0;
      const meRow = byId[you.id];
      el.appendChild(h("div", { class: "panel dark center" }, "YOU: ", h("strong", null, caught + " CAUGHT, " + bad + " OOPS"), h("br"),
        h("span", { class: "tiny" }, mine ? "SCORE " + (Number(mine.score) || 0) + (meRow ? " → " + meRow.roundPoints + " PTS" : "") : "YOU SAT THIS ONE OUT")));
    }
  },

  // TV / host STAGE: the same stream everyone is tapping, plus the live bar race.
  stageView(el, content, api) {
    const canvas = h("canvas", { class: "game-surface", "aria-hidden": "true", style: { display: "block", width: "100%", height: api.tv ? "56vh" : "38vh", border: "4px solid #1d1b18", boxShadow: "4px 4px 0 #000" } });
    const left = h("div", null, h("h2", { class: "title big" }, content.title), h("p", { class: "sub" }, content.subtitle || ""), canvas);
    const right = h("div", null, h("p", { class: "sub" }, "LIVE SCORES"));
    const bars = liveBars(right, { max: 10 });
    const cnt = h("div", { class: "counter center", style: { marginTop: "12px" } }, "0 PLAYING");
    right.appendChild(cnt);
    el.appendChild(api.tv ? h("div", { class: "tv-two" }, left, right) : h("div", { class: "stack" }, left, right));
    const elapsed = clamp((api.roundTime || content.duration) - api.timeLeft(), 0, content.duration);
    if (stageGame) stageGame.stop();
    stageGame = createDash(canvas, content, { elapsed, spectate: true, reduced: reduceMotion(), size: api.tv ? 66 : SIZE });
    return {
      update(live, snap) {
        if (live && live.bars) bars.update(live.bars);
        cnt.textContent = ((live && live.answered) || (snap && snap.answerCount) || 0) + " PLAYING";
      }
    };
  }
};
