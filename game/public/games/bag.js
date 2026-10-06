// FIT THE DIAPER BAG (client). A Tetris-style inventory: drag items from the
// tray into the bag where they snap to the grid, tap an item to rotate it,
// drag it back over the tray to remove it. Pointer events only. During a drag
// the ghost and the highlight squares move with transforms; nothing reads
// layout inside pointermove, so it stays smooth on a mid-range phone.
import { h, appendTo, clear, wait, countUp } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";
import { liveBars } from "../engine/stage.js";
import { rotate, cells, dims, parseMask, canPlace, occupancy, fillStats, validPlacement, firstFit } from "./bag-shared.js";

const DRAG_START = 6;   // px of travel before a press becomes a drag (less is a tap)
const MINI = 10;        // tray mini-grid cell size in px
const MAX_CELLS = 9;    // biggest shape (diaper pack) -> highlight squares to pre-make

// Styles live here because a game may not touch game.css. Injected once.
const CSS = `
.bag-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.bag-title { font-size: .95em; margin: 0; color: var(--cream); text-align: center; text-shadow: 2px 2px 0 #1d1b18; line-height: 1.3; }
.bag-hud { font-size: .72em; color: var(--cream-2); text-align: center; letter-spacing: .02em; line-height: 1.4; min-height: 1.4em; }
.bag-hud b { font-weight: 400; color: var(--gold); }
.bag-hud b.ok { color: var(--green); }
.bag-board { position: relative; flex: none; }
.bag-board > svg { position: absolute; left: 0; top: 0; display: block; }
.bag-grid { position: absolute; }
.bag-layer { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.bag-tile { position: absolute; left: 0; top: 0; touch-action: none; cursor: grab; }
.bag-tile i, .bag-mini i { position: absolute; display: block; box-shadow: inset 0 0 0 2px rgba(29,27,24,.55), inset 4px 4px 0 rgba(255,255,255,.42), inset -4px -4px 0 rgba(0,0,0,.12); }
.bag-mini { position: relative; }
.bag-mini i { box-shadow: inset 0 0 0 1px rgba(29,27,24,.65), inset 2px 2px 0 rgba(255,255,255,.4); }
.bag-tile .em, .bag-mini .em { position: absolute; display: flex; align-items: center; justify-content: center; line-height: 1; letter-spacing: 0; text-transform: none; pointer-events: none; filter: drop-shadow(1px 1px 0 rgba(0,0,0,.3)); }
.bag-tile.lifted { opacity: .3; }
.bag-tile.shake, .bag-tray .tt.shake { animation: bag-shake .32s steps(6) 1; }
.bag-tile.shake i { box-shadow: inset 0 0 0 3px var(--red); }
.bag-tray .tt.shake { box-shadow: inset 0 0 0 3px var(--red); }
.bag-tile.drop-in { animation: bag-drop .25s steps(5) 1; }
.bag-tile.snap { animation: bag-snap .25s steps(4) 1; }
@keyframes bag-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@keyframes bag-drop { from { transform: translateY(-70px); opacity: 0; } 70% { transform: translateY(4px); opacity: 1; } to { transform: none; } }
@keyframes bag-snap { 50% { transform: scale(1.12); } }
.bag-hl { pointer-events: none; }
.bag-hl i { position: absolute; left: 0; top: 0; display: none; will-change: transform; }
.bag-hl i.ok { background: rgba(140,197,35,.62); box-shadow: inset 0 0 0 3px var(--green-dark); }
.bag-hl i.bad { background: rgba(224,40,58,.62); box-shadow: inset 0 0 0 3px #7a1220; }
.bag-hl i.dim { background: rgba(224,40,58,.22); box-shadow: inset 0 0 0 2px rgba(122,18,32,.6); }
.bag-ghost { position: fixed; left: 0; top: 0; z-index: 60; pointer-events: none; opacity: .85; will-change: transform; }
.bag-ghost.back { transition: transform .18s steps(4); opacity: .45; }
.bag-tray-label { width: 100%; display: flex; justify-content: space-between; font-size: .62em; color: var(--muted); padding: 0 6px; }
.bag-tray { width: 100%; display: flex; gap: 8px; align-items: stretch; padding: 8px; overflow-x: auto; overflow-y: hidden; touch-action: none; background: var(--bg-dark); border: 4px solid var(--ink); box-shadow: inset -4px -4px 0 #1a1c17, inset 4px 4px 0 #4a5042, 4px 4px 0 #000; scrollbar-width: none; min-height: 110px; }
.bag-tray::-webkit-scrollbar { display: none; }
.bag-tray.drop { box-shadow: inset 0 0 0 5px var(--green), 4px 4px 0 #000; }
.bag-tray .tt { flex: none; width: 74px; height: 86px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; background: var(--cream); color: var(--ink); border: 3px solid var(--ink); box-shadow: inset -3px -3px 0 var(--cream-shadow), inset 3px 3px 0 var(--cream-2); cursor: grab; touch-action: none; }
.bag-tray .tt.src { opacity: .35; }
.bag-tray .tt .mini-wrap { position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.bag-tray .tt .nm { font-size: 7px; line-height: 1; color: var(--link); white-space: nowrap; }
.bag-tray .tt .nm.ess { color: #b1261e; }
.bag-tray .msg { flex: 1; align-self: center; text-align: center; font-size: .7em; color: var(--muted); padding: 8px 6px; line-height: 1.5; }
.bag-race .lb .nm { width: 8em; }
.bag-race .lb.win .bar i { background: var(--gold); }
.bag-race .lb .v { width: 3.4em; }
.bag-stage { display: flex; gap: 40px; align-items: flex-start; justify-content: center; }
.bag-stage > div { flex: 1; min-width: 0; }
.bag-demo { position: relative; margin: 0 auto; }
.bag-demo .bag-tile { will-change: transform; }
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  if (!document.getElementById("bag-css")) document.head.appendChild(h("style", { id: "bag-css" }, CSS));
}

// ------------------------------------------------------------ drawing
// The bag: an SVG silhouette (4 px ink outline around the interior, a drop
// shadow and a pixel handle) plus an absolutely positioned grid on top of it
// where tiles and highlights live. Grid cell (x, y) sits at (x*cell, y*cell).
let patSeq = 0;
export function boardEl(mask, cell, { handle = true, shadow = true } = {}) {
  const m = parseMask(mask);
  const PAD = 4, SH = shadow ? 4 : 0;
  const HT = handle ? Math.round(cell * 0.7) + 4 : 0;
  const ox = PAD, oy = PAD + HT;
  const W = m.w * cell + PAD * 2 + SH, H = m.h * cell + PAD * 2 + HT + SH;
  const id = "bagdots" + (patSeq++);
  let inkR = "", fillR = "";
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.has(x, y)) continue;
      inkR += `<rect x="${ox + x * cell - PAD}" y="${oy + y * cell - PAD}" width="${cell + PAD * 2}" height="${cell + PAD * 2}"/>`;
      fillR += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}"/>`;
    }
  }
  let handleP = "";
  if (handle && m.h) {
    // The handle stands on the ink above the top row's filled span.
    let L = -1, R = -1;
    for (let x = 0; x < m.w; x++) if (m.has(x, 0)) { if (L < 0) L = x; R = x; }
    if (L >= 0) {
      const inset = R - L + 1 >= 5 ? 1 : 0;
      const x0 = Math.round(ox + (L + inset) * cell + (inset ? cell / 2 : -2));
      const x1 = Math.round(ox + (R + 1 - inset) * cell - (inset ? cell / 2 : -2));
      handleP = `M${x0} ${oy} V6 H${x1} V${oy}`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">
<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ead7b8"/><rect x="2" y="2" width="2" height="2" fill="#cdb28c"/></pattern></defs>
${shadow ? `<g transform="translate(${SH} ${SH})"><g fill="#000">${inkR}</g>${handleP ? `<path d="${handleP}" fill="none" stroke="#000" stroke-width="4"/>` : ""}</g>` : ""}
${handleP ? `<path d="${handleP}" fill="none" stroke="#1d1b18" stroke-width="4"/>` : ""}
<g fill="#1d1b18">${inkR}</g>
<g fill="url(#${id})" stroke="#d8c3a0" stroke-width="1">${fillR}</g>
</svg>`;
  const board = h("div", { class: "bag-board", style: { width: W + "px", height: H + "px" } });
  board.appendChild(h("div", { html: svg }).firstElementChild);
  const grid = h("div", { class: "bag-grid", style: { left: ox + "px", top: oy + "px", width: m.w * cell + "px", height: m.h * cell + "px" } });
  board.appendChild(grid);
  return { board, grid, m, cell, ox, oy, W, H };
}

// One item as a block tile: a coloured square per cell with a pixel bevel and
// the glyph on the cell nearest the middle (or over the whole box for the tray).
export function tileEl(item, rot, cell, { cls = "bag-tile", emojiCenter = false, emojiPx = 0 } = {}) {
  const shape = rotate(item.shape || ["#"], rot || 0);
  const cs = cells(shape), d = dims(shape);
  const el = h("div", { class: cls, style: { width: d.w * cell + "px", height: d.h * cell + "px" } });
  cs.forEach(([x, y]) => el.appendChild(h("i", { style: { left: x * cell + "px", top: y * cell + "px", width: cell + "px", height: cell + "px", background: item.color || "#ddd" } })));
  let ex = 0, ey = 0, ew = d.w * cell, eh = d.h * cell;
  if (!emojiCenter) {
    // Whole box when its centre point is on the shape, else the cell nearest the centroid.
    const cx = d.w / 2, cy = d.h / 2;
    const on = (x, y) => shape[y] && shape[y][x] === "#";
    const centred = on(Math.floor(cx - 1e-6), Math.floor(cy - 1e-6)) && on(Math.floor(cx + 1e-6), Math.floor(cy + 1e-6)) && on(Math.floor(cx - 1e-6), Math.floor(cy + 1e-6)) && on(Math.floor(cx + 1e-6), Math.floor(cy - 1e-6));
    if (!centred) {
      let gx = 0, gy = 0;
      cs.forEach(([x, y]) => { gx += x; gy += y; });
      gx /= cs.length; gy /= cs.length;
      let best = cs[0], bd = Infinity;
      cs.forEach(([x, y]) => { const dd = (x - gx) ** 2 + (y - gy) ** 2; if (dd < bd - 1e-9) { bd = dd; best = [x, y]; } });
      ex = best[0] * cell; ey = best[1] * cell; ew = cell; eh = cell;
    }
  }
  const big = ew >= 2 * cell && eh >= 2 * cell;
  const fs = emojiPx || Math.round(cell * (big ? 0.95 : 0.64));
  el.appendChild(h("span", { class: "em", style: { left: ex + "px", top: ey + "px", width: ew + "px", height: eh + "px", fontSize: fs + "px" } }, item.emoji || "🎁"));
  return el;
}

function shake(el) {
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 360);
}

// ------------------------------------------------------------- round
let inst = null;      // the mounted round (autoplay and unmount reach it)
let demoTimers = [];

function mountRound(el, content, api) {
  const mask = content.mask || [];
  const m = parseMask(mask);
  const itemsById = {};
  (content.items || []).forEach((it) => { itemsById[it.id] = it; });
  const order = (content.items || []).map((it) => it.id);
  const avail = Math.max(240, el.clientWidth || 350);
  const cell = Math.max(20, Math.min(36, Math.floor((avail - 16) / Math.max(1, m.w))));
  const LIFT = Math.round(cell * 0.75);   // the ghost floats above the fingertip

  // A reload mid-round keeps what was packed.
  const placed = [];
  const you0 = api.you && api.you();
  if (you0 && you0.myAnswer && Array.isArray(you0.myAnswer.placed)) placed.push(...validPlacement(mask, you0.myAnswer.placed, itemsById));

  const { board, grid } = boardEl(mask, cell);
  const tilesLayer = h("div", { class: "bag-layer bag-tiles" });
  const hl = h("div", { class: "bag-layer bag-hl", "aria-hidden": "true" });
  const hlCells = [];
  for (let i = 0; i < MAX_CELLS; i++) { const s = h("i", { style: { width: cell + "px", height: cell + "px" } }); hlCells.push(s); hl.appendChild(s); }
  appendTo(grid, tilesLayer, hl);
  const hud = h("div", { class: "bag-hud", "aria-live": "polite" });
  const leftLbl = h("span", null, "");
  const tray = h("div", { class: "bag-tray", role: "list", "aria-label": "Items to pack" });
  const trayMsg = h("div", { class: "msg", hidden: true }, "ALL PACKED! TAP AN ITEM TO ROTATE, DRAG IT DOWN HERE TO TAKE IT OUT.");
  appendTo(el, h("div", { class: "bag-wrap" },
    h("h2", { class: "bag-title" }, content.title || "FIT THE DIAPER BAG"),
    hud, board,
    h("div", { class: "bag-tray-label" }, h("span", null, "TRAY · DRAG INTO THE BAG · TAP TO ROTATE"), leftLbl),
    tray));

  const tiles = new Map();      // id -> tile in the bag
  const trayTiles = new Map();  // id -> tile in the tray
  const trayRot = {};           // id -> pre-rotation chosen in the tray
  let drag = null, ghost = null, gridRect = null, trayRect = null;
  const me = { placed, itemsById, mask, timers: [], place, remaining: () => order.filter((id) => !placed.some((p) => p.key === id)), destroy };

  // ---- tray
  function drawMini(tt, item) {
    const mw = tt.querySelector(".mini-wrap");
    clear(mw);
    mw.appendChild(tileEl(item, trayRot[item.id] || 0, MINI, { cls: "bag-mini", emojiCenter: true, emojiPx: 18 }));
  }
  function trayTile(item) {
    const tt = h("div", { class: "tt", role: "listitem", tabindex: "0", "aria-label": item.name + (item.essential ? ", essential" : ""), dataset: { id: item.id } },
      h("div", { class: "mini-wrap" }),
      h("div", { class: "nm" + (item.essential ? " ess" : "") }, item.name));
    drawMini(tt, item);
    bindPointer(tt, "tray");
    tt.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const rot = trayRot[item.id] || 0;
      const pos = firstFit(m, placed, item, rot, itemsById);
      if (pos) place(item.id, pos.x, pos.y, rot, "tray"); else { shake(tt); api.sfx("error"); }
    });
    return tt;
  }
  order.forEach((id) => { const tt = trayTile(itemsById[id]); trayTiles.set(id, tt); tray.appendChild(tt); });
  tray.appendChild(trayMsg);
  // Dragging the tray background (or a sideways drag on a tile) pans it.
  tray.addEventListener("pointerdown", (e) => {
    if (drag || e.target.closest(".tt")) return;
    drag = { mode: "pan", pid: e.pointerId, sx: e.clientX, scroll0: tray.scrollLeft, elm: tray };
    try { tray.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  tray.addEventListener("pointermove", (e) => { if (drag && drag.elm === tray && e.pointerId === drag.pid) tray.scrollLeft = drag.scroll0 - (e.clientX - drag.sx); });
  const endPan = (e) => { if (drag && drag.elm === tray && e.pointerId === drag.pid) drag = null; };
  tray.addEventListener("pointerup", endPan);
  tray.addEventListener("pointercancel", endPan);

  // ---- bag tiles
  function drawTile(entry) {
    const old = tiles.get(entry.key);
    if (old) old.remove();
    const item = itemsById[entry.key];
    const t = tileEl(item, entry.rot, cell);
    t.dataset.id = entry.key;
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("aria-label", item.name + ": tap to rotate, drag to move");
    t.style.left = entry.x * cell + "px";
    t.style.top = entry.y * cell + "px";
    bindPointer(t, "bag");
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rotatePlaced(entry.key); }
      else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); removeItem(entry.key); }
    });
    tiles.set(entry.key, t);
    tilesLayer.appendChild(t);
    return t;
  }

  // ---- state changes
  function refresh() {
    const st = fillStats(mask, placed, itemsById);
    clear(hud);
    appendTo(hud, "FILLED ", h("b", null, st.fillPct + "%"), " · VALUE ", h("b", null, String(st.value)), " · ESSENTIALS ", h("b", { class: st.missingEssentials === 0 ? "ok" : "" }, st.essentialsPlaced + "/" + st.essentialsTotal));
    const left = me.remaining().length;
    leftLbl.textContent = left ? left + " LEFT ▶" : "ALL IN!";
    trayMsg.hidden = left > 0;
    return st;
  }
  function changed() {
    refresh();
    api.submit({ placed: placed.map((p) => ({ key: p.key, x: p.x, y: p.y, rot: p.rot })) }, { final: false });
  }
  function place(id, x, y, rot, src) {
    const item = itemsById[id];
    if (!item || !canPlace(m, placed, item, x, y, rot, itemsById, id)) return false;
    const idx = placed.findIndex((p) => p.key === id);
    const entry = { key: id, x, y, rot };
    if (idx >= 0) placed[idx] = entry; else placed.push(entry);
    const t = drawTile(entry);
    if (src === "tray") { t.classList.add("snap"); setTimeout(() => t.classList.remove("snap"), 260); }
    const tt = trayTiles.get(id);
    if (tt) { tt.hidden = true; tt.classList.remove("src"); }
    api.sfx("thunk");
    if (api.vibrate) api.vibrate(10);
    changed();
    return true;
  }
  function removeItem(id) {
    const idx = placed.findIndex((p) => p.key === id);
    if (idx < 0) return;
    trayRot[id] = placed[idx].rot;
    placed.splice(idx, 1);
    const t = tiles.get(id);
    if (t) { t.remove(); tiles.delete(id); }
    const tt = trayTiles.get(id);
    if (tt) { tt.hidden = false; tt.classList.remove("src"); drawMini(tt, itemsById[id]); }
    api.sfx("pop");
    if (api.vibrate) api.vibrate(10);
    changed();
  }
  // Tap: quarter turn around the item's centre, with small kicks so it can turn near a wall.
  function rotatePlaced(id) {
    const idx = placed.findIndex((p) => p.key === id);
    if (idx < 0) return;
    const p = placed[idx], item = itemsById[id];
    const d0 = dims(rotate(item.shape, p.rot)), rot = (p.rot + 1) % 4, d1 = dims(rotate(item.shape, rot));
    const bx = Math.round(p.x + (d0.w - 1) / 2 - (d1.w - 1) / 2), by = Math.round(p.y + (d0.h - 1) / 2 - (d1.h - 1) / 2);
    const occ = occupancy(placed, itemsById, id);
    const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]];
    for (const [kx, ky] of kicks) {
      if (!canPlace(m, occ, item, bx + kx, by + ky, rot)) continue;
      placed[idx] = { key: id, x: bx + kx, y: by + ky, rot };
      const t = drawTile(placed[idx]);
      t.classList.add("snap");
      setTimeout(() => t.classList.remove("snap"), 260);
      api.sfx("select");
      if (api.vibrate) api.vibrate(8);
      changed();
      return;
    }
    shake(tiles.get(id));
    api.sfx("error");
  }
  function rotateTray(id) {
    trayRot[id] = ((trayRot[id] || 0) + 1) % 4;
    const tt = trayTiles.get(id);
    if (tt) drawMini(tt, itemsById[id]);
    api.sfx("blip");
  }

  // ---- pointer handling (one gesture at a time, captured on the pressed tile)
  function bindPointer(elm, src) {
    elm.addEventListener("pointerdown", (e) => onDown(e, elm, src));
    elm.addEventListener("pointermove", onMove);
    elm.addEventListener("pointerup", onUp);
    elm.addEventListener("pointercancel", onCancel);
  }
  function onDown(e, elm, src) {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const id = elm.dataset.id, item = itemsById[id];
    if (!item) return;
    const entry = src === "bag" ? placed.find((p) => p.key === id) : null;
    if (src === "bag" && !entry) return;
    e.preventDefault();
    // The only layout reads of the gesture.
    gridRect = grid.getBoundingClientRect();
    trayRect = tray.getBoundingClientRect();
    const canPan = tray.scrollWidth > tray.clientWidth + 2;
    const rot = entry ? entry.rot : (trayRot[id] || 0);
    // From the tray the finger holds the top-left cell (floating LIFT px above
    // the fingertip). From the bag the grab offset is kept, measured with the
    // same lifted coordinate, so a press that barely moves lands where it was.
    let anchor = [0, 0];
    if (entry) anchor = [Math.floor((e.clientX - gridRect.left) / cell) - entry.x, Math.floor((e.clientY - LIFT - gridRect.top) / cell) - entry.y];
    drag = { id, item, rot, src, entry, elm, anchor, canPan, sx: e.clientX, sy: e.clientY, pid: e.pointerId, mode: "pending", over: false, ok: false, rm: false, target: null, lastKey: "", occ: null };
    try { elm.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function startDrag() {
    const d = drag;
    d.mode = "drag";
    d.occ = occupancy(placed, itemsById, d.id);
    ghost = tileEl(d.item, d.rot, cell, { cls: "bag-tile bag-ghost" });
    document.body.appendChild(ghost);
    d.elm.classList.add(d.src === "bag" ? "lifted" : "src");
    api.sfx("blip");
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid || drag.elm === tray) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (drag.mode === "pending") {
      if (Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return;
      if (drag.src === "tray" && drag.canPan && Math.abs(dx) > Math.abs(dy) * 1.5) { drag.mode = "pan"; drag.scroll0 = tray.scrollLeft; return; }
      startDrag();
    }
    if (drag.mode === "pan") { tray.scrollLeft = drag.scroll0 - dx; return; }
    moveDrag(e.clientX, e.clientY);
  }
  function moveDrag(cx, cy) {
    const d = drag;
    const py = cy - LIFT;
    const overTray = cy >= trayRect.top - 6;
    const near = !overTray && cx >= gridRect.left - cell && cx <= gridRect.right + cell && py >= gridRect.top - cell && py <= gridRect.bottom + cell;
    if (near) {
      const tx = Math.floor((cx - gridRect.left) / cell) - d.anchor[0];
      const ty = Math.floor((py - gridRect.top) / cell) - d.anchor[1];
      const key = tx + "," + ty;
      if (key !== d.lastKey) {
        d.lastKey = key; d.target = [tx, ty]; d.over = true;
        d.ok = canPlace(m, d.occ, d.item, tx, ty, d.rot);
        showHighlight(d, tx, ty);
        ghost.style.transform = "translate(" + (gridRect.left + tx * cell) + "px," + (gridRect.top + ty * cell) + "px)";
      }
      if (d.rm) { d.rm = false; tray.classList.remove("drop"); }
    } else {
      if (d.over) { d.over = false; d.lastKey = ""; d.target = null; d.ok = false; hideHighlight(); }
      ghost.style.transform = "translate(" + (cx - (d.anchor[0] + 0.5) * cell) + "px," + (py - (d.anchor[1] + 0.5) * cell) + "px)";
      const rm = d.src === "bag" && overTray;
      if (rm !== d.rm) { d.rm = rm; tray.classList.toggle("drop", rm); }
    }
  }
  function showHighlight(d, tx, ty) {
    const cs = cells(rotate(d.item.shape, d.rot));
    hlCells.forEach((s, i) => {
      const c = cs[i];
      if (!c) { s.style.display = "none"; return; }
      const x = tx + c[0], y = ty + c[1];
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) { s.style.display = "none"; return; }
      const free = m.has(x, y) && !d.occ.has(x + "," + y);
      s.className = d.ok ? "ok" : (free ? "dim" : "bad");
      s.style.display = "block";
      s.style.transform = "translate(" + x * cell + "px," + y * cell + "px)";
    });
  }
  function hideHighlight() { hlCells.forEach((s) => { s.style.display = "none"; }); }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid || drag.elm === tray) return;
    const d = drag;
    drag = null;
    try { d.elm.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (d.mode === "pending") { if (d.src === "bag") rotatePlaced(d.id); else rotateTray(d.id); return; }
    if (d.mode === "pan") return;
    hideHighlight();
    tray.classList.remove("drop");
    const g = ghost;
    ghost = null;
    if (d.over && d.ok) { g.remove(); d.elm.classList.remove("lifted", "src"); place(d.id, d.target[0], d.target[1], d.rot, d.src); return; }
    if (d.src === "bag" && e.clientY >= trayRect.top - 6) { g.remove(); removeItem(d.id); return; }
    bounce(d, g);
  }
  function onCancel(e) {
    if (!drag || e.pointerId !== drag.pid || drag.elm === tray) return;
    const d = drag;
    drag = null;
    hideHighlight();
    tray.classList.remove("drop");
    if (ghost) { ghost.remove(); ghost = null; }
    d.elm.classList.remove("lifted", "src");
  }
  // Invalid drop: the ghost flies back to where it came from and that tile shakes red.
  function bounce(d, g) {
    api.sfx("error");
    if (api.vibrate) api.vibrate([20, 30, 20]);
    const r = d.elm.getBoundingClientRect();
    const dd = dims(rotate(d.item.shape, d.rot));
    const tx = d.src === "tray" ? r.left + (r.width - dd.w * cell) / 2 : r.left;
    const ty = d.src === "tray" ? r.top + 8 : r.top;
    g.classList.add("back");
    g.style.transform = "translate(" + tx + "px," + ty + "px)";
    const done = () => { g.remove(); d.elm.classList.remove("lifted", "src"); shake(d.elm); };
    me.timers.push(setTimeout(done, 190));
  }

  function destroy() {
    me.timers.forEach(clearTimeout);
    me.timers = [];
    if (ghost) { ghost.remove(); ghost = null; }
    drag = null;
    if (inst === me) inst = null;
  }

  // Restored placement -> tiles in the bag, gone from the tray.
  placed.forEach((p) => { drawTile(p); const tt = trayTiles.get(p.key); if (tt) tt.hidden = true; });
  refresh();
  return me;
}

export default {
  id: "bag",
  progressive: true,

  // How-to loop: a blanket slides up from the tray and snaps into a mini bag.
  howtoDemo(el, content) {
    ensureStyle();
    const mask = content.mask || [".####.", "######", "######", "######", "######", "######"];
    const m = parseMask(mask);
    const cell = Math.max(10, Math.min(16, Math.floor(200 / Math.max(1, m.w))));
    const item = (content.items || []).find((it) => it.base === "blanket") || (content.items || [])[0] || { shape: ["####", "####"], color: "#f5c6a0", emoji: "🧣" };
    const b = boardEl(mask, cell);
    const d = dims(item.shape);
    const low = { x: Math.floor((m.w - d.w) / 2), y: m.h - d.h - 1 };
    const pos = canPlace(m, [], item, low.x, low.y, 0) ? low : (firstFit(m, [], item, 0, {}) || { x: 0, y: 0 });
    const tile = tileEl(item, 0, cell);
    tile.style.left = pos.x * cell + "px";
    tile.style.top = pos.y * cell + "px";
    const hlc = cells(item.shape).map(([x, y]) => h("i", { class: "ok", style: { display: "none", width: cell + "px", height: cell + "px", transform: "translate(" + (pos.x + x) * cell + "px," + (pos.y + y) * cell + "px)" } }));
    const hl = h("div", { class: "bag-layer bag-hl" }, ...hlc);
    appendTo(b.grid, hl, tile);
    const drop = (m.h - pos.y) * cell + 30;
    const wrap = h("div", { class: "bag-demo", style: { width: b.W + "px", height: (b.H + 36) + "px" } }, b.board);
    appendTo(el, wrap, h("p", { class: "tiny center", style: { marginTop: "6px" } }, "DRAG · SNAP · TAP TO ROTATE"));
    let stopped = false;
    const at = (ms, fn) => demoTimers.push(setTimeout(() => { if (!stopped) fn(); }, ms));
    const loop = () => {
      if (stopped) return;
      tile.style.transition = "none";
      tile.style.transform = "translate(" + (-pos.x * cell + 6) + "px," + drop + "px)";
      tile.style.opacity = "0.9";
      hlc.forEach((s) => { s.style.display = "none"; });
      at(350, () => { tile.style.transition = "transform .6s steps(8)"; tile.style.transform = "translate(0px,0px)"; });
      at(650, () => hlc.forEach((s) => { s.style.display = "block"; }));
      at(1000, () => { tile.style.opacity = "1"; hlc.forEach((s) => { s.style.display = "none"; }); tile.classList.add("snap"); });
      at(1300, () => tile.classList.remove("snap"));
      at(2500, loop);
    };
    loop();
    return () => { stopped = true; demoTimers.forEach(clearTimeout); demoTimers = []; };
  },

  mount(el, content, api) {
    ensureStyle();
    if (inst) inst.destroy();
    inst = mountRound(el, content, api);
  },

  unmount() {
    if (inst) inst.destroy();
    inst = null;
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
  },

  // Rehearsal: greedy-pack a random subset through place(), one item every 300-600 ms.
  autoplay(el, content, api) {
    const me = inst;
    if (!me) return;
    const ids = me.remaining();
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const n = Math.max(1, Math.round(ids.length * (0.5 + Math.random() * 0.5)));
    let i = 0;
    const step = () => {
      if (inst !== me || i >= n) return;
      const id = ids[i++], item = me.itemsById[id];
      const r0 = Math.floor(Math.random() * 4);
      for (let k = 0; k < 4; k++) {
        const rot = (r0 + k) % 4;
        const pos = firstFit(me.mask, me.placed, item, rot, me.itemsById);
        if (pos) { me.place(id, pos.x, pos.y, rot, "tray"); break; }
      }
      me.timers.push(setTimeout(step, 300 + Math.random() * 300));
    };
    me.timers.push(setTimeout(step, 200));
  },

  // The winner's bag fills up item by item, then a fill-percentage race for the top five.
  async reveal(el, reveal, api) {
    ensureStyle();
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const itemsById = reveal.items || {};
    const mask = reveal.mask || [];
    const m = parseMask(mask);
    const big = !!api.big;
    const cell = big ? Math.max(18, Math.min(40, Math.floor(520 / Math.max(1, m.w)))) : Math.max(16, Math.min(26, Math.floor(((el.clientWidth || 350) * 0.62) / Math.max(1, m.w))));
    const win = reveal.winner && byId[reveal.winner.id] ? reveal.winner : null;
    const left = h("div", { class: "center" });
    const right = h("div", null);
    appendTo(el, h("h2", { class: "title" }, "BEST PACKED BAG"), h("div", { class: big ? "bag-stage" : "bag-wrap" }, left, right));
    const alive = () => el.isConnected;
    if (!win) {
      left.appendChild(h("p", { class: "sub" }, "NOBODY PACKED A THING. THE BABY IS NOT IMPRESSED."));
    } else {
      const wr = byId[win.id];
      left.appendChild(h("div", { class: "row", style: { justifyContent: "center", gap: "10px", marginBottom: "6px" } }, spriteEl(wr.avatar, { size: "sm", cls: "idle" }), h("span", null, wr.name)));
      const b = boardEl(mask, cell);
      const layer = h("div", { class: "bag-layer" });
      b.grid.appendChild(layer);
      b.board.style.margin = "0 auto";
      const line = h("p", { class: "sub", style: { marginTop: "8px" } }, "");
      appendTo(left, b.board, line);
      await wait(big ? 900 : 500);
      for (const p of win.placed || []) {
        if (!alive()) return;
        const it = itemsById[p.key];
        if (!it) continue;
        const t = tileEl(it, p.rot, cell);
        t.style.left = p.x * cell + "px";
        t.style.top = p.y * cell + "px";
        t.classList.add("drop-in");
        layer.appendChild(t);
        api.sfx("thunk");
        await wait(250);
      }
      const s = win.stats || {};
      line.textContent = (s.fillPct || 0) + "% FILLED · VALUE " + (s.value || 0) + " · ESSENTIALS " + (s.essentialsPlaced || 0) + "/" + (s.essentialsTotal || 0);
    }
    if (!alive()) return;
    await wait(300);
    const top = (reveal.top || []).filter((t) => byId[t.id]);
    if (top.length) {
      right.appendChild(h("p", { class: "sub", style: { marginBottom: "6px" } }, "FILL RACE · TOP " + top.length));
      const race = h("div", { class: "live-bars bag-race" });
      right.appendChild(race);
      const best = Math.max(1, ...top.map((t) => t.fillPct || 0));
      const rows = top.map((t, i) => {
        const r = byId[t.id];
        const bar = h("i", { style: { width: "0%" } });
        const v = h("span", { class: "v" }, "0%");
        const row = h("div", { class: "lb" + (i === 0 ? " win" : ""), style: { opacity: "0" } }, h("span", { class: "nm" }, r.name + (you && you.id === t.id ? " (YOU)" : "")), h("span", { class: "bar" }, bar), v);
        race.appendChild(row);
        return { row, bar, v, t };
      });
      for (let i = rows.length - 1; i >= 0; i--) {
        if (!alive()) return;
        const { row, bar, v, t } = rows[i];
        row.style.opacity = "1";
        bar.style.transition = "width .9s steps(12)";
        requestAnimationFrame(() => { bar.style.width = Math.round(100 * (t.fillPct || 0) / best) + "%"; });
        countUp(v, 0, t.fillPct || 0, 900, { format: (n) => n + "%", onTick: () => api.sfx("coin", 0.03), every: 20 });
        await wait(i === 0 ? 900 : 380);
      }
    }
    if (!alive()) return;
    if (you) {
      const mine = you.myAnswer && Array.isArray(you.myAnswer.placed) ? validPlacement(mask, you.myAnswer.placed, itemsById) : [];
      const ms = fillStats(mask, mine, itemsById);
      right.appendChild(h("div", { class: "panel dark center", style: { marginTop: "12px" } },
        "YOU: ", h("strong", null, ms.fillPct + "% FILLED"), ", ESSENTIALS " + ms.essentialsPlaced + "/" + ms.essentialsTotal,
        h("div", { class: "tiny " + (ms.missingEssentials ? "red" : "green"), style: { marginTop: "4px" } }, ms.missingEssentials ? "FORGOT " + ms.missingEssentials + " ESSENTIAL" + (ms.missingEssentials > 1 ? "S" : "") + "!" : (mine.length ? "ALL ESSENTIALS PACKED" : "YOU PACKED NOTHING!"))));
    }
    right.appendChild(h("p", { class: "tiny center", style: { marginTop: "8px" } }, "ROOM AVERAGE " + (reveal.avgFill || 0) + "% FILLED · " + (reveal.perfectEssentials || 0) + " PACKED EVERY ESSENTIAL"));
  },

  // TV / host STAGE during play: the empty bag and the live fill race.
  stageView(el, content, api) {
    ensureStyle();
    const mask = content.mask || [];
    const m = parseMask(mask);
    const cell = api.tv ? Math.max(20, Math.min(44, Math.floor(600 / Math.max(1, m.w)))) : Math.max(12, Math.min(22, Math.floor(260 / Math.max(1, m.w))));
    const b = boardEl(mask, cell);
    b.board.style.margin = "0 auto";
    const counter = h("div", { class: "counter center" }, "0 PACKING");
    const barsWrap = h("div", null);
    const left = h("div", { class: "center" }, b.board, counter);
    const right = h("div", null, h("p", { class: "sub" }, "LIVE FILL %"), barsWrap);
    appendTo(el, h("h2", { class: "title big" }, content.title || "FIT THE DIAPER BAG"), content.subtitle ? h("p", { class: "sub" }, content.subtitle) : null,
      api.tv ? h("div", { class: "bag-stage" }, left, right) : h("div", null, left, right));
    const bars = liveBars(barsWrap, { max: 10 });
    return {
      update(live, snap) {
        const n = (live && live.answered) || (snap && snap.answerCount) || 0;
        counter.textContent = n + " PACKING";
        if (live && live.bars) bars.update(live.bars, { unit: "%" });
      }
    };
  }
};
