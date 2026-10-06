// A pixel countdown bar driven by the server's clock. Returns a controller.
import { h } from "./dom.js";
import { sfx } from "./audio.js";

export function countdown(container, { endsAt, roundTime, now, paused = false, onZero, sound = true }) {
  const bar = h("div", { class: "cd-fill" });
  const num = h("div", { class: "cd-num" }, "");
  const el = h("div", { class: "cd" + (paused ? " paused" : ""), role: "timer", "aria-live": "off" }, h("div", { class: "cd-bar" }, bar), num);
  container.appendChild(el);
  let raf = 0, lastSec = null, done = false, stopped = false;
  let state = { endsAt, roundTime, paused, pauseLeft: 0 };

  function frame() {
    if (stopped) return;
    let left;
    if (state.paused) left = state.pauseLeft;
    else left = Math.max(0, state.endsAt - now());
    const frac = state.roundTime > 0 ? Math.min(1, left / state.roundTime) : 0;
    bar.style.transform = "scaleX(" + frac.toFixed(4) + ")";
    const sec = Math.ceil(left / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      num.textContent = state.paused ? "PAUSED " + sec + "s" : sec + "s";
      el.classList.toggle("urgent", !state.paused && sec <= 5 && sec > 0);
      if (sound && !state.paused && sec <= 5 && sec > 0) sfx(sec === 1 ? "tock" : "tick");
    }
    if (left <= 0 && !done && !state.paused) { done = true; onZero && onZero(); }
    raf = requestAnimationFrame(frame);
  }
  frame();
  return {
    el,
    update(patch) {
      Object.assign(state, patch);
      el.classList.toggle("paused", !!state.paused);
      if (patch.endsAt != null) done = false;
    },
    stop() { stopped = true; cancelAnimationFrame(raf); }
  };
}
