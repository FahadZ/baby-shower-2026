// The player's phone. Joins the room, renders every phase, mounts the games
// and plays the hype sequences. Everything on screen is a function of the
// server's latest snapshot plus this player's own "you" message.
import { connect } from "./engine/net.js";
import { h, appendTo, $, clear, store, toast, wait, announce, vibrate } from "./engine/dom.js";
import * as audio from "./engine/audio.js";
import { spriteEl, ROSTER, PALETTES, avatarName, randomFree, preloadAvatars, hop, bubble, avatarFile } from "./engine/avatars.js";
import { franchises } from "./data/avatars.js";
import { countdown } from "./engine/countdown.js";
import { showRoundResults, showLeaderboard, showFinal } from "./engine/hype.js";
import { preloadMoves } from "./engine/moves.js";
import { getGame } from "./games/index.js";

const app = $("#app");
const AUTO = new URLSearchParams(location.search).get("auto") === "1";
const hudStatus = $("#netDot");
const hudTag = $("#hudTag");
const soundBtn = $("#soundBtn");

let snap = null, you = null, live = null;
let playerId = store("bl.playerId");
// With a saved id we assume we are still in (hello confirms it); a join-error flips this.
let joined = !!playerId, joinError = "", editing = false;
let screenKey = null;
let cur = { cancel: false, cd: null, game: null, seq: 0 };
let pendingLabel = null;
let wake = null;

// ------------------------------------------------------------ sound
const soundOn = store("bl.sound") === "on";
audio.enable(soundOn);
soundBtn.textContent = "SFX: " + (soundOn ? "ON" : "OFF");
soundBtn.addEventListener("click", () => {
  const on = !audio.isOn();
  audio.enable(on);
  store("bl.sound", on ? "on" : "off");
  soundBtn.textContent = "SFX: " + (on ? "ON" : "OFF");
  if (on) audio.sfx("coin");
});
document.addEventListener("pointerdown", () => { if (audio.isOn()) audio.enable(true); }, { passive: true });

// ---------------------------------------------------------- network
const net = connect({
  role: "player",
  onStatus(s) {
    hudStatus.className = "dot " + (s === "open" ? "on" : s === "connecting" ? "sync" : "");
    hudStatus.title = s;
  },
  onMessage
});
let pendingJoin = null;
net.onOpen(() => {
  if (pendingJoin) net.send(pendingJoin);
  else if (playerId) net.send({ t: "hello", playerId });
});

function onMessage(msg) {
  switch (msg.t) {
    case "state":
      snap = msg;
      render();
      break;
    case "you":
      you = msg;
      if (you.gone) { playerId = null; store("bl.playerId", null); joined = false; }
      render();
      break;
    case "joined":
      pendingJoin = null;
      playerId = msg.playerId;
      store("bl.playerId", playerId);
      joined = true; editing = false; joinError = "";
      if (msg.created) { audio.sfx("start"); vibrate(30); }
      requestWake();
      render(true);
      break;
    case "join-error":
      pendingJoin = null;
      if (msg.unknown) { playerId = null; store("bl.playerId", null); joined = false; }
      joinError = msg.error || "COULD NOT JOIN";
      audio.sfx("error");
      render(true);
      break;
    case "answer-ok":
      if (msg.final && cur.game && !cur.game.progressive) showLockedIn(pendingLabel);
      if (msg.final) audio.sfx("select");
      break;
    case "live":
      live = msg.stat;
      if (cur.game && cur.game.onLive) { try { cur.game.onLive(live); } catch (e) { /* ignore */ } }
      break;
    case "kicked":
      playerId = null; store("bl.playerId", null); joined = false;
      toast("THE HOST REMOVED YOU FROM THE GAME.", 4000);
      render(true);
      break;
    case "error":
      if (msg.error) toast(msg.error);
      break;
    default:
      break;
  }
}

async function requestWake() {
  try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* not allowed */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && joined) requestWake(); });

