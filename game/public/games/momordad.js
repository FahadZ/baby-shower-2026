// MOM OR DAD? (client). Tinder-style cards: swipe left for MOM, right for DAD,
// five cards, six seconds each. Phones pace themselves; the server only sees
// the growing picks array and locks it in after the fifth card.
import { h, appendTo, wait } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";

const SIDES = ["mom", "dad"];

// This game's styles live here so it touches no engine file.
const CSS = `
.md-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: .8em; color: var(--muted); margin: 0 0 8px; }
.md-head b { color: var(--cream-2); font-weight: 400; }
.md-bar { height: 14px; border: 3px solid var(--ink); background: var(--cream-2); box-shadow: 2px 2px 0 #000; overflow: hidden; margin: 0 0 10px; }
.md-bar i { display: block; height: 100%; width: 100%; background: var(--green); transform-origin: left; }
.md-bar.urgent i { background: var(--red); }
.md-arena { position: relative; height: min(340px, 46vh); margin: 4px 0 14px; }
.md-zone { position: absolute; top: 0; bottom: 0; width: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 3px dashed #1a1c17; background: rgba(0,0,0,.18); color: var(--muted); font-size: .8em; line-height: 1.2; text-align: center; transition: background .15s, border-color .15s, color .15s; }
.md-zone.mom { left: 0; } .md-zone.dad { right: 0; }
.md-zone .av { height: 52px; }
.md-zone .nm { font-size: .6em; }
.md-zone.hot { border-style: solid; background: rgba(255,216,74,.16); }
.md-zone.mom.hot { color: #ff6b78; border-color: #ff6b78; }
.md-zone.dad.hot { color: var(--blue); border-color: var(--blue); }
.md-card { position: absolute; left: 66px; right: 66px; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; padding: 14px; text-align: center; background: var(--cream); color: var(--ink); border: 4px solid var(--ink); box-shadow: inset -4px -4px 0 var(--cream-shadow), inset 4px 4px 0 var(--cream-2), 4px 4px 0 #000; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; will-change: transform; }
.md-card.drag { cursor: grabbing; }
.md-card.ease { transition: transform .22s ease-out; }
.md-card.fly { transition: transform .28s ease-in, opacity .28s; opacity: 0; pointer-events: none; }
.md-card.enter { animation: md-enter .28s steps(5) 1; }
.md-card.done { cursor: default; flex-direction: column; gap: 10px; background: var(--bg-dark); color: var(--text); box-shadow: inset -4px -4px 0 #1a1c17, inset 4px 4px 0 #4a5042, 4px 4px 0 #000; }
@keyframes md-enter { from { transform: scale(.6) translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
.md-text { font-size: 1em; line-height: 1.7; overflow-wrap: anywhere; }
.md-photo { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.md-photo img, .md-thumb img { max-width: 100%; max-height: 100%; width: auto; height: auto; image-rendering: auto; border: 3px solid var(--ink); background: #fff; display: block; pointer-events: none; }
.md-stamp { position: absolute; top: 12px; padding: 6px 10px; border: 4px solid; font-size: 1.1em; line-height: 1.2; opacity: 0; background: rgba(255,255,255,.75); pointer-events: none; }
.md-stamp.mom { left: 10px; color: var(--red); border-color: var(--red); transform: rotate(-14deg); }
.md-stamp.dad { right: 10px; color: #2b6fb0; border-color: #2b6fb0; transform: rotate(14deg); }
.md-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.md-btns .btn.mom { background: #8a2430; box-shadow: inset -4px -4px 0 #5a1620, inset 4px 4px 0 #c43a4a, 4px 4px 0 #000; }
.md-btns .btn.dad { background: #2b5f8f; box-shadow: inset -4px -4px 0 #1b3f61, inset 4px 4px 0 #5aa7e8, 4px 4px 0 #000; }
.md-btns .tri-l { width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-right: 12px solid var(--cream-2); }
.md-demo { position: relative; height: 150px; }
.md-demo .md-card { left: 29%; right: 29%; padding: 8px; font-size: .75em; transition: transform .45s ease-in-out; }
.md-demo .md-zone { width: 23%; font-size: .65em; }
.md-demo .md-zone .av { height: 40px; }
html[data-screen="tv"] .md-demo { height: 300px; }
html[data-screen="tv"] .md-demo .md-zone .av { height: 90px; }
.md-rlist { display: grid; gap: 12px; perspective: 900px; margin-bottom: 14px; }
html[data-screen="tv"] .md-rlist { grid-template-columns: repeat(5, 1fr); gap: 20px; }
.md-flip { display: grid; transform-style: preserve-3d; transition: transform .55s; }
.md-flip.in { transform: rotateY(180deg); }
.md-face { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; padding: 12px; border: 4px solid var(--ink); box-shadow: 4px 4px 0 #000; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
.md-face.front { background: var(--cream); color: var(--ink); }
.md-face.back { background: var(--bg-dark); color: var(--text); transform: rotateY(180deg); }
html[data-screen="tv"] .md-face { min-height: 320px; }
.md-thumb { max-height: 150px; }
.md-thumb.small { max-height: 70px; }
html[data-screen="tv"] .md-thumb { max-height: 230px; }
html[data-screen="tv"] .md-thumb.small { max-height: 110px; }
.md-q { font-size: .8em; line-height: 1.6; overflow-wrap: anywhere; }
.md-face.back .md-q { font-size: .6em; color: var(--muted); }
.md-who { display: flex; align-items: center; gap: 10px; font-size: 1.05em; color: var(--cream-2); }
.md-who .av { height: 56px; }
.md-who.mom span { color: #ff6b78; } .md-who.dad span { color: var(--blue); }
.md-split { width: 100%; height: 16px; border: 3px solid var(--ink); background: var(--cream-2); display: flex; overflow: hidden; box-shadow: 2px 2px 0 #000; }
.md-split i { display: block; height: 100%; width: 0; transition: width .6s; }
.md-split .m { background: var(--red); } .md-split .d { background: var(--blue); }
.md-pct { font-size: .7em; color: var(--muted); }
.md-pct .m { color: #ff6b78; } .md-pct .d { color: var(--blue); }
.md-mine { font-size: .75em; }
.md-mine.ok { color: var(--green); } .md-mine.no { color: #ff6b78; } .md-mine.none { color: var(--muted); }
.md-you { font-size: 1.6em; color: var(--cream-2); line-height: 1.3; }
.md-vs { display: flex; align-items: center; justify-content: center; gap: 40px; margin: 24px 0; }
.md-vs .side { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.md-vs .vs { font-size: 2em; color: var(--gold); text-shadow: 3px 3px 0 #000; }
.md-vs .lbl { font-size: 1.2em; }
.md-vs .side.mom .lbl { color: #ff6b78; } .md-vs .side.dad .lbl { color: var(--blue); }
.md-best { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-top: 10px; }
`;

