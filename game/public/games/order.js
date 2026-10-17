// PUT IT IN ORDER (client). Five cream tiles between FIRST and LAST; drag them
// with pointer events (or tap ▲/▼), then LOCK IN. The reveal slides the tiles
// into the right order one by one with their hint (age / price).
import { h, appendTo, wait } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";

const GAP = 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The game's own styles (the engine's game.css is not touched).
const CSS = `
.ord-wrap { margin: 4px 0 12px; }
html[data-screen="tv"] .ord-wrap { max-width: 1100px; margin: 0 auto 12px; }
.ord-end { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: .75em; margin: 4px 2px; line-height: 1.4; }
.ord-end::before, .ord-end::after { content: ""; flex: 1; border-top: 3px dashed #1a1c17; }
.ord-list { position: relative; }
.ord-title { font-size: 1.15em; margin: 6px 0 2px; }
.ord-prompt { margin-bottom: 6px; font-size: .85em; }
.ord-tile { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 7px; padding: 5px 6px 5px 8px; min-height: 60px; margin: 0;
  background: var(--cream); color: var(--ink); border: 4px solid var(--ink);
  box-shadow: inset -4px -4px 0 var(--cream-shadow), inset 4px 4px 0 var(--cream-2), 4px 4px 0 #000;
  touch-action: none; cursor: grab; will-change: transform; }
.ord-list.ord-anim .ord-tile { transition: transform .15s ease-out, box-shadow .15s, opacity .3s, filter .3s; }
.ord-tile.lift { transition: none !important; z-index: 5; cursor: grabbing; filter: brightness(1.06);
  box-shadow: inset -4px -4px 0 var(--cream-shadow), inset 4px 4px 0 var(--cream-2), 10px 14px 0 rgba(0,0,0,.55); }
.ord-ghost { position: absolute; left: 0; right: 0; top: 0; border: 4px dashed var(--gold); opacity: .8; pointer-events: none; transition: transform .15s ease-out; }
.ord-idx { flex: none; width: 1.7em; height: 1.7em; display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--gold); font-size: .75em; }
.ord-emoji { flex: none; font-size: 2em; line-height: 1; width: 1.25em; text-align: center; }
.ord-body { flex: 1; min-width: 0; }
.ord-lbl { font-size: .8em; line-height: 1.4; }
.ord-hint { font-size: .7em; color: var(--link); margin-top: 3px; }
.ord-hint:empty { display: none; }
.ord-hide { visibility: hidden; }
.ord-arrows { flex: none; display: flex; flex-direction: column; gap: 4px; }
.ord-arrows button { width: 46px; height: 27px; padding: 0; font-size: 11px; line-height: 1; background: var(--btn); color: var(--cream-2); border: 3px solid var(--ink); box-shadow: 2px 2px 0 #000; }
.ord-lock { position: sticky; bottom: 8px; z-index: 3; margin-top: 4px; }
.ord-arrows button:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: 1px 1px 0 #000; }
.ord-arrows button:disabled { opacity: .35; cursor: default; }
.ord-grip { flex: none; color: var(--link); font-size: 1.5em; line-height: 1; opacity: .8; padding: 0 2px; }
.ord-mark { flex: none; width: 1.3em; text-align: center; font-size: 1.5em; line-height: 1; }
.ord-mark.ok { color: var(--green-dark); }
.ord-mark.no { color: var(--red); }
.ord-tile.pending { opacity: .4; filter: grayscale(.8); }
.ord-tile.placed { opacity: 1; filter: none; animation: ord-flash .45s steps(3) 1; }
@keyframes ord-flash { 0% { filter: brightness(1.8); } 100% { filter: none; } }
.ord-tip { text-align: center; color: var(--muted); font-size: .7em; margin: 8px 0 12px; }
.ord-stage-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin: 12px 0; }
.ord-stage-card { flex: 1 1 150px; max-width: 290px; min-width: 140px; text-align: center; padding: 14px 10px; margin: 0; }
.ord-stage-card .ord-emoji { display: block; font-size: 3em; width: auto; margin-bottom: 10px; }
.ord-stage-card .ord-lbl { font-size: .75em; }
html[data-screen="tv"] .ord-tile { min-height: 2.6em; padding: .25em .8em; }
html[data-screen="tv"] .ord-lbl { font-size: .85em; line-height: 1.25; }
html[data-screen="tv"] .ord-hint { margin-top: 0; }
html[data-screen="tv"] .ord-emoji { font-size: 1.6em; }
.ord-callouts.big { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.ord-callouts.big .callout { margin-top: 0; }
.ord-demo .ord-tile { min-height: 46px; padding: 4px 8px; gap: 6px; cursor: default; }
.ord-demo .ord-lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: .7em; }
.ord-demo .ord-emoji { font-size: 1.4em; }
.ord-demo .ord-idx { font-size: .6em; }
.ord-demo .ord-list.ord-anim .ord-tile { transition: transform .6s ease-in-out, box-shadow .2s; }
`;