// ------------------------------------------------------------ render
function render(force) {
  if (!snap) return;
  const key = !joined || editing ? "join" : [snap.phase, snap.roundId, snap.revealNonce, snap.gameIndex, snap.practice ? "practice" : ""].join("|");
  // If this screen was built before our own "you" message arrived (reload mid-game), build it again with it.
  if (!force && key === screenKey && you && you.id && cur.youId !== you.id && key !== "join") force = true;
  if (hudTag) hudTag.textContent = snap.game && snap.phase !== "lobby" ? "G" + (snap.gameIndex + 1) + "/" + snap.gameCount + (snap.round ? " R" + snap.round : "") : (snap.playerCount || 0) + " PLAYERS";
  if (key !== screenKey || force) {
    teardown();
    screenKey = key;
    mount();
  } else {
    update();
  }
}

function teardown() {
  cur.cancel = true;
  if (cur.cd) cur.cd.stop();
  if (cur.game && cur.game.unmount) { try { cur.game.unmount(); } catch (e) { /* ignore */ } }
  cur = { cancel: false, cd: null, game: null, seq: cur.seq + 1, youId: null };
  clear(app);
  window.scrollTo(0, 0);
}

function gameApi() {
  const roundId = snap.roundId;
  return {
    submit(a, opts = {}) {
      pendingLabel = opts.label || null;
      net.send({ t: "answer", roundId, a, final: opts.final !== false });
    },
    timeLeft: () => Math.max(0, (snap.endsAt || 0) - net.now()),
    roundTime: snap.roundTime,
    now: net.now,
    sfx: audio.sfx,
    vibrate,
    you: () => you,
    players: () => (snap.results && snap.results.board) || snap.players || [],
    live: () => live,
    results: snap.results,
    content: snap.content || null,
    big: false,
    tv: false
  };
}

function showLockedIn(label) {
  const old = $(".locked-in");
  if (old) old.remove();
  const ov = h("div", { class: "locked-in" },
    h("div", { class: "stamp" }, "LOCKED IN ✓"),
    label ? h("p", { class: "mt", style: { fontSize: "1.2em" } }, label) : null,
    h("p", { class: "sub mt" }, "WAITING FOR THE OTHERS..."),
    you ? spriteEl(you.avatar, { cls: "idle" }) : null,
    h("button", { class: "link-btn", type: "button", onclick: () => ov.remove() }, "CHANGE MY ANSWER"));
  app.appendChild(ov);
  vibrate(20);
}

function hudLine(text) {
  return h("p", { class: "sub" }, text);
}

