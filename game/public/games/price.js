// PRICE IS RIGHT: BABY EDITION (client). Reference implementation of the
// client game contract: howtoDemo, mount, unmount, reveal, stageView.
import { h, appendTo, clear, fmtMoney, countUp, wait } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";

function itemCards(items) {
  return items.map((it) => h("div", { class: "panel item-card" },
    h("span", { class: "emoji", "aria-hidden": "true" }, it.emoji || "🎁"),
    h("div", null, h("div", { class: "nm" }, it.name), it.detail ? h("div", { class: "dt" }, it.detail) : null)));
}

let demoTimer = null;

export default {
  id: "price",

  // A looping demo for the how-to screen: a slider thumb wandering, a tag updating.
  howtoDemo(el, content) {
    const tag = h("div", { class: "price-tag" }, "$--");
    const range = h("input", { type: "range", class: "px-range", min: "0", max: "100", value: "50", disabled: true, "aria-hidden": "true", tabindex: "-1" });
    appendTo(el, h("div", { class: "center" }, tag), range);
    let v = 20, dir = 1;
    demoTimer = setInterval(() => { v += dir * 7; if (v >= 90 || v <= 10) dir = -dir; range.value = v; tag.textContent = fmtMoney((content.max || 100) * v / 100, { cents: false }); }, 220);
    return () => clearInterval(demoTimer);
  },

  mount(el, content, api) {
    const min = content.min, max = content.max, step = content.step || 1;
    const start = Math.round(((min + max) / 2) / step) * step;
    const tag = h("div", { class: "price-tag big", "aria-live": "polite" }, fmtMoney(start, { cents: false }));
    const range = h("input", { type: "range", class: "px-range", min: String(min), max: String(max), step: String(step), value: String(start), "aria-label": "Your price guess" });
    const btn = h("button", { class: "btn primary", type: "button" }, h("i", { class: "tri" }), "LOCK IN");
    let touched = false;
    const read = () => Number(range.value);
    range.addEventListener("input", () => { touched = true; tag.textContent = fmtMoney(read(), { cents: false }); api.sfx("blip"); });
    btn.addEventListener("click", () => {
      api.submit(read(), { label: fmtMoney(read(), { cents: false }) });
      btn.textContent = "UPDATE GUESS";
    });
    const prev = api.you && api.you() && api.you().myAnswer;
    if (typeof prev === "number") { range.value = String(prev); tag.textContent = fmtMoney(prev, { cents: false }); btn.textContent = "UPDATE GUESS"; }
    appendTo(el, 
      h("h2", { class: "title" }, content.title),
      content.subtitle ? h("p", { class: "sub" }, content.subtitle) : null,
      ...itemCards(content.items),
      content.items.length > 1 ? h("p", { class: "sub" }, "WHAT DO ALL " + content.items.length + " COST TOGETHER?") : null,
      h("div", { class: "slider-wrap center" }, tag, range, h("div", { class: "range-ends" }, h("span", null, fmtMoney(min, { cents: false })), h("span", null, fmtMoney(max, { cents: false })))),
      btn
    );
    setTimeout(() => { if (!touched) tag.classList.add("blink"); setTimeout(() => tag.classList.remove("blink"), 1200); }, 2500);
  },

  unmount() { clearInterval(demoTimer); },

  // Rehearsal only: a plausible guess, submitted like a tap would.
  autoplay(el, content, api) {
    const range = el.querySelector("input[type=range]");
    const v = content.min + (content.max - content.min) * (0.25 + Math.random() * 0.5);
    const snapped = Math.round(v / (content.step || 1)) * (content.step || 1);
    if (range) { range.value = String(snapped); range.dispatchEvent(new Event("input")); }
    api.submit(snapped, { label: fmtMoney(snapped, { cents: false }) });
  },

  async reveal(el, reveal, api) {
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const myGuess = reveal.guesses.find((g) => you && g.id === you.id);
    appendTo(el, h("h2", { class: "title" }, "THE REAL PRICE"));
    // Every guess as a tiny sprite along the line, then the answer drops in.
    const line = h("div", { class: "price-line", "aria-hidden": "true" });
    const pos = (v) => Math.max(2, Math.min(98, 100 * (v - reveal.min) / Math.max(1, reveal.max - reveal.min)));
    reveal.guesses.forEach((g) => {
      const r = byId[g.id];
      if (!r) return;
      const m = spriteEl(r.avatar, { size: "sm", cls: "mark" + (reveal.best.includes(g.id) ? " best" : "") + (you && g.id === you.id ? " me" : "") });
      m.style.left = pos(g.g) + "%";
      line.appendChild(m);
    });
    el.appendChild(line);
    const tagWrap = h("div", { class: "center" });
    el.appendChild(tagWrap);
    await wait(api.big ? 1200 : 800);
    api.sfx("drum");
    const ans = h("div", { class: "ans" });
    ans.style.left = pos(reveal.answer) + "%";
    line.appendChild(ans);
    const tag = h("div", { class: "price-tag big pop" }, "$0");
    tagWrap.appendChild(tag);
    await countUp(tag, 0, Math.round(reveal.answer), 1200, { format: (n) => fmtMoney(n, { cents: false }), onTick: () => api.sfx("tick", 0.03), every: 25 });
    tag.textContent = fmtMoney(reveal.answer);
    api.sfx("coin");
    // Items with their real prices.
    const list = h("div", { class: "panel" });
    reveal.items.forEach((it) => list.appendChild(h("div", { class: "row", style: { justifyContent: "space-between", gap: "8px" } }, h("span", { class: "tiny", style: { color: "#6b3510", flex: "1" } }, it.name + (it.retailer ? " · " + it.retailer : "")), h("strong", null, fmtMoney(it.price)))));
    if (reveal.diaperNote) list.appendChild(h("p", { class: "tiny", style: { color: "#6b3510", marginTop: "8px" } }, "THAT'S ABOUT " + reveal.diaperNote.toLocaleString() + " DIAPERS."));
    el.appendChild(list);
    if (myGuess) {
      const off = Math.abs(myGuess.g - reveal.answer);
      el.appendChild(h("div", { class: "panel dark center" }, "YOUR GUESS: ", h("strong", null, fmtMoney(myGuess.g, { cents: false })), h("br"), h("span", { class: "tiny" }, off === 0 ? "DEAD ON!" : "OFF BY " + fmtMoney(off, { cents: false }))));
    }
    // Closest three.
    const best = reveal.best.map((id) => byId[id]).filter(Boolean);
    if (best.length) {
      const wrap = h("div", { class: "row", style: { justifyContent: "center", gap: "14px", marginTop: "10px" } });
      best.forEach((r, i) => wrap.appendChild(h("div", { class: "center" }, spriteEl(r.avatar, { cls: "hop" }), h("div", { class: "tiny" }, (i === 0 ? "CLOSEST: " : "") + r.name))));
      el.appendChild(h("p", { class: "sub" }, "CLOSEST GUESSES"));
      el.appendChild(wrap);
    }
  },

  // TV / host stage during play: the items and how many have locked in.
  stageView(el, content, api) {
    appendTo(el, h("h2", { class: "title big" }, content.title), content.subtitle ? h("p", { class: "sub" }, content.subtitle) : null, h("div", { class: "row", style: { justifyContent: "center", gap: "20px", flexWrap: "wrap" } }, ...itemCards(content.items)));
    const cnt = h("div", { class: "counter center" }, "0 LOCKED IN");
    el.appendChild(cnt);
    return { update(live, snap) { cnt.textContent = ((live && live.answered) || snap.answerCount || 0) + " LOCKED IN"; } };
  }
};
