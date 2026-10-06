// BOSS BATTLE (client). A 4-option quiz framed as a boss fight: a pixel boss
// (KING BINKY, a giant pacifier drawn with one box-shadow sprite) with an HP
// bar above the question; every correct answer in the room hits it.
import { h, appendTo, clear, countUp, wait, rain } from "../engine/dom.js";
import { spriteEl } from "../engine/avatars.js";

const GLYPHS = ["▲", "◆", "●", "■"];
const ROUNDS = 3;

// ------------------------------------------------------------ the boss
// 16 x 22 pixel pacifier: crown, ring, shield with angry eyes, teat.
const PAL = { K: "#1d1b18", G: "#ffd84a", O: "#d9a92c", R: "#e0283a", C: "#ead7b8", W: "#ffffff" };
const SPRITE = [
  "....K..KK..K....",
  "....KGKGGKGK....",
  "....KGGGGGGK....",
  "....KKKKKKKK....",
  ".....KRRRRK.....",
  "....KRK..KRK....",
  "....KRK..KRK....",
  ".....KRRRRK.....",
  "..KKKKKKKKKKKK..",
  ".KGGGGGGGGGGGGK.",
  "KGGKGGGGGGGGKGGK",
  "KGGGKGGGGGGKGGGK",
  "KGGKKKGGGGKKKGGK",
  "KGGKWKGGGGKWKGGK",
  "KGGKKKGGGGKKKGGK",
  "KGGGGKGGGGKGGGGK",
  ".KOOOOKKKKOOOOK.",
  "..KKKKKKKKKKKK..",
  ".....KCCCCK.....",
  ".....KCCCCK.....",
  "......KCCK......",
  ".......KK......."
];
const SPRITE_W = SPRITE[0].length, SPRITE_H = SPRITE.length;

function shadowFor(colorOf) {
  const out = [];
  SPRITE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      out.push(x + "em " + y + "em 0 " + colorOf(ch));
    }
  });
  return out.join(",");
}
const SHADOW = shadowFor((ch) => PAL[ch]);
const SHADOW_HIT = shadowFor((ch) => (ch === "K" ? "#5a0a12" : ch === "W" ? "#fff" : "#ff6b78"));

const fmtHp = (hp, max) => "HP " + Math.max(0, Math.round(hp)).toLocaleString("en-CA") + "/" + Math.round(max).toLocaleString("en-CA");

// The arena: boss sprite + name + HP bar. Returns handles for the animations.
function bossArena(content, { big = false } = {}) {
  const sprite = h("div", { class: "boss-sprite", "aria-hidden": "true" });
  sprite.style.boxShadow = SHADOW;
  const body = h("div", { class: "boss-body bob" }, sprite);
  const stage = h("div", { class: "boss-stage" }, body);
  const num = h("span", { class: "boss-hp-num", "aria-live": "polite" }, fmtHp(content.bossHp, content.bossMax));
  const fill = h("i", { class: "boss-hp-fill" });
  fill.style.width = pct(content.bossHp, content.bossMax) + "%";
  const hp = h("div", { class: "boss-hp" },
    h("div", { class: "boss-hp-head" }, h("span", { class: "boss-nm" }, content.bossName || "THE BOSS"), num),
    h("div", { class: "boss-hp-track", role: "img", "aria-label": fmtHp(content.bossHp, content.bossMax) }, fill));
  const el = h("div", { class: "panel dark boss-arena" + (big ? " big" : "") }, stage, hp);
  return {
    el, body, sprite, stage, fill, num,
    setHp(v, max) { fill.style.width = pct(v, max) + "%"; num.textContent = fmtHp(v, max); },
    hit() {
      sprite.style.boxShadow = SHADOW_HIT;
      body.classList.remove("bob"); body.classList.add("shake");
      let n = 0;
      const t = setInterval(() => { n++; sprite.style.boxShadow = n % 2 ? SHADOW : SHADOW_HIT; if (n >= 5) { clearInterval(t); sprite.style.boxShadow = SHADOW; } }, 110);
      setTimeout(() => { body.classList.remove("shake"); body.classList.add("bob"); }, 650);
    },
    ko() { body.classList.remove("bob", "shake"); body.classList.add("ko"); },
    float(text, cls = "") {
      const f = h("div", { class: "boss-dmg " + cls, "aria-hidden": "true" }, text);
      stage.appendChild(f);
      setTimeout(() => f.remove(), 1400);
    },
    slash() {
      const s = h("div", { class: "boss-slash", "aria-hidden": "true" });
      stage.appendChild(s);
      for (let i = 0; i < 3; i++) {
        const sp = h("i", { class: "spark boss-spark" });
        sp.style.left = (20 + Math.random() * 60) + "%";
        sp.style.top = (20 + Math.random() * 50) + "%";
        sp.style.animationDelay = (i * 70) + "ms";
        stage.appendChild(sp);
        setTimeout(() => sp.remove(), 700);
      }
      setTimeout(() => s.remove(), 450);
    }
  };
}