// The practice round: the host flipped PRACTICE on the how-to screen, so this phone
// runs the game's simplest level on its own clock. Nothing goes to the server. A final
// answer or the clock ends a try; TRY AGAIN starts another, with a fresh scene where
// the game builds one from the seed.
function mountPractice(g) {
  const me = cur;
  const base = snap.practiceContent;
  const ms = base.practiceMs || snap.roundTime || 30000;
  const wrap = h("div", { class: "screen" });
  app.appendChild(wrap);
  let run = 0, timer = null;
  const dropOverlay = () => { const ov = $(".locked-in"); if (ov) ov.remove(); };
  me.game = { progressive: true, unmount() { clearTimeout(timer); dropOverlay(); try { if (g.unmount) g.unmount(); } catch (e) { /* ignore */ } } };

  function start() {
    const thisRun = ++run;
    clearTimeout(timer);
    dropOverlay();
    if (me.cd) { me.cd.stop(); me.cd = null; }
    try { if (g.unmount) g.unmount(); } catch (e) { /* ignore */ }
    clear(wrap);
    const content = { ...base };
    if (base.seed != null) content.seed = (base.seed + thisRun - 1) >>> 0;
    const endsAt = net.now() + ms;
    const cdWrap = h("div", null);
    const body = h("div", { class: "game-surface" });
    appendTo(wrap,
      h("div", { class: "callout blue", style: { margin: "0 0 10px" } }, "PRACTICE ROUND", h("small", null, "NOTHING COUNTS. TRY THE CONTROLS.")),
      cdWrap, body,
      h("div", { class: "center mt" },
        h("button", { class: "btn small", type: "button", onclick: start }, "RESTART PRACTICE"),
        h("p", { class: "blink gold mt" }, "THE REAL ROUND STARTS WHEN PLAYER 1 SAYS GO")));
    me.cd = countdown(cdWrap, { endsAt, roundTime: ms, now: net.now, paused: false, sound: false });
    let over = false;
    const finish = (why, label, verdict) => {
      if (over || thisRun !== run || me.cancel) return;
      over = true;
      clearTimeout(timer);
      if (me.cd) { me.cd.stop(); me.cd = null; }
      const bad = !!(verdict && verdict.ok === false);
      audio.sfx(bad ? "thunk" : why === "time" ? "buzzer" : "win");
      // Let the game's own finish (ALL FOUND!, TIME!) show for a beat first.
      setTimeout(() => {
        if (thisRun !== run || me.cancel) return;
        const ov = h("div", { class: "locked-in" },
          h("div", { class: "stamp", style: bad ? { borderColor: "var(--gold)", color: "var(--gold)" } : null }, bad ? "NOT YET" : why === "time" ? "TIME!" : "NICE ✓"),
          label ? h("p", { class: "mt", style: { fontSize: "1.2em" } }, label) : null,
          verdict && verdict.text ? h("p", { class: "sub mt" }, verdict.text) : null,
          h("p", { class: "sub mt" }, "THAT WAS PRACTICE. NOTHING COUNTED."),
          h("button", { class: "btn primary mt", type: "button", onclick: () => { ov.remove(); start(); } }, "TRY AGAIN"),
          h("p", { class: "tiny mt" }, "THE REAL ROUND STARTS WHEN PLAYER 1 SAYS GO"));
        app.appendChild(ov);
      }, 900);
    };
    const api = {
      ...gameApi(),
      submit(a, opts = {}) {
        if (opts.final === false) return;
        finish("done", opts.label || null, g.practiceResult ? g.practiceResult(a, content) : null);
      },
      timeLeft: () => Math.max(0, endsAt - net.now()),
      roundTime: ms,
      you: () => (you ? { ...you, myAnswer: null, answered: false, answerFinal: false } : null),
      players: () => [],
      live: () => null,
      results: null,
      content
    };
    timer = setTimeout(() => finish("time", null, null), ms);
    try { g.mount(body, content, api); } catch (e) { console.error(e); body.appendChild(h("p", { class: "error" }, "SOMETHING BROKE. REFRESH!")); }
    if (AUTO && g.autoplay) setTimeout(() => { if (!me.cancel && thisRun === run) { try { g.autoplay(body, content, api); } catch (e) { console.error(e); } } }, 800 + Math.random() * 1500);
  }
  start();
}