let styled = false;
function ensureStyles() {
  if (styled || document.getElementById("ord-css")) { styled = true; return; }
  styled = true;
  document.head.appendChild(h("style", { id: "ord-css" }, CSS));
}

const endLabel = (text) => h("div", { class: "ord-end", "aria-hidden": "true" }, text);

// A vertical list of tiles laid out with transforms (so reordering animates).
// opts: arrows (▲/▼ buttons), grip (≡), hints (prefilled, hidden until shown), marks (✓/✗ slot), tileClass
function makeList(host, items, opts = {}) {
  const list = h("div", { class: "ord-list" });
  const ghost = h("div", { class: "ord-ghost", hidden: true, "aria-hidden": "true" });
  list.appendChild(ghost);
  const order = items.map((it) => it.key);
  const n = order.length;
  const tiles = {};
  let slotH = 80;
  items.forEach((it) => {
    const up = opts.arrows ? h("button", { type: "button", "aria-label": "Move " + it.label + " up" }, "▲") : null;
    const dn = opts.arrows ? h("button", { type: "button", "aria-label": "Move " + it.label + " down" }, "▼") : null;
    const el = h("div", { class: "ord-tile" + (opts.tileClass ? " " + opts.tileClass : ""), dataset: { key: it.key } },
      h("span", { class: "ord-idx", "aria-hidden": "true" }, ""),
      h("span", { class: "ord-emoji", "aria-hidden": "true" }, it.emoji || "🍼"),
      h("div", { class: "ord-body" },
        h("div", { class: "ord-lbl" }, it.label),
        h("div", { class: "ord-hint" + (opts.hints ? " ord-hide" : "") }, opts.hints ? (it.hint || "") : "")),
      opts.marks ? h("span", { class: "ord-mark" }, "") : null,
      opts.arrows ? h("div", { class: "ord-arrows" }, up, dn) : null,
      opts.grip ? h("span", { class: "ord-grip", "aria-hidden": "true" }, "≡") : null);
    if (up) up.addEventListener("click", () => ctl.moveBy(it.key, -1, true));
    if (dn) dn.addEventListener("click", () => ctl.moveBy(it.key, 1, true));
    tiles[it.key] = { el, up, dn };
    list.appendChild(el);
  });
  host.appendChild(list);

  function measure() {
    let max = 0;
    order.forEach((k) => { max = Math.max(max, tiles[k].el.offsetHeight); });
    if (max > 0) slotH = max + GAP;
    list.style.height = (n * slotH - GAP) + "px";
    ghost.style.height = (slotH - GAP) + "px";
  }
  function layout(skipKey) {
    order.forEach((k, i) => {
      const t = tiles[k];
      if (k !== skipKey) t.el.style.transform = "translateY(" + (i * slotH) + "px)";
      t.el.querySelector(".ord-idx").textContent = String(i + 1);
      if (t.up) t.up.disabled = i === 0;
      if (t.dn) t.dn.disabled = i === n - 1;
    });
  }
  function place(key, idx) {
    const from = order.indexOf(key);
    if (from < 0) return false;
    order.splice(from, 1);
    order.splice(clamp(idx, 0, n - 1), 0, key);
    return true;
  }
  const ctl = {
    el: list, order, tiles, ghost, n,
    slot: () => slotH,
    measure, layout,
    relayout() { measure(); layout(); },
    moveTo(key, idx) { place(key, idx); layout(); },
    moveBy(key, d, user) {
      const i = order.indexOf(key), j = i + d;
      if (i < 0 || j < 0 || j >= n) return false;
      place(key, j); layout();
      if (opts.onChange) opts.onChange(user);
      return true;
    },
    place
  };
  measure(); layout();
  requestAnimationFrame(() => list.classList.add("ord-anim"));
  return ctl;
}

