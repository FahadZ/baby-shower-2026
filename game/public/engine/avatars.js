// Sprite elements for players. Every avatar is a character + palette; the
// image file comes from data/avatars.js so the server and client agree.
import { ROSTER, ROSTER_BY_ID, PALETTES, avatarFile, avatarName } from "../data/avatars.js";
import { h } from "./dom.js";

export { ROSTER, ROSTER_BY_ID, PALETTES, avatarFile, avatarName };

export function spriteEl(avatar, { size = "", cls = "", badge = null, title } = {}) {
  const el = h("div", { class: "av " + size + " " + cls, dataset: { c: avatar ? avatar.c : "", p: avatar ? avatar.p : "" } },
    h("img", { src: avatarFile(avatar), alt: title || avatarName(avatar), draggable: "false", loading: "eager" })
  );
  if (badge) el.appendChild(h("span", { class: "badge" }, badge));
  return el;
}

export function moveFor(avatar) {
  const r = avatar && ROSTER_BY_ID[avatar.c];
  return (r && r.move) || "jump";
}

export function bubble(el, text, ms = 1800) {
  const b = h("div", { class: "speech", "aria-hidden": "true" }, text);
  el.appendChild(b);
  setTimeout(() => b.remove(), ms);
  return b;
}

export function hop(el) {
  el.classList.remove("hop");
  void el.offsetWidth;
  el.classList.add("hop");
  setTimeout(() => el.classList.remove("hop"), 600);
}

export function preloadAvatars(list) {
  list.forEach((a) => { const img = new Image(); img.src = avatarFile(a); });
}

// Pick a random free avatar (for the "random" button).
export function randomFree(taken) {
  const set = new Set(taken || []);
  const combos = [];
  for (const r of ROSTER) for (const p of PALETTES) if (!set.has(r.c + ":" + p)) combos.push({ c: r.c, p });
  if (!combos.length) return null;
  // Prefer p1 so the room shows originals first.
  const firsts = combos.filter((x) => x.p === "p1");
  const pool = firsts.length ? firsts : combos;
  return pool[Math.floor(Math.random() * pool.length)];
}