function ensureCss() {
  if (document.getElementById("momordad-css")) return;
  const s = document.createElement("style");
  s.id = "momordad-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

function zoneEl(side, parents) {
  const p = (parents && parents[side]) || {};
  return h("div", { class: "md-zone " + side, "aria-hidden": "true" },
    p.avatar ? spriteEl(p.avatar, { cls: "idle" }) : null,
    h("span", null, side.toUpperCase()),
    p.name ? h("span", { class: "nm" }, p.name) : null);
}

const photoSrc = (card) => "assets/babyphotos/" + card.file;

function cardFace(card) {
  return card.kind === "photo"
    ? h("div", { class: "md-photo" }, h("img", { src: photoSrc(card), alt: "A BABY PHOTO", draggable: "false" }))
    : h("div", { class: "md-text" }, card.text || "");
}

function stamps() {
  return [h("div", { class: "md-stamp mom", "aria-hidden": "true" }, "MOM"), h("div", { class: "md-stamp dad", "aria-hidden": "true" }, "DAD")];
}

function setStamp(card, side, k) {
  const m = card.querySelector(".md-stamp.mom"), d = card.querySelector(".md-stamp.dad");
  if (m) m.style.opacity = side === "mom" ? String(k) : "0";
  if (d) d.style.opacity = side === "dad" ? String(k) : "0";
}

function setHot(zones, side) {
  SIDES.forEach((s) => zones[s] && zones[s].classList.toggle("hot", side === s));
}

let inst = null;        // the live mount, reachable by autoplay() and unmount()
let demoTimer = null;

export default {
  id: "momordad",
  progressive: false,

  // How-to loop: a card slides to MOM, back, to DAD, back, stamping as it goes.
  howtoDemo(el, content) {
    ensureCss();
    const parents = (content && content.parents) || {};
    const zones = { mom: zoneEl("mom", parents), dad: zoneEl("dad", parents) };
    const card = h("div", { class: "md-card", "aria-hidden": "true" }, h("div", { class: "md-text" }, "SWIPE ME!"), ...stamps());
    el.appendChild(h("div", { class: "md-demo" }, zones.mom, zones.dad, card));
    const steps = [["mom", "translate(-70%, 0) rotate(-14deg)"], [null, ""], ["dad", "translate(70%, 0) rotate(14deg)"], [null, ""]];
    let k = 0;
    const step = () => { const [side, tf] = steps[k++ % steps.length]; card.style.transform = tf; setStamp(card, side, side ? 1 : 0); setHot(zones, side); };
    clearInterval(demoTimer);
    demoTimer = setInterval(step, 800);
    setTimeout(step, 300);
    return () => clearInterval(demoTimer);
  },

  mount(el, content, api) {
    ensureCss();
    const cards = content.cards || [];
    const parents = content.parents || {};
    const total = cards.length;
    const cardMs = content.cardMs || 6000;
    // Resume where a reload left off: the picks already sent are in myAnswer.
    const you = api.you && api.you();
    const prev = you && you.myAnswer && Array.isArray(you.myAnswer.picks) ? you.myAnswer.picks : [];
    const picks = prev.slice(0, total).map((p) => (SIDES.includes(p) ? p : null));
    let idx = picks.length;
    let busy = false, card = null, cardTimer = null, raf = 0, deadline = 0;
    const me = { stop: false, done: false, choose: null, auto: null, clear: null };
    inst = me;

    const counter = h("b", null, "");
    const bar = h("i");
    const barWrap = h("div", { class: "md-bar", "aria-hidden": "true" }, bar);
    const zones = { mom: zoneEl("mom", parents), dad: zoneEl("dad", parents) };
    const arena = h("div", { class: "md-arena" }, zones.mom, zones.dad);
    const btnMom = h("button", { class: "btn mom", type: "button", "aria-label": "Mom" }, h("i", { class: "tri-l" }), "MOM");
    const btnDad = h("button", { class: "btn dad", type: "button", "aria-label": "Dad" }, "DAD", h("i", { class: "tri" }));
    btnMom.addEventListener("click", () => choose("mom"));
    btnDad.addEventListener("click", () => choose("dad"));
    appendTo(el,
      h("h2", { class: "title" }, content.title || "MOM OR DAD?"),
      h("div", { class: "md-head" }, counter, h("span", null, "SWIPE OR TAP")),
      barWrap,
      arena,
      h("div", { class: "md-btns" }, btnMom, btnDad));

    function tick() {
      const left = Math.max(0, deadline - performance.now());
      bar.style.transform = "scaleX(" + (left / cardMs).toFixed(3) + ")";
      barWrap.classList.toggle("urgent", left > 0 && left < 2000);
      if (left > 0) raf = requestAnimationFrame(tick);
    }

    function showCard() {
      counter.textContent = "CARD " + (idx + 1) + "/" + total;
      card = h("div", { class: "md-card enter", role: "group", "aria-label": "Card " + (idx + 1) + " of " + total }, cardFace(cards[idx]), ...stamps());
      attachSwipe(card);
      arena.appendChild(card);
      // Six seconds a card, but never more than the round has left.
      const roundLeft = api.timeLeft ? api.timeLeft() : cardMs;
      const ms = Math.max(1200, Math.min(cardMs, roundLeft - 300));
      deadline = performance.now() + ms;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      clearTimeout(cardTimer);
      cardTimer = setTimeout(() => choose(null), ms);
    }

    function finish() {
      me.done = true;
      counter.textContent = "CARD " + total + "/" + total;
      bar.style.transform = "scaleX(0)";
      barWrap.classList.remove("urgent");
      btnMom.disabled = btnDad.disabled = true;
      arena.appendChild(h("div", { class: "md-card done pop" },
        h("div", null, "ALL " + total + " SWIPED!"),
        you && you.avatar ? spriteEl(you.avatar, { cls: "idle" }) : null,
        h("div", { class: "tiny" }, "WAITING FOR THE OTHERS...")));
    }

    // The one way a card leaves: by swipe, by tap, by autoplay or by the clock (null).
    function choose(side) {
      if (me.stop || busy || idx >= total || !card) return;
      busy = true;
      clearTimeout(cardTimer);
      cancelAnimationFrame(raf);
      const pick = SIDES.includes(side) ? side : null;
      picks[idx] = pick;
      const c = card;
      card = null;
      c.classList.remove("enter", "ease", "drag");
      c.classList.add("fly");
      setStamp(c, pick, 1);
      c.style.transform = pick === "mom" ? "translate(-140%, -6%) rotate(-24deg)" : pick === "dad" ? "translate(140%, -6%) rotate(24deg)" : "translate(0, 70%)";
      setHot(zones, null);
      if (pick) { api.sfx("select"); api.vibrate(15); } else api.sfx("thunk");
      idx++;
      const last = idx >= total;
      api.submit({ picks: picks.slice() }, { final: last, label: last ? picks.filter(Boolean).length + "/" + total + " SWIPED" : undefined });
      setTimeout(() => {
        c.remove();
        busy = false;
        if (me.stop) return;
        if (idx < total) showCard(); else finish();
      }, 290);
    }
    me.choose = choose;
    me.clear = () => { clearTimeout(cardTimer); cancelAnimationFrame(raf); clearInterval(me.auto); };

    function attachSwipe(c) {
      let pid = null, sx = 0, sy = 0, dx = 0, dy = 0, on = false;
      const width = () => c.offsetWidth || 200;
      c.addEventListener("pointerdown", (e) => {
        if (busy || on) return;
        on = true; pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0;
        c.classList.remove("enter", "ease");
        c.classList.add("drag");
        try { c.setPointerCapture(pid); } catch (err) { /* ignore */ }
        e.preventDefault();
      });
      c.addEventListener("pointermove", (e) => {
        if (!on || e.pointerId !== pid) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        const f = Math.max(-1, Math.min(1, dx / (width() * 0.25)));
        c.style.transform = "translate(" + dx + "px, " + (dy * 0.25) + "px) rotate(" + (f * 12) + "deg)";
        const side = dx < 0 ? "mom" : "dad";
        setStamp(c, side, Math.abs(f));
        setHot(zones, Math.abs(f) > 0.35 ? side : null);
      });
      const end = (e) => {
        if (!on || (e && e.pointerId != null && e.pointerId !== pid)) return;
        on = false;
        c.classList.remove("drag");
        try { c.releasePointerCapture(pid); } catch (err) { /* ignore */ }
        if (Math.abs(dx) >= width() * 0.25) { choose(dx < 0 ? "mom" : "dad"); return; }
        c.classList.add("ease");
        c.style.transform = "";
        setStamp(c, null, 0);
        setHot(zones, null);
        setTimeout(() => c.classList.remove("ease"), 250);
      };
      c.addEventListener("pointerup", end);
      c.addEventListener("pointercancel", end);
    }

    if (idx < total) showCard(); else finish();
  },

  unmount() {
    clearInterval(demoTimer);
    if (inst) { inst.stop = true; if (inst.clear) inst.clear(); inst = null; }
  },

  // Rehearsal only: a random swipe every 1.5 s through the same choose().
  autoplay(el, content, api) {
    const me = inst;
    if (!me) return;
    clearInterval(me.auto);
    me.auto = setInterval(() => {
      if (me.stop || me.done || !me.choose) { clearInterval(me.auto); return; }
      me.choose(Math.random() < 0.5 ? "mom" : "dad");
    }, 1500);
  },

  async reveal(el, reveal, api) {
    ensureCss();
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const parents = reveal.parents || {};
    const cards = reveal.cards || [];
    const mine = you && you.myAnswer && Array.isArray(you.myAnswer.picks) ? you.myAnswer.picks : [];
    const alive = () => el.isConnected !== false;
    appendTo(el, h("h2", { class: "title" }, reveal.title || "MOM OR DAD?"));
    if (reveal.demoAnswers) el.appendChild(h("div", { class: "callout red" }, "DEMO ANSWERS", h("small", { style: { textTransform: "none" } }, "FILL IN data/momordad.js")));
    const list = h("div", { class: "md-rlist" });
    const flips = cards.map((c, k) => {
      const p = parents[c.answer] || {};
      const my = SIDES.includes(mine[k]) ? mine[k] : null;
      const q = () => (c.kind === "photo"
        ? h("div", { class: "md-thumb" }, h("img", { src: photoSrc(c), alt: "A BABY PHOTO" }))
        : h("div", { class: "md-q" }, c.text || ""));
      const back = h("div", { class: "md-face back" },
        c.kind === "photo" ? h("div", { class: "md-thumb small" }, h("img", { src: photoSrc(c), alt: "" })) : h("div", { class: "md-q" }, c.text || ""),
        h("div", { class: "md-who " + (c.answer || "") }, p.avatar ? spriteEl(p.avatar, { cls: "hop" }) : null, h("span", null, String(c.answer || "?").toUpperCase() + (p.name ? " · " + p.name : ""))),
        h("div", { class: "md-split", "aria-hidden": "true" }, h("i", { class: "m" }), h("i", { class: "d" })),
        h("div", { class: "md-pct" }, h("span", { class: "m" }, (c.momPct || 0) + "% MOM"), " · ", h("span", { class: "d" }, (c.dadPct || 0) + "% DAD")),
        you ? h("div", { class: "md-mine " + (my ? (my === c.answer ? "ok" : "no") : "none") }, my ? "YOU: " + my.toUpperCase() + (my === c.answer ? " ✓" : " ✗") : "YOU: NO SWIPE ✗") : null);
      const f = h("div", { class: "md-flip" }, h("div", { class: "md-face front" }, q(), h("div", { class: "tiny" }, "CARD " + (k + 1))), back);
      list.appendChild(f);
      return { f, c };
    });
    el.appendChild(list);
    await wait(api.big ? 900 : 600);
    for (const { f, c } of flips) {
      if (!alive()) return;
      f.classList.add("in");
      api.sfx("pop");
      const m = f.querySelector(".md-split .m"), d = f.querySelector(".md-split .d");
      setTimeout(() => { if (m) m.style.width = (c.momPct || 0) + "%"; if (d) d.style.width = (c.dadPct || 0) + "%"; }, 300);
      await wait(900);
    }
    if (!alive()) return;
    if (you) {
      const n = cards.filter((c, k) => mine[k] === c.answer).length;
      const perfect = cards.length > 0 && n === cards.length;
      el.appendChild(h("div", { class: "panel dark center pop" },
        h("div", { class: "label" }, "YOUR SWIPES"),
        h("div", { class: "md-you" }, "YOU GOT " + n + "/" + cards.length),
        perfect ? h("div", { class: "gold" }, "PERFECT! +100") : null));
      api.sfx(perfect ? "win" : "coin");
      await wait(500);
    }
    const perfect = reveal.perfect || 0;
    el.appendChild(h("div", { class: "callout " + (perfect ? "green" : "") }, "PERFECT: " + perfect + " PLAYER" + (perfect === 1 ? "" : "S"), h("small", null, perfect ? "5 OUT OF 5. THEY KNOW YOU TOO WELL." : "NOBODY GOT ALL FIVE.")));
    const best = (reveal.best || []).map((id) => byId[id]).filter(Boolean);
    if (best.length) {
      const wrap = h("div", { class: "md-best" });
      best.forEach((r, i) => wrap.appendChild(h("div", { class: "center" }, spriteEl(r.avatar, { cls: "hop" }), h("div", { class: "tiny" }, (i === 0 ? "TOP: " : "") + r.name))));
      appendTo(el, h("p", { class: "sub mt" }, "BEST SWIPERS"), wrap);
    }
  },

  // TV / host STAGE: the two parents face off while the room swipes.
  stageView(el, content, api) {
    ensureCss();
    const parents = content.parents || {};
    const side = (s) => {
      const p = parents[s] || {};
      return h("div", { class: "side " + s }, p.avatar ? spriteEl(p.avatar, { size: "lg", cls: "idle" }) : null, h("div", { class: "lbl" }, s.toUpperCase()), p.name ? h("div", { class: "tiny" }, p.name) : null);
    };
    appendTo(el,
      h("h2", { class: "title big" }, content.title || "MOM OR DAD?"),
      h("p", { class: "sub" }, "SWIPE LEFT FOR MOM, RIGHT FOR DAD · " + (content.count || 5) + " CARDS"),
      h("div", { class: "md-vs" }, side("mom"), h("div", { class: "vs" }, "VS"), side("dad")));
    const cnt = h("div", { class: "counter center" }, "0 LOCKED IN");
    const more = h("p", { class: "sub" }, "");
    appendTo(el, cnt, more);
    return {
      update(live, snap) {
        const locked = live && live.locked != null ? live.locked : (snap && snap.answerCount) || 0;
        cnt.textContent = locked + " LOCKED IN";
        const answered = live && live.answered != null ? live.answered : null;
        more.textContent = answered != null && answered > locked ? (answered - locked) + " STILL SWIPING" : "";
      }
    };
  }
};