// Pointer dragging: the pressed tile lifts and follows the finger, the others
// shift as the drop slot changes, the drop snaps into place.
function attachDrag(ctl, { onDrop, onSlot, onLift }) {
  let drag = null;
  const stops = [];
  ctl.order.forEach((key) => {
    const tile = ctl.tiles[key].el;
    const down = (e) => {
      if (drag || e.target.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try { tile.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const idx = ctl.order.indexOf(key);
      drag = { key, id: e.pointerId, startY: e.clientY, baseY: idx * ctl.slot(), idx, moved: false };
      tile.classList.add("lift");
      tile.style.transform = "translateY(" + drag.baseY + "px) scale(1.03)";
      ctl.ghost.style.transform = "translateY(" + drag.baseY + "px)";
      ctl.ghost.hidden = false;
      if (onLift) onLift();
    };
    const move = (e) => {
      if (!drag || e.pointerId !== drag.id || drag.key !== key) return;
      e.preventDefault();
      const slotH = ctl.slot();
      const dy = e.clientY - drag.startY;
      if (Math.abs(dy) > 3) drag.moved = true;
      const y = clamp(drag.baseY + dy, -slotH * 0.4, (ctl.n - 1) * slotH + slotH * 0.4);
      tile.style.transform = "translateY(" + y + "px) scale(1.03)";
      const idx = clamp(Math.round(y / slotH), 0, ctl.n - 1);
      if (idx !== drag.idx) {
        drag.idx = idx;
        ctl.place(key, idx);
        ctl.layout(key);
        ctl.ghost.style.transform = "translateY(" + (idx * slotH) + "px)";
        if (onSlot) onSlot();
      }
    };
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id || drag.key !== key) return;
      try { tile.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const moved = drag.moved || drag.idx !== ctl.order.indexOf(key);
      drag = null;
      tile.classList.remove("lift");
      ctl.ghost.hidden = true;
      ctl.layout();
      if (onDrop) onDrop(moved);
    };
    tile.addEventListener("pointerdown", down);
    tile.addEventListener("pointermove", move);
    tile.addEventListener("pointerup", up);
    tile.addEventListener("pointercancel", up);
    tile.addEventListener("lostpointercapture", up);
    stops.push(() => {
      tile.removeEventListener("pointerdown", down);
      tile.removeEventListener("pointermove", move);
      tile.removeEventListener("pointerup", up);
      tile.removeEventListener("pointercancel", up);
      tile.removeEventListener("lostpointercapture", up);
    });
  });
  return () => stops.forEach((f) => f());
}

function validKeys(a, correct) {
  if (!Array.isArray(a) || !Array.isArray(correct) || a.length !== correct.length) return false;
  const set = new Set(correct);
  return a.every((k) => set.has(k)) && new Set(a).size === a.length;
}

let current = null;       // the mounted round: { ctl, lockIn, moveBy, cleanups }
let demoStop = null;

function stopCurrent() {
  if (current) { current.cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); current = null; }
}