function mount() {
  const me = cur;
  me.youId = you && you.id ? you.id : null;
  const cancelled = () => me.cancel;
  if (!joined || editing) return mountJoin();
  switch (snap.phase) {
    case "lobby": return mountLobby();
    case "intro": {
      audio.sfx("start");
      appendTo(app, 
        h("div", { class: "center screen", style: { paddingTop: "6vh" } },
          hudLine("GAME " + (snap.gameIndex + 1) + " OF " + snap.gameCount),
          h("h1", { class: "title big pop" }, snap.game.title),
          hudLine(snap.game.tagline),
          you ? spriteEl(you.avatar, { size: "lg", cls: "idle" }) : null,
          h("p", { class: "blink gold mt" }, "GET READY")));
      return;
    }
    case "howto": {
      const g = getGame(snap.game.id);
      if (snap.practice && snap.practiceContent && g) return mountPractice(g);
      const demo = h("div", { class: "panel dark" });
      appendTo(app, h("div", { class: "screen" },
        h("h2", { class: "title" }, (snap.howto && snap.howto.title) || snap.game.title),
        hudLine("ROUND " + snap.round + " OF " + snap.game.rounds + (snap.howto && snap.howto.points ? " · " + snap.howto.points : "")),
        h("div", { class: "panel" }, (snap.howto && snap.howto.text) || ""),
        demo));
      if (g && g.howtoDemo) { try { me.stopDemo = g.howtoDemo(demo, snap.content || {}); } catch (e) { /* ignore */ } }
      app.appendChild(h("p", { class: "blink gold center mt" }, "WAITING FOR PLAYER 1 TO START THE ROUND"));
      me.game = { unmount: () => { if (me.stopDemo) me.stopDemo(); } };
      return;
    }
    case "playing": {
      const g = getGame(snap.game.id);
      const cdWrap = h("div", null);
      app.appendChild(cdWrap);
      me.cd = countdown(cdWrap, { endsAt: snap.endsAt, roundTime: snap.roundTime, now: net.now, paused: snap.paused, sound: true });
      const body = h("div", { class: "screen game-surface" });
      app.appendChild(body);
      if (!g) { body.appendChild(h("p", { class: "sub" }, "THIS GAME IS NOT INSTALLED ON YOUR PHONE. REFRESH!")); return; }
      me.game = g;
      try { g.mount(body, snap.content || {}, gameApi()); } catch (e) { console.error(e); body.appendChild(h("p", { class: "error" }, "SOMETHING BROKE. REFRESH!")); }
      if (you && you.answerFinal && !g.progressive) showLockedIn(null);
      // Rehearsal hook: ?auto=1 lets a test browser play every round by itself.
      if (AUTO && g.autoplay && !(you && you.answerFinal)) { const api = gameApi(); setTimeout(() => { if (!me.cancel) { try { g.autoplay(body, snap.content || {}, api); } catch (e) { console.error(e); } } }, 800 + Math.random() * 1500); }
      vibrate(40);
      return;
    }
    case "locked":
      audio.sfx("buzzer");
      vibrate([30, 30, 30]);
      appendTo(app, h("div", { class: "center screen", style: { paddingTop: "18vh" } }, h("div", { class: "stamp" }, "TIME!"), hudLine("TALLYING SCORES...")));
      return;
    case "reveal": {
      const g = getGame(snap.game.id);
      const body = h("div", { class: "screen" });
      app.appendChild(body);
      if (g && g.reveal && snap.results) { try { g.reveal(body, snap.results.reveal || {}, gameApi()); } catch (e) { console.error(e); } }
      app.appendChild(h("p", { class: "sub mt blink" }, "SCORES NEXT..."));
      return;
    }
    case "results": {
      const body = h("div", { class: "screen" });
      app.appendChild(body);
      if (snap.results) showRoundResults(body, { results: snap.results, you, cancelled });
      return;
    }
    case "leaderboard": {
      const body = h("div", { class: "screen" });
      app.appendChild(body);
      if (snap.results) showLeaderboard(body, { results: snap.results, you, cancelled });
      return;
    }
    case "final": {
      const body = h("div", { class: "screen" });
      app.appendChild(body);
      if (snap.results) showFinal(body, { results: snap.results, you, cancelled });
      return;
    }
    case "predictions": return mountPredictions();
    case "credits": {
      const meRow = snap.results && snap.results.board && snap.results.board.find((r) => you && r.id === you.id);
      appendTo(app, h("div", { class: "center screen", style: { paddingTop: "4vh" } },
        h("img", { class: "hearts px", src: "assets/deco/hearts.png", alt: "" }),
        h("h1", { class: "title big" }, "THANKS FOR PLAYING!"),
        meRow && meRow.rank ? h("div", { class: "panel dark you-card" }, h("div", { class: "label" }, "YOU FINISHED"), h("div", { class: "rank" }, "#" + meRow.rank), h("div", { class: "of" }, "OF " + snap.results.board.length + " · " + meRow.points + " PTS"))
          : h("div", { class: "panel dark you-card" }, h("div", { class: "label" }, "YOU JOINED FOR THE ENCORE"), h("div", { class: "of" }, "NEXT TIME, GET HERE FOR ROUND 1!")),
        you ? spriteEl(you.avatar, { size: "lg", cls: "idle" }) : null,
        hudLine("SEE YOU WHEN PLAYER 3 SPAWNS.")));
      return;
    }
    default:
      app.appendChild(hudLine(snap.phase));
  }
}