const buzz = (api, p) => { try { if (api && typeof api.vibrate === "function") api.vibrate(p); } catch (e) { /* ignore */ } };

function pct(v, max) { return max > 0 ? Math.max(0, Math.min(100, 100 * v / max)) : 0; }

function optionRow(i, text, { tag = "div", extra = "" } = {}) {
  return h(tag, { class: "boss-opt c" + i + " " + extra, type: tag === "button" ? "button" : null },
    h("span", { class: "glyph", "aria-hidden": "true" }, GLYPHS[i]),
    h("span", { class: "txt" }, text));
}

// --------------------------------------------------------------- styles
// game.css is shared and not ours to edit: the boss styles ride along here.
function ensureCss() {
  if (document.getElementById("boss-css")) return;
  const css = `
.boss-arena { display: flex; align-items: center; gap: 14px; padding: 10px 12px; position: relative; overflow: hidden; --boss-px: 5px; }
.boss-arena.big { --boss-px: 7px; gap: 24px; padding: 16px 20px; }
html[data-screen="tv"] .boss-arena { --boss-px: 9px; gap: 40px; padding: 20px 32px; }
html[data-screen="tv"] .boss-arena.big { --boss-px: 11px; }
.boss-stage { flex: none; position: relative; width: ${SPRITE_W}em; height: ${SPRITE_H}em; font-size: var(--boss-px); margin: 0 auto; }
.boss-body { position: relative; width: ${SPRITE_W}em; height: ${SPRITE_H}em; }
.boss-body.bob { animation: boss-bob 1.4s steps(2) infinite; }
.boss-body.shake { animation: boss-shake .55s steps(7) 1; }
.boss-body.ko { animation: boss-ko 1.2s steps(14) 1 forwards; }
.boss-sprite { position: absolute; left: 0; top: 0; width: 1em; height: 1em; }
.boss-hp { flex: 1; min-width: 0; }
.boss-hp-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 8px; font-size: .78em; margin-bottom: 6px; color: var(--cream-2); }
.boss-hp-head .boss-nm { color: var(--gold); white-space: nowrap; }
.boss-hp-head .boss-hp-num { white-space: nowrap; font-size: .85em; margin-left: auto; }
.boss-hp-track { height: 20px; border: 3px solid var(--ink); background: var(--cream-2); box-shadow: 2px 2px 0 #000; overflow: hidden; }
.boss-hp-fill { display: block; height: 100%; background: var(--red); box-shadow: inset 0 5px 0 #ff6b78, inset 0 -4px 0 #8a1420; transition: width .9s steps(18); }
html[data-screen="tv"] .boss-hp-track { height: 36px; }
.boss-dmg { position: absolute; left: 50%; top: 10%; transform: translateX(-50%); color: #ff6b78; font-size: 3em; font-family: var(--font); white-space: nowrap; text-shadow: 3px 3px 0 #000; animation: boss-float 1.3s steps(12) 1 forwards; z-index: 6; }
.boss-dmg.gold { color: var(--gold); }
.boss-slash { position: absolute; left: 50%; top: -10%; width: .9em; height: 120%; background: #fff; box-shadow: 0 0 0 .3em var(--gold); transform-origin: top center; transform: translateX(-50%) rotate(32deg) scaleY(0); animation: boss-slash .4s steps(5) 1 forwards; z-index: 5; }
.boss-spark { width: 3.2em; height: 3.2em; animation: boss-spark .6s steps(4) 1 forwards; }
.boss-q { font-size: 1em; line-height: 1.6; text-align: center; }
.boss-q.big { font-size: 1.3em; padding: 20px 28px; }
.boss-opts { display: flex; flex-direction: column; gap: 10px; margin: 0 0 14px; }
.boss-opts.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.boss-opt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 62px; padding: 10px 14px; margin: 0; color: var(--ink); background: var(--cream); border: 4px solid var(--ink); box-shadow: inset -4px -4px 0 rgba(0,0,0,.22), inset 4px 4px 0 rgba(255,255,255,.4), 4px 4px 0 #000; font-size: .9em; line-height: 1.4; letter-spacing: .04em; text-align: left; text-transform: uppercase; position: relative; }
.boss-opt .glyph { flex: none; width: 1.3em; font-size: 1.5em; line-height: 1; text-align: center; }
.boss-opt .txt { flex: 1; min-width: 0; }
.boss-opt.c0 { background: var(--green); }
.boss-opt.c1 { background: var(--blue); }
.boss-opt.c2 { background: var(--red); }
.boss-opt.c3 { background: var(--gold); }
button.boss-opt:active { transform: translate(2px, 2px); box-shadow: inset -4px -4px 0 rgba(0,0,0,.22), inset 4px 4px 0 rgba(255,255,255,.4), 2px 2px 0 #000; }
.boss-opt.picked { box-shadow: inset 0 0 0 4px #fff, 4px 4px 0 #000; }
.boss-opt.picked .glyph { animation: blink .6s steps(2) infinite; }
.boss-opt.rv { min-height: 56px; }
.boss-opt.dim { opacity: .45; filter: saturate(.3); }
.boss-opt.right { animation: boss-right .5s steps(4) 2; box-shadow: 0 0 0 4px var(--green), 4px 4px 0 #000; }
.boss-opt.mine::after { content: "YOU"; position: absolute; right: -6px; top: -10px; background: var(--gold); color: var(--ink); border: 3px solid var(--ink); font-size: .65em; padding: 2px 6px; line-height: 1.2; }
.boss-opt .cnt { flex: none; font-size: .8em; color: var(--ink); min-width: 2.2em; text-align: right; }
.boss-opt .bar { position: absolute; left: 4px; right: 4px; bottom: 2px; height: 6px; background: rgba(0,0,0,.25); }
.boss-opt .bar i { display: block; height: 100%; width: 0; background: var(--ink); transition: width .8s steps(12); }
.boss-opt.right .bar i { background: #fff; }
.boss-title { margin-top: 2px; font-size: 1.25em; }
.boss-stamp { display: inline-block; padding: 10px 18px; border: 5px solid var(--gold); color: var(--gold); font-size: 1.5em; transform: rotate(-8deg); background: rgba(0,0,0,.5); animation: stamp-in .35s steps(5) 1; text-shadow: 3px 3px 0 #000; }
.boss-demo { --boss-px: 7px; position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 0 6px; overflow: hidden; }
html[data-screen="tv"] .boss-demo { --boss-px: 11px; }
.boss-demo .boss-hp { width: min(100%, 320px); }
@keyframes boss-bob { 50% { transform: translateY(-.8em); } }
@keyframes boss-shake { 0%, 100% { transform: none; } 15% { transform: translate(-1.6em, .2em); } 35% { transform: translate(1.4em, -.4em); } 55% { transform: translate(-1em, .3em); } 75% { transform: translate(.8em, 0); } }
@keyframes boss-ko { 0% { transform: none; opacity: 1; } 25% { transform: translateY(-3em) rotate(-14deg); opacity: 1; } 100% { transform: translateY(60em) rotate(50deg); opacity: 0; } }
@keyframes boss-float { 0% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, -3.5em); opacity: 0; } }
@keyframes boss-slash { 0% { transform: translateX(-50%) rotate(32deg) scaleY(0); opacity: 1; } 55% { transform: translateX(-50%) rotate(32deg) scaleY(1); opacity: 1; } 100% { transform: translateX(-50%) rotate(32deg) scaleY(1); opacity: 0; } }
@keyframes boss-spark { 0% { transform: scale(.3); opacity: 1; } 100% { transform: scale(1.4) rotate(45deg); opacity: 0; } }
@keyframes boss-right { 50% { filter: brightness(1.35); } }
`;
  document.head.appendChild(h("style", { id: "boss-css" }, css));
}

