// Tiny DOM helpers so the rest of the engine reads cleanly.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function appendTo(el, ...children) { return append(el, children); }

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function reduceMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Animate a number in an element. Resolves when done. onTick fires every `every` units.
export function countUp(el, from, to, ms, { format = (n) => String(n), onTick, every = 100 } = {}) {
  return new Promise((resolve) => {
    if (reduceMotion() || ms <= 0 || from === to) { el.textContent = format(to); resolve(); return; }
    const start = performance.now();
    let lastTick = Math.floor(from / every);
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * eased);
      el.textContent = format(v);
      const tick = Math.floor(v / every);
      if (onTick && tick !== lastTick) { lastTick = tick; onTick(v); }
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function fmtMoney(n, { cents = true } = {}) {
  const v = Number(n) || 0;
  return "$" + (cents ? v.toFixed(2) : Math.round(v).toString()).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function ordinal(n) {
  const s = ["TH", "ST", "ND", "RD"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  let el = $(".toast");
  if (!el) { el = h("div", { class: "toast", role: "status" }); document.body.appendChild(el); }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function announce(msg) {
  const el = $("#live");
  if (el) el.textContent = msg;
}

export function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
  } catch (e) { return null; }
  return val;
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
}

// Confetti of the invite's own falling blocks and hearts.
export function rain(count = 24, ms = 2600) {
  if (reduceMotion()) return;
  const layer = h("div", { class: "deco-fall", "aria-hidden": "true" });
  const srcs = ["assets/deco/block-l.png", "assets/deco/block-s.png", "assets/deco/block-t.png", "assets/deco/sparkle.png"];
  for (let i = 0; i < count; i++) {
    const img = h("img", { src: srcs[i % srcs.length], alt: "" });
    img.style.left = Math.random() * 100 + "vw";
    img.style.animationDuration = (ms * (0.7 + Math.random() * 0.6)) + "ms";
    img.style.animationDelay = (Math.random() * 600) + "ms";
    img.style.width = (14 + Math.random() * 18) + "px";
    layer.appendChild(img);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), ms + 1200);
}