function update() {
  if (!joined || editing) { updateJoin(); return; }
  if (cur.cd) cur.cd.update({ endsAt: snap.endsAt, paused: snap.paused, pauseLeft: snap.pauseLeft });
  if (snap.phase === "lobby") {
    const c = $("[data-role=count]"); if (c) c.textContent = snap.playerCount + " PLAYERS JOINED";
    const t = $("[data-role=ticker]"); if (t) renderTicker(t);
  }
  if (cur.game && cur.game.update) { try { cur.game.update(snap, you); } catch (e) { /* ignore */ } }
}

// ------------------------------------------------------------- join
let joinState = { name: store("bl.name") || "", avatar: null, filter: "" };
function takenSet() { return new Set((snap && snap.taken) || []); }

function mountJoin() {
  const taken = takenSet();
  const mine = you && you.avatar ? you.avatar.c + ":" + you.avatar.p : null;
  if (!joinState.avatar) {
    const saved = (() => { try { return JSON.parse(store("bl.avatar") || "null"); } catch (e) { return null; } })();
    joinState.avatar = (you && you.avatar) || (saved && !taken.has(saved.c + ":" + saved.p) ? saved : null) || randomFree([...taken]);
  }
  const err = h("p", { class: "error", role: "alert" }, joinError);
  const nameIn = h("input", { id: "name", type: "text", maxlength: "16", autocomplete: "nickname", placeholder: "YOUR NAME", value: joinState.name, "aria-label": "Your name" });
  nameIn.addEventListener("input", () => { joinState.name = nameIn.value; });
  const preview = h("div", { class: "panel dark cs-preview" });
  const grid = h("div", { class: "cs-grid" });
  const search = h("input", { type: "search", placeholder: "SEARCH", "aria-label": "Search characters", value: joinState.filter });
  search.addEventListener("input", () => { joinState.filter = search.value; drawGrid(); });
  const ready = h("button", { class: "btn primary huge", type: "button" }, h("i", { class: "tri" }), editing ? "SAVE" : "READY!");
  ready.addEventListener("click", () => {
    const name = nameIn.value.trim();
    if (!name) { joinError = "ENTER A NAME TO PLAY."; err.textContent = joinError; nameIn.focus(); audio.sfx("error"); return; }
    if (!joinState.avatar) { joinError = "PICK A CHARACTER."; err.textContent = joinError; audio.sfx("error"); return; }
    store("bl.name", name);
    store("bl.avatar", JSON.stringify(joinState.avatar));
    ready.disabled = true;
    ready.textContent = "JOINING...";
    pendingJoin = { t: "join", name, avatar: joinState.avatar, playerId: playerId || undefined };
    net.send(pendingJoin);
    setTimeout(() => { ready.disabled = false; ready.textContent = editing ? "SAVE" : "READY!"; }, 2500);
  });

  function drawPreview() {
    clear(preview);
    const av = joinState.avatar;
    if (!av) { preview.appendChild(h("span", { class: "tiny" }, "PICK A CHARACTER BELOW")); return; }
    const sprite = spriteEl(av, { size: "lg", cls: "idle" });
    const pals = h("div", { class: "pals" });
    PALETTES.forEach((p, i) => {
      const isTaken = taken.has(av.c + ":" + p) && (av.c + ":" + p) !== mine;
      const b = h("button", { type: "button", class: p === av.p ? "on" : "", disabled: isTaken, title: isTaken ? "Taken" : "Colour " + (i + 1), onclick: () => { joinState.avatar = { c: av.c, p }; audio.sfx("blip"); drawPreview(); drawGrid(); } }, "P" + (i + 1));
      pals.appendChild(b);
    });
    appendTo(preview, sprite, h("div", null, h("div", { class: "name" }, avatarName(av)), h("div", { class: "tiny" }, "TAP A COLOUR"), pals));
  }

  function drawGrid() {
    clear(grid);
    const f = (joinState.filter || "").trim().toLowerCase();
    let lastFr = null;
    ROSTER.filter((r) => !f || r.name.toLowerCase().includes(f) || r.franchise.toLowerCase().includes(f)).forEach((r) => {
      if (r.franchise !== lastFr && !f) { lastFr = r.franchise; grid.appendChild(h("div", { class: "cs-group", style: { gridColumn: "1 / -1" } }, r.franchise)); }
      // Show this character in the first palette that is free (or the player's own).
      const free = PALETTES.find((p) => !taken.has(r.c + ":" + p) || (r.c + ":" + p) === mine);
      const sel = joinState.avatar && joinState.avatar.c === r.c;
      // The grid always shows the original look; the preview shows the colour you actually get.
      const showP = sel ? joinState.avatar.p : "p1";
      const cell = h("button", { type: "button", class: "cs-cell" + (sel ? " sel" : "") + (!free ? " taken" : ""), "aria-label": r.name + (free ? "" : ", all colours taken"), disabled: !free });
      appendTo(cell, spriteEl({ c: r.c, p: showP }), h("span", null, r.name),
        h("span", { class: "pal" }, ...PALETTES.map((p) => h("i", { class: (sel && p === joinState.avatar.p ? "on" : ""), style: { background: (taken.has(r.c + ":" + p) && (r.c + ":" + p) !== mine) ? "#555" : "#8cc523" } }))));
      cell.addEventListener("click", () => {
        if (sel) {
          // Cycle to the next free palette.
          const order = PALETTES.slice(PALETTES.indexOf(joinState.avatar.p) + 1).concat(PALETTES.slice(0, PALETTES.indexOf(joinState.avatar.p) + 1));
          const next = order.find((p) => !taken.has(r.c + ":" + p) || (r.c + ":" + p) === mine);
          joinState.avatar = { c: r.c, p: next || joinState.avatar.p };
        } else joinState.avatar = { c: r.c, p: free || "p1" };
        audio.sfx("select");
        drawPreview(); drawGrid();
        const s = preview.querySelector(".av"); if (s) hop(s);
      });
      grid.appendChild(cell);
    });
  }

  const inProgress = snap.phase !== "lobby" && !editing;
  appendTo(app, h("div", { class: "screen" },
    h("h1", { class: "title" }, editing ? "CHANGE CHARACTER" : "PLAYER SELECT"),
    hudLine(inProgress ? "THE GAME IS ON. JOIN NOW AND PLAY FROM THE NEXT ROUND!" : "PICK A NAME AND A CHARACTER. EVERY CHARACTER + COLOUR IS ONE OF A KIND."),
    h("div", { class: "field" }, h("label", { for: "name" }, "YOUR NAME"), nameIn),
    preview,
    h("div", { class: "row", style: { marginBottom: "8px" } }, h("div", { class: "field grow", style: { marginBottom: 0 } }, search),
      h("button", { class: "btn small", type: "button", onclick: () => { joinState.avatar = randomFree([...taken]); audio.sfx("coin"); drawPreview(); drawGrid(); } }, "RANDOM")),
    grid,
    err,
    h("div", { class: "mt" }, ready),
    editing ? h("button", { class: "link-btn", type: "button", onclick: () => { editing = false; render(true); } }, "NEVER MIND") : null
  ));
  drawPreview(); drawGrid();
  cur.joinRedraw = () => { drawPreview(); drawGrid(); };
}

