// FIT THE DIAPER BAG: pure helpers shared by the server (src/games/bag.js),
// the phone (public/games/bag.js) and the tests. No DOM, no I/O.
//
// shape:  array of strings, "#" = cell, "." = empty, read top to bottom.
// mask:   the bag interior, same format.
// placed: [{ key, x, y, rot }] where key is an item INSTANCE id ("wipes",
//         "wipes#2"), x/y the top-left of the rotated shape's bounding box in
//         bag cells, rot 0..3 quarter turns clockwise.
// itemsById: { instanceId: { id, base, shape, value, essential, ... } }

export const MAX_PLACED = 40;

// Rotate a shape `times` quarter turns clockwise (negative = counter-clockwise).
export function rotate(shape, times = 1) {
  let rows = shape.map((r) => r.split(""));
  const n = ((times % 4) + 4) % 4;
  for (let k = 0; k < n; k++) {
    const h = rows.length, w = h ? rows[0].length : 0;
    const out = [];
    for (let x = 0; x < w; x++) {
      const row = [];
      for (let y = h - 1; y >= 0; y--) row.push(rows[y][x]);
      out.push(row);
    }
    rows = out;
  }
  return rows.map((r) => r.join(""));
}

// The filled cells of a shape as [x, y] pairs in reading order.
export function cells(shape) {
  const out = [];
  shape.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "#") out.push([x, y]); });
  return out;
}

export function dims(shape) {
  return { w: shape.length ? shape[0].length : 0, h: shape.length };
}

export function parseMask(mask) {
  const h = mask.length;
  const w = mask.reduce((m, r) => Math.max(m, r.length), 0);
  const rows = mask.map((r) => r.padEnd(w, "."));
  let count = 0;
  rows.forEach((r) => { for (const c of r) if (c === "#") count++; });
  return { w, h, count, rows, has: (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === "#" };
}

export const baseKey = (id) => String(id).split("#")[0];

// Instance ids of a round -> item definitions (base item + id + base).
export function expandItems(data, keys) {
  const out = {};
  keys.forEach((id) => {
    const base = baseKey(id);
    const def = data.items[base];
    if (!def) return;
    out[id] = { ...def, id, base, essential: !!def.essential || (data.essentials || []).includes(base) };
  });
  return out;
}

// Absolute cells covered by an item placed at (x, y) with rotation rot.
export function footprint(item, x, y, rot) {
  return cells(rotate(item.shape, rot)).map(([cx, cy]) => [x + cx, y + cy]);
}

// Map "x,y" -> instance id for every placed item except skipKey. Unknown keys are ignored.
export function occupancy(placed, itemsById, skipKey) {
  const occ = new Map();
  for (const p of placed || []) {
    if (!p || p.key === skipKey) continue;
    const it = itemsById[p.key];
    if (!it) continue;
    for (const [x, y] of footprint(it, p.x, p.y, p.rot)) occ.set(x + "," + y, p.key);
  }
  return occ;
}

// Can `item` sit at (x, y, rot)? Inside the mask and not overlapping anything in
// `placed`. `placed` may be the placed list (then itemsById is needed) or an
// occupancy Map/Set already built with occupancy().
export function canPlace(mask, placed, item, x, y, rot, itemsById, skipKey) {
  const m = Array.isArray(mask) ? parseMask(mask) : mask;
  if (!item || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  const occ = placed instanceof Map || placed instanceof Set ? placed : occupancy(placed, itemsById || {}, skipKey);
  for (const [cx, cy] of footprint(item, x, y, rot)) {
    if (!m.has(cx, cy)) return false;
    if (occ.has(cx + "," + cy)) return false;
  }
  return true;
}

// Drop malformed entries, unknown keys and duplicate keys. Keeps order.
export function cleanPlaced(placed, itemsById) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(placed)) return out;
  for (const p of placed.slice(0, MAX_PLACED)) {
    if (!p || typeof p.key !== "string" || !itemsById[p.key] || seen.has(p.key)) continue;
    const x = Number(p.x), y = Number(p.y), rot = ((Number(p.rot) | 0) % 4 + 4) % 4;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    seen.add(p.key);
    out.push({ key: p.key, x, y, rot });
  }
  return out;
}

// The placement as the server scores it: walk the list in order and drop any
// item that does not fit next to the ones kept so far.
export function validPlacement(mask, placed, itemsById) {
  const m = parseMask(mask);
  const kept = [];
  const occ = new Map();
  for (const p of cleanPlaced(placed, itemsById)) {
    const it = itemsById[p.key];
    if (!canPlace(m, occ, it, p.x, p.y, p.rot)) continue;
    kept.push(p);
    for (const [x, y] of footprint(it, p.x, p.y, p.rot)) occ.set(x + "," + y, p.key);
  }
  return kept;
}

// Fill statistics of a placement. `valid` is false when anything overlaps,
// sticks out of the bag or names an unknown item; the counts then describe the
// valid part only (see validPlacement).
export function fillStats(mask, placed, itemsById) {
  const m = parseMask(mask);
  const list = Array.isArray(placed) ? placed : [];
  const kept = validPlacement(mask, list, itemsById);
  const valid = kept.length === list.length;
  let cellsUsed = 0, value = 0;
  const packed = new Set();
  for (const p of kept) {
    const it = itemsById[p.key];
    cellsUsed += cells(it.shape).length;
    value += it.value || 0;
    packed.add(p.key);
  }
  let essentialsTotal = 0, essentialsPlaced = 0;
  for (const id in itemsById) {
    if (!itemsById[id].essential) continue;
    essentialsTotal++;
    if (packed.has(id)) essentialsPlaced++;
  }
  const cellsTotal = m.count;
  return {
    cellsUsed, cellsTotal, value,
    fillPct: cellsTotal ? Math.round(100 * cellsUsed / cellsTotal) : 0,
    missingEssentials: essentialsTotal - essentialsPlaced,
    essentialsTotal, essentialsPlaced,
    count: kept.length,
    valid
  };
}

// First cell in reading order where the item fits at this rotation, or null.
export function firstFit(mask, placed, item, rot, itemsById) {
  const m = Array.isArray(mask) ? parseMask(mask) : mask;
  const occ = placed instanceof Map ? placed : occupancy(placed, itemsById || {});
  const { w, h } = dims(rotate(item.shape, rot));
  for (let y = 0; y <= m.h - h; y++) {
    for (let x = 0; x <= m.w - w; x++) {
      if (canPlace(m, occ, item, x, y, rot)) return { x, y };
    }
  }
  return null;
}

// A greedy packer used by the bots: shuffle the items, try each at a random
// rotation (then the other rotations) at the first fitting cell, stop after a
// fraction of the list. rng is a seeded function returning [0, 1).
export function greedyPack(mask, keys, itemsById, rng, { fraction = 1, tryAllRotations = true } = {}) {
  const m = parseMask(mask);
  const order = keys.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const n = Math.max(1, Math.round(order.length * Math.max(0, Math.min(1, fraction))));
  const placed = [];
  const occ = new Map();
  for (const key of order.slice(0, n)) {
    const it = itemsById[key];
    if (!it) continue;
    const r0 = Math.floor(rng() * 4);
    const rots = tryAllRotations ? [0, 1, 2, 3].map((k) => (r0 + k) % 4) : [r0];
    for (const rot of rots) {
      const pos = firstFit(m, occ, it, rot);
      if (!pos) continue;
      placed.push({ key, x: pos.x, y: pos.y, rot });
      for (const [x, y] of footprint(it, pos.x, pos.y, rot)) occ.set(x + "," + y, key);
      break;
    }
  }
  return placed;
}