export default {
  id: "order",
  progressive: false,

  // How-to demo: three mini tiles, the bottom one drags into first place on a loop.
  howtoDemo(el, content) {
    ensureStyles();
    if (demoStop) demoStop();
    const src = (content && content.items && content.items.length >= 3) ? content.items.slice(0, 3) : [
      { key: "a", label: "LAY BABY DOWN", emoji: "👶" }, { key: "b", label: "OPEN THE DIAPER", emoji: "💩" }, { key: "c", label: "FASTEN THE TABS", emoji: "✅" }];
    const items = [src[1], src[2], src[0]];       // the first one starts at the bottom
    const wrap = h("div", { class: "ord-wrap ord-demo" });
    appendTo(wrap, endLabel(content && content.topLabel ? content.topLabel : "FIRST"));
    const ctl = makeList(wrap, items, { grip: true });
    appendTo(wrap, endLabel(content && content.bottomLabel ? content.bottomLabel : "LAST"));
    el.appendChild(wrap);
    const mover = ctl.tiles[src[0].key].el;
    const timers = [];
    let alive = true;
    const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
    const loop = () => {
      ctl.relayout();
      later(() => { mover.classList.add("lift"); mover.style.transform = "translateY(" + (2 * ctl.slot()) + "px) scale(1.03)"; }, 700);
      later(() => { ctl.place(src[0].key, 0); ctl.layout(src[0].key); mover.style.transform = "translateY(0px) scale(1.03)"; }, 1000);
      later(() => { mover.classList.remove("lift"); ctl.layout(); }, 1700);
      later(() => { ctl.el.classList.remove("ord-anim"); ctl.place(src[0].key, 2); ctl.layout(); }, 3000);
      later(() => { ctl.el.classList.add("ord-anim"); loop(); }, 3100);
    };
    loop();
    demoStop = () => { alive = false; timers.forEach(clearTimeout); demoStop = null; };
    return demoStop;
  },

  mount(el, content, api) {
    ensureStyles();
    stopCurrent();
    const items = content.items || [];
    const correctKeys = items.map((it) => it.key);
    const byKey = Object.fromEntries(items.map((it) => [it.key, it]));
    const you = api.you && api.you();
    const prev = you && validKeys(you.myAnswer, correctKeys) ? you.myAnswer : null;
    const startItems = (prev || correctKeys).map((k) => byKey[k]);

    const root = h("div", { class: "game-surface ord-wrap" });
    const btn = h("button", { class: "btn primary ord-lock", type: "button" }, h("i", { class: "tri" }), prev ? "UPDATE ORDER" : "LOCK IN");
    const prompt = h("p", { class: "sub ord-prompt" }, content.prompt || "");
    let touched = !!prev;
    // The current order counts even without LOCK IN: every change is sent as a soft
    // (non-final) answer so time running out locks people in where they are.
    let softTimer = null, lastSoft = 0;
    const soft = () => {
      const send = () => { softTimer = null; lastSoft = Date.now(); api.submit(ctl.order.slice(), { final: false }); };
      if (Date.now() - lastSoft > 300) send(); else if (!softTimer) softTimer = setTimeout(send, 320);
    };
    appendTo(el, h("h2", { class: "title ord-title" }, content.title || ""), prompt);
    appendTo(root, endLabel(content.topLabel || "FIRST"));
    const ctl = makeList(root, startItems, { arrows: true, grip: true, onChange: (user) => { if (user) { touched = true; api.sfx("thunk"); api.vibrate(12); soft(); } } });
    appendTo(root, endLabel(content.bottomLabel || "LAST"));
    appendTo(el, root, btn);

    const inst = { ctl, cleanups: [] };
    inst.lockIn = () => {
      if (softTimer) { clearTimeout(softTimer); softTimer = null; }
      api.submit(ctl.order.slice(), { label: "ORDER LOCKED" });
      btn.textContent = "UPDATE ORDER";
    };
    inst.cleanups.push(() => { if (softTimer) clearTimeout(softTimer); });
    inst.moveBy = (key, d) => ctl.moveBy(key, d, false);
    btn.addEventListener("click", inst.lockIn);
    inst.cleanups.push(attachDrag(ctl, {
      onLift: () => api.sfx("blip"),
      onSlot: () => api.sfx("tick", 0.03),
      onDrop: () => { touched = true; api.sfx("thunk"); api.vibrate(15); soft(); }
    }));
    const onResize = () => ctl.relayout();
    window.addEventListener("resize", onResize);
    inst.cleanups.push(() => window.removeEventListener("resize", onResize));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current === inst) ctl.relayout(); });
    const nudge = setTimeout(() => { if (!touched) { prompt.classList.add("blink"); setTimeout(() => prompt.classList.remove("blink"), 1500); } }, 4000);
    inst.cleanups.push(() => clearTimeout(nudge));
    current = inst;
  },

  unmount() {
    stopCurrent();
    if (demoStop) demoStop();
  },

  // Practice only: the practice content carries `correct`, so the phone can grade the try.
  practiceResult(answer, content) {
    const c = content && Array.isArray(content.correct) ? content.correct : null;
    if (!c) return null;
    const ok = Array.isArray(answer) && answer.length === c.length && answer.every((k, i) => k === c[i]);
    return ok ? { ok: true, text: "PERFECT ORDER!" } : { ok: false, text: "NOT QUITE: ONE AT THE TOP, FIVE AT THE BOTTOM." };
  },

  // Rehearsal only: a few ▲/▼ moves, then LOCK IN through the same path as a tap.
  autoplay(el, content, api) {
    const inst = current;
    if (!inst) return;
    const steps = 1 + Math.floor(Math.random() * 3);
    let done = 0;
    const step = () => {
      if (current !== inst) return;
      const key = inst.ctl.order[Math.floor(Math.random() * inst.ctl.order.length)];
      inst.moveBy(key, Math.random() < 0.5 ? -1 : 1);
      if (++done < steps) setTimeout(step, 250);
      else setTimeout(() => { if (current === inst) inst.lockIn(); }, 350);
    };
    setTimeout(step, 500 + Math.random() * 1200);
  },

  async reveal(el, reveal, api) {
    ensureStyles();
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const correct = reveal.correct || [];
    const items = reveal.items || [];
    const byKey = Object.fromEntries(items.map((it) => [it.key, it]));
    const mine = you && validKeys(you.myAnswer, correct) ? you.myAnswer : null;
    const start = (mine || (validKeys(reveal.shuffled, correct) ? reveal.shuffled : null) || correct).slice();

    appendTo(el, h("h2", { class: "title" }, "THE RIGHT ORDER"),
      h("p", { class: "sub" }, mine ? "YOUR ORDER... AND THE TRUTH" : (you ? "YOU DIDN'T LOCK IN THIS ROUND" : "")));
    const wrap = h("div", { class: "ord-wrap" });
    appendTo(wrap, endLabel(reveal.topLabel || "FIRST"));
    const ctl = makeList(wrap, start.map((k) => byKey[k]).filter(Boolean), { hints: true, marks: !!mine, tileClass: "pending" });
    appendTo(wrap, endLabel(reveal.bottomLabel || "LAST"));
    el.appendChild(wrap);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ctl.relayout());

    await wait(api.big ? 1000 : 600);
    for (let i = 0; i < correct.length; i++) {
      const k = correct[i];
      const t = ctl.tiles[k];
      if (!t) continue;
      ctl.moveTo(k, i);
      t.el.classList.remove("pending");
      t.el.classList.add("placed");
      t.el.querySelector(".ord-hint").classList.remove("ord-hide");
      if (mine) {
        const ok = mine[i] === k;
        const m = t.el.querySelector(".ord-mark");
        m.textContent = ok ? "✓" : "✗";
        m.classList.add(ok ? "ok" : "no");
      }
      api.sfx("pop");
      await wait(500);
    }

    // Your tally (phones), then the room.
    if (mine) {
      const right = correct.filter((k, i) => mine[i] === k).length;
      el.appendChild(h("div", { class: "panel dark center" }, "YOU PLACED ", h("strong", null, right + " OF " + correct.length), " IN THE RIGHT SPOT", h("br"),
        h("span", { class: "tiny" }, right === correct.length ? "PERFECT ORDER!" : right === 0 ? "EVERY SINGLE ONE WAS OFF. BOLD." : "SO CLOSE.")));
    }
    const n = reveal.perfect || 0;
    const callouts = h("div", { class: "ord-callouts" + (api.big ? " big" : "") });
    callouts.appendChild(h("div", { class: "callout" + (n ? " green" : "") }, "PERFECT ORDER: " + n + (n === 1 ? " PLAYER" : " PLAYERS"),
      h("small", null, n ? "NAILED ALL " + correct.length : "NOBODY GOT THEM ALL")));
    const pos = reveal.positions || {};
    const answered = reveal.answered || 0;
    if (answered > 0 && correct.length) {
      let hard = correct[0];
      correct.forEach((k) => { if ((pos[k] ? pos[k].right : 0) < (pos[hard] ? pos[hard].right : 0)) hard = k; });
      const pct = Math.round(100 * ((pos[hard] && pos[hard].right) || 0) / answered);
      callouts.appendChild(h("div", { class: "callout red" }, "HARDEST STEP: " + ((byKey[hard] && byKey[hard].label) || hard), h("small", null, "ONLY " + pct + "% GOT IT")));
    }
    el.appendChild(callouts);
    const best = (reveal.best || []).map((id) => byId[id]).filter(Boolean);
    if (best.length) {
      const row = h("div", { class: "row", style: { justifyContent: "center", gap: "14px", marginTop: "10px" } });
      best.forEach((r, i) => row.appendChild(h("div", { class: "center" }, spriteEl(r.avatar, { cls: "hop" }), h("div", { class: "tiny" }, (i === 0 ? "BEST: " : "") + r.name))));
      el.appendChild(h("p", { class: "sub mt" }, "BEST ORDERS"));
      el.appendChild(row);
    }
  },

  // TV / host STAGE during play: the five tiles as seen on the phones (shuffled), and the lock-in count.
  stageView(el, content, api) {
    ensureStyles();
    const cards = (content.items || []).map((it) => h("div", { class: "panel ord-stage-card" },
      h("span", { class: "ord-emoji", "aria-hidden": "true" }, it.emoji || "🍼"), h("div", { class: "ord-lbl" }, it.label)));
    appendTo(el, h("h2", { class: "title big" }, content.title || ""), h("p", { class: "sub" }, content.prompt || ""),
      h("div", { class: "ord-stage-row" }, ...cards),
      h("p", { class: "sub" }, "ON YOUR PHONE: " + (content.topLabel || "FIRST") + " AT THE TOP, " + (content.bottomLabel || "LAST") + " AT THE BOTTOM"));
    const cnt = h("div", { class: "counter center" }, "0 LOCKED IN");
    el.appendChild(cnt);
    return { update(live, snap) { cnt.textContent = ((live && live.answered) || (snap && snap.answerCount) || 0) + " LOCKED IN"; } };
  }
};