function updateJoin() {
  // Taken list may have changed: redraw the grid (keeps selection).
  if (cur.joinRedraw) cur.joinRedraw();
}

// ------------------------------------------------------------ lobby
function renderTicker(el) {
  clear(el);
  const list = (snap.players || []).slice(-6).reverse();
  list.forEach((p) => el.appendChild(h("div", { class: "row", style: { gap: "8px", fontSize: ".75em" } }, spriteEl(p.avatar, { size: "sm" }), h("span", { class: "grow" }, p.name + (p.id === playerId ? " (YOU)" : "")), h("span", { class: "tiny" }, avatarName(p.avatar)))));
}

function mountLobby() {
  const av = spriteEl(you ? you.avatar : joinState.avatar, { size: "xl", cls: "idle" });
  av.addEventListener("click", () => { hop(av); audio.sfx("jump"); bubble(av, ["HI!", "READY!", "LET'S GO!", "PLAYER " + (snap.playerCount) + "!"][Math.floor(Math.random() * 4)]); });
  const ticker = h("div", { class: "stack", dataset: { role: "ticker" }, style: { gap: "4px" } });
  renderTicker(ticker);
  appendTo(app, h("div", { class: "screen center" },
    h("h1", { class: "title" }, "YOU'RE IN!"),
    hudLine((you && you.name ? you.name : "") + " · " + avatarName(you ? you.avatar : joinState.avatar)),
    av,
    h("p", { class: "blink gold mt" }, "WAITING FOR PLAYER 1 TO PRESS START"),
    h("div", { class: "counter", dataset: { role: "count" } }, snap.playerCount + " PLAYERS JOINED"),
    h("div", { class: "panel dark", style: { textAlign: "left" } }, h("div", { class: "label" }, "JUST JOINED"), ticker),
    h("button", { class: "btn small", type: "button", onclick: () => { editing = true; render(true); } }, "CHANGE NAME / CHARACTER"),
    h("p", { class: "tiny mt" }, "KEEP THIS PAGE OPEN. IF YOUR PHONE LOCKS, JUST COME BACK: YOU'RE STILL IN.")));
}