// --------------------------------------------------------------- module
let current = null;      // { choose } for the round on screen (autoplay uses it)
let autoTimer = null;
let demoStop = null;

export default {
  id: "boss",
  progressive: false,

  // How-to loop: the boss bobbing, a sword slash lands every couple of seconds.
  howtoDemo(el, content) {
    ensureCss();
    if (demoStop) demoStop();
    const max = (content && content.bossMax) || 48000;
    const arena = bossArena({ bossName: (content && content.bossName) || "KING BINKY", bossMax: max, bossHp: (content && content.bossHp) || max });
    const wrap = h("div", { class: "boss-demo" }, arena.stage, arena.el.querySelector(".boss-hp"));
    appendTo(el, wrap);
    let hp = max, timer = null;
    const tick = () => {
      if (!el.isConnected) { stop(); return; }
      arena.slash();
      setTimeout(() => {
        if (!el.isConnected) return;
        arena.hit();
        hp -= max * 0.18;
        if (hp <= 0) hp = max;
        arena.setHp(hp, max);
        arena.float("-" + Math.round(max * 0.18).toLocaleString("en-CA"));
      }, 180);
    };
    timer = setInterval(tick, 1900);
    setTimeout(tick, 500);
    const stop = () => { clearInterval(timer); timer = null; if (demoStop === stop) demoStop = null; };
    demoStop = stop;
    return stop;
  },

  mount(el, content, api) {
    ensureCss();
    const you = api.you && api.you();
    let picked = typeof (you && you.myAnswer) === "number" ? you.myAnswer : null;
    const arena = bossArena(content);
    const btns = (content.options || []).map((opt, i) => optionRow(i, opt, { tag: "button" }));
    const choose = (i) => {
      if (!(i >= 0 && i < btns.length)) return;
      picked = i;
      btns.forEach((b, j) => b.classList.toggle("picked", j === i));
      arena.slash();
      api.sfx("slash");
      buzz(api, 20);
      api.submit(i, { label: GLYPHS[i] + " " + content.options[i] });
    };
    btns.forEach((b, i) => b.addEventListener("click", () => choose(i)));
    if (picked != null && btns[picked]) btns[picked].classList.add("picked");
    current = { choose, count: btns.length };
    appendTo(el,
      h("h2", { class: "title boss-title" }, content.title || "BOSS BATTLE"),
      arena.el,
      h("div", { class: "panel boss-q", role: "heading", "aria-level": "3" }, content.q),
      h("div", { class: "boss-opts" }, ...btns));
  },

  unmount() {
    current = null;
    clearTimeout(autoTimer); autoTimer = null;
    if (demoStop) demoStop();
  },

  // Rehearsal only: tap a random option after 1-4 s, through the same choose().
  autoplay(el, content, api) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { if (current) current.choose(Math.floor(Math.random() * current.count)); }, 1000 + Math.random() * 3000);
  },

  async reveal(el, reveal, api) {
    ensureCss();
    const you = api.you && api.you();
    const board = (api.results && api.results.board) || [];
    const byId = Object.fromEntries(board.map((r) => [r.id, r]));
    const mine = you && typeof you.myAnswer === "number" ? you.myAnswer : null;
    const alive = () => el.isConnected;
    const max = reveal.bossMax || 1;
    const round = (api.results && api.results.round) || 1;
    const texts = Array.isArray(reveal.options) && reveal.options.length === 4 ? reveal.options : GLYPHS.map((g, i) => "OPTION " + (i + 1));

    const arena = bossArena({ bossName: reveal.bossName || "KING BINKY", bossMax: max, bossHp: reveal.bossHpBefore }, { big: !!api.big });
    appendTo(el, h("h2", { class: "title boss-title" }, "THE ANSWER"), arena.el);

    // 1. The options: correct lights up, wrong ones dim, your pick is marked,
    //    the room split fills in as a bar on each row.
    const answered = Math.max(1, reveal.answered || (reveal.split || []).reduce((s, n) => s + n, 0) || 1);
    const rows = texts.map((t, i) => {
      const row = optionRow(i, t, { extra: "rv" + (i === reveal.answer ? " right" : " dim") + (mine === i ? " mine" : "") });
      row.appendChild(h("span", { class: "cnt" }, String((reveal.split && reveal.split[i]) || 0)));
      row.appendChild(h("span", { class: "bar", "aria-hidden": "true" }, h("i")));
      return row;
    });
    const list = h("div", { class: "boss-opts" + (api.big ? " grid" : "") }, ...rows);
    el.appendChild(list);
    api.sfx(mine == null ? "pop" : mine === reveal.answer ? "coin" : "error");
    if (mine === reveal.answer) buzz(api, [30, 40, 30]);
    await wait(80);
    rows.forEach((row, i) => { row.querySelector(".bar i").style.width = pct((reveal.split && reveal.split[i]) || 0, answered) + "%"; });
    el.appendChild(h("div", { class: "panel" }, h("strong", null, "FACT: "), reveal.fact || ""));
    el.appendChild(h("p", { class: "sub" }, (reveal.correctCount || 0) + " OF " + answered + " GOT IT" + (mine == null ? "" : mine === reveal.answer ? " · YOU HIT!" : " · YOU MISSED")));
    await wait(api.big ? 1600 : 1100);
    if (!alive()) return;

    // 2. The boss takes the hit.
    const dmg = reveal.damage || 0;
    const before = reveal.bossHpBefore || 0, after = Math.max(0, reveal.bossHpAfter || 0);
    if (dmg > 0 && !reveal.alreadyDown) {
      arena.slash();
      api.sfx("slash");
      await wait(220);
      if (!alive()) return;
      arena.hit();
      arena.float("-" + dmg.toLocaleString("en-CA"));
      buzz(api, [40, 30, 60]);
      arena.fill.style.width = pct(after, max) + "%";
      await countUp(arena.num, before, after, 900, { format: (n) => fmtHp(n, max), onTick: () => api.sfx("tick", 0.03), every: 500 });
      api.sfx("thunder");
      await wait(500);
      if (!alive()) return;
    } else if (reveal.alreadyDown) {
      arena.float("OVERKILL", "gold");
      api.sfx("pop");
      await wait(500);
    } else {
      arena.float("MISS", "gold");
      api.sfx("error");
      await wait(600);
    }
    if (!alive()) return;

    // 3. Defeated? KO, stamp, confetti. Otherwise the status line.
    const stampWrap = h("div", { class: "center", style: { margin: "6px 0 14px" } });
    el.appendChild(stampWrap);
    if (reveal.defeated) {
      arena.ko();
      api.sfx("fanfare");
      buzz(api, [60, 40, 60, 40, 120]);
      await wait(300);
      stampWrap.appendChild(h("div", { class: "boss-stamp" }, reveal.alreadyDown ? "STILL DOWN!" : "BOSS DEFEATED!"));
      rain(api.big ? 40 : 26, 2800);
      stampWrap.appendChild(h("p", { class: "sub mt" }, reveal.alreadyDown ? (reveal.bossName || "THE BOSS") + " WAS ALREADY OUT COLD." : "THE ROOM BEAT " + (reveal.bossName || "THE BOSS") + " TOGETHER!"));
    } else {
      const left = Math.round(after).toLocaleString("en-CA");
      stampWrap.appendChild(h("div", { class: "callout " + (reveal.lastRound ? "red" : "") },
        reveal.lastRound ? (reveal.bossName || "THE BOSS") + " SURVIVES!" : left + " HP LEFT",
        h("small", null, reveal.lastRound ? "THE ROOM RAN OUT OF ROUNDS. REMATCH AT THE NEXT SHOWER." : "ROUND " + Math.min(ROUNDS, round + 1) + ": FINISH THE JOB")));
      if (reveal.lastRound) api.sfx("over"); else api.sfx("drum");
    }

    // 4. Fastest three correct.
    const best = (reveal.best || []).map((id) => byId[id]).filter(Boolean);
    if (best.length) {
      const wrap = h("div", { class: "row", style: { justifyContent: "center", gap: "14px", marginTop: "8px" } });
      best.forEach((r, i) => wrap.appendChild(h("div", { class: "center" }, spriteEl(r.avatar, { cls: "hop" }), h("div", { class: "tiny" }, (i === 0 ? "FIRST HIT: " : "") + r.name))));
      el.appendChild(h("p", { class: "sub" }, "FASTEST HITS"));
      el.appendChild(wrap);
    }
  },

  // TV / host STAGE during play: the boss big, the question, the options (no
  // answer) and the locked-in count.
  stageView(el, content, api) {
    ensureCss();
    const arena = bossArena(content, { big: true });
    const cnt = h("div", { class: "counter center" }, "0 LOCKED IN");
    appendTo(el,
      h("h2", { class: "title big" }, content.title || "BOSS BATTLE"),
      arena.el,
      h("div", { class: "panel boss-q big" }, content.q),
      h("div", { class: "boss-opts grid" }, ...(content.options || []).map((opt, i) => optionRow(i, opt))),
      cnt);
    let last = 0;
    return {
      update(live, snap) {
        const n = (live && live.answered) || (snap && snap.answerCount) || 0;
        cnt.textContent = n + " LOCKED IN";
        if (n > last) { arena.slash(); api.sfx("slash", 0.03); }
        last = n;
      }
    };
  }
};