// ------------------------------------------------------ predictions
function mountPredictions() {
  const done = you && you.prediction;
  const f = (id, label, type = "text", extra = {}) => h("div", { class: "field" }, h("label", { for: id }, label), h("input", { id, name: id, type, maxlength: "60", ...extra }));
  const form = h("form", { class: "panel" },
    f("dueDate", "WHEN WILL PLAYER 3 SPAWN? (DATE)", "date"),
    f("weight", "BIRTH WEIGHT (LBS)", "text", { inputmode: "decimal", placeholder: "7.5" }),
    h("div", { class: "field" }, h("label", { for: "looksLike" }, "WHO WILL THE BABY LOOK LIKE?"), h("select", { id: "looksLike", name: "looksLike" }, h("option", { value: "Mom" }, "MOM"), h("option", { value: "Dad" }, "DAD"), h("option", { value: "50/50" }, "PERFECT 50/50"))),
    f("firstWord", "FIRST WORD", "text", { placeholder: "MAMA? DADA? PIKACHU?" }),
    f("hair", "HAIR AT BIRTH", "text", { placeholder: "FULL HEAD / NONE / MOHAWK" }),
    h("button", { class: "btn primary", type: "submit" }, "SAVE PREDICTION"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {};
    ["dueDate", "weight", "looksLike", "firstWord", "hair"].forEach((k) => { data[k] = form.querySelector("#" + k).value; });
    net.send({ t: "prediction", data });
    audio.sfx("win");
    toast("SAVED! WE'LL CHECK THESE AFTER THE BIRTH.");
  });
  appendTo(app, h("div", { class: "screen" },
    h("h1", { class: "title" }, "PREDICTIONS"),
    hudLine("NOT SCORED. WE'LL OPEN THESE AFTER PLAYER 3 ARRIVES."),
    done ? h("div", { class: "panel dark center" }, "YOUR PREDICTION IS SAVED. ", h("br"), h("span", { class: "tiny" }, "SUBMIT AGAIN TO CHANGE IT.")) : null,
    form));
}

// ------------------------------------------------------------- boot
preloadMoves();
preloadAvatars(ROSTER.map((r) => ({ c: r.c, p: "p1" })));
document.body.addEventListener("touchmove", (e) => { if (e.target.closest(".game-surface")) e.preventDefault(); }, { passive: false });
