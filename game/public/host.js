// The host's phone: a PIN-gated remote. One big NEXT button that always does
// the obvious next thing, the smaller controls, the player list, bots, and a
// STAGE toggle that turns this phone into the big-screen view.
import { connect } from "./engine/net.js";
import { h, appendTo, $, clear, store, toast, wait, fmtMoney } from "./engine/dom.js";
import * as audio from "./engine/audio.js";
import { spriteEl, avatarName } from "./engine/avatars.js";
import { countdown } from "./engine/countdown.js";
import { createStageView } from "./engine/stageview.js";

const app = $("#app");
const netDot = $("#netDot");
let token = store("bl.hostToken");
let snap = null, host = null, live = null;
let authed = false, authError = "";
let stageMode = false, stageView = null, muted = store("bl.hostMute") === "on";
let cd = null, lastKey = null, wake = null;

const net = connect({
  role: "host",
  onStatus(s) { netDot.className = "dot " + (s === "open" ? "on" : s === "connecting" ? "sync" : ""); },
  onMessage(msg) {
    switch (msg.t) {
      case "state": snap = msg; render(); break;
      case "host": host = msg; renderPlayers(); break;
      case "host-ok": token = msg.token; store("bl.hostToken", token); authed = true; authError = ""; render(true); audio.sfx("start"); break;
      case "host-error": authed = false; authError = msg.error; token = null; store("bl.hostToken", null); render(true); break;
      case "cmd-ok": if (msg.error) toast(msg.error); else if (msg.added != null) toast("ADDED " + msg.added + " BOTS"); else if (msg.removed != null) toast("REMOVED " + msg.removed + " BOTS"); break;
      case "live": live = msg.stat; if (stageView) stageView.onLive(live); break;
      case "error": toast(msg.error); break;
      default: break;
    }
  }
});
net.onOpen(() => { if (token) net.send({ t: "host", token }); });

function cmd(name, arg) {
  if (!authed) return;
  net.send({ t: "cmd", token, cmd: name, arg });
  audio.sfx("select");
}

async function requestWake() {
  try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* ignore */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) requestWake(); });

// Sound: the host phone can be plugged into a speaker; default off.
audio.enable(!muted);
document.addEventListener("pointerdown", () => { if (!muted) audio.enable(true); }, { passive: true });

// ------------------------------------------------------------- labels
function nextLabel(s) {
  const g = s.game;
  switch (s.phase) {
    case "lobby": return "START GAME";
    case "intro": return "SHOW HOW-TO";
    case "howto": return "START ROUND";
    case "playing": return "END ROUND NOW";
    case "locked": return "SCORING...";
    case "reveal": return "SHOW ROUND RESULTS";
    case "results": return "SHOW LEADERBOARD";
    case "leaderboard": return g && s.round < g.rounds ? "NEXT ROUND (" + (s.round + 1) + "/" + g.rounds + ")" : (s.gameIndex + 1 < s.gameCount ? "NEXT GAME" : "FINAL RANKINGS");
    case "final": return "PREDICTIONS";
    case "predictions": return "ROLL CREDITS";
    case "credits": return "THE END";
    default: return "NEXT";
  }
}

function phaseLabel(s) {
  const map = { lobby: "LOBBY", intro: "GAME INTRO", howto: "HOW TO PLAY", playing: "PLAYING", locked: "LOCKED", reveal: "ANSWER REVEAL", results: "ROUND RESULTS", leaderboard: "LEADERBOARD", final: "FINAL RANKINGS", predictions: "PREDICTIONS", credits: "CREDITS" };
  return map[s.phase] || s.phase;
}

// ------------------------------------------------------------- render
function render(force) {
  if (!snap) return;
  if (!authed) { if (force || lastKey !== "pin") { lastKey = "pin"; mountPin(); } return; }
  if (stageMode) {
    if (lastKey !== "stage") { lastKey = "stage"; mountStage(); }
    stageView.render(snap, live);
    return;
  }
  const key = "ctl:" + snap.phase + ":" + snap.roundId;
  if (force || key !== lastKey) { lastKey = key; mountControls(); }
  else updateControls();
}

function mountPin() {
  clear(app);
  const pin = h("input", { id: "pin", type: "password", inputmode: "numeric", autocomplete: "off", placeholder: "HOST PIN", "aria-label": "Host PIN" });
  const err = h("p", { class: "error" }, authError);
  const form = h("form", { class: "panel" }, h("div", { class: "field" }, h("label", { for: "pin" }, "HOST PIN"), pin), err, h("button", { class: "btn primary", type: "submit" }, "UNLOCK REMOTE"));
  form.addEventListener("submit", (e) => { e.preventDefault(); net.send({ t: "host", pin: pin.value.trim() }); });
  appendTo(app, h("div", { class: "screen" }, h("h1", { class: "title" }, "PLAYER 1 REMOTE"), h("p", { class: "sub" }, "ONLY THE HOST SHOULD HAVE THIS PAGE."), form));
  setTimeout(() => pin.focus(), 100);
}

function statusPanel(s) {
  const g = s.game;
  const grid = h("div", { class: "host-status" },
    h("span", null, "PHASE"), h("b", { dataset: { f: "phase" } }, phaseLabel(s)),
    h("span", null, "GAME"), h("b", { dataset: { f: "game" } }, g ? (s.gameIndex + 1) + "/" + s.gameCount + " " + g.title : "—"),
    h("span", null, "ROUND"), h("b", { dataset: { f: "round" } }, g && s.round ? s.round + "/" + g.rounds : "—"),
    h("span", null, "PLAYERS"), h("b", { dataset: { f: "players" } }, s.connectedCount + "/" + s.playerCount + (s.botCount ? " (" + s.botCount + " BOTS)" : "")),
    h("span", null, "ANSWERS"), h("b", { dataset: { f: "answers" } }, s.phase === "playing" || s.phase === "locked" ? s.answerCount + "/" + s.playerCount : "—"));
  return h("div", { class: "panel dark" }, grid, h("div", { dataset: { f: "cd" } }));
}

function mountControls() {
  clear(app);
  if (cd) { cd.stop(); cd = null; }
  const s = snap;
  const next = h("button", { class: "btn primary huge", type: "button", disabled: s.phase === "locked" || s.phase === "credits", onclick: () => cmd("next") }, h("i", { class: "tri" }), nextLabel(s));
  const playing = s.phase === "playing";
  const sec = h("div", { class: "btn-grid" },
    h("button", { class: "btn small", type: "button", disabled: !playing, onclick: () => cmd("extend") }, "+15 SEC"),
    h("button", { class: "btn small", type: "button", disabled: !playing, onclick: () => cmd(s.paused ? "resume" : "pause") }, s.paused ? "RESUME" : "PAUSE"),
    h("button", { class: "btn small", type: "button", disabled: s.phase !== "playing", onclick: () => cmd("end") }, "END ROUND NOW"),
    h("button", { class: "btn small", type: "button", disabled: ["lobby", "final", "predictions", "credits"].includes(s.phase), onclick: () => confirm("Skip this round? It will not be scored.") && cmd("skipRound") }, "SKIP ROUND"),
    h("button", { class: "btn small", type: "button", disabled: ["lobby", "final", "predictions", "credits"].includes(s.phase), onclick: () => confirm("Skip the rest of this game?") && cmd("skipGame") }, "SKIP GAME"),
    h("button", { class: "btn small", type: "button", disabled: !["reveal", "results", "leaderboard"].includes(s.phase), onclick: () => cmd("replay") }, "REPLAY REVEAL"),
    h("button", { class: "btn small", type: "button", disabled: !["reveal", "results"].includes(s.phase), onclick: () => cmd("showLeaderboard") }, "LEADERBOARD"),
    h("button", { class: "btn small", type: "button", onclick: () => { muted = !muted; store("bl.hostMute", muted ? "on" : "off"); audio.enable(!muted); toast(muted ? "THIS PHONE IS MUTED" : "SOUND ON (PLUG INTO A SPEAKER)"); } }, muted ? "UNMUTE" : "MUTE"),
    h("button", { class: "btn small", type: "button", dataset: { f: "autoend" }, title: "End a round early once every connected player has locked in", onclick: () => cmd("autoEnd", { on: !(snap.settings && snap.settings.autoEnd) }) }, "AUTO-END: " + (s.settings && s.settings.autoEnd ? "ON" : "OFF")));
  const stageBtn = h("button", { class: "btn", type: "button", onclick: () => { stageMode = true; lastKey = null; render(true); } }, "STAGE VIEW (BIG SCREEN)");

  // Jump to any game.
  const sel = h("select", { "aria-label": "Jump to game", style: { flex: "1 1 0", minWidth: "0", width: "100%", fontSize: "16px", padding: "10px 6px" } }, ...(s.order || []).map((g, i) => h("option", { value: String(i), selected: i === s.gameIndex }, (i + 1) + ". " + g.title)));
  const jump = h("div", { class: "row" }, sel, h("button", { class: "btn small", type: "button", style: { flex: "none" }, onclick: () => confirm("Jump to " + sel.options[sel.selectedIndex].text + "?") && cmd("goto", { gameIndex: Number(sel.value), round: 1 }) }, "JUMP"));

  // Bots and reset.
  const bots = h("div", { class: "btn-grid" },
    h("button", { class: "btn small", type: "button", onclick: () => cmd("addBots", { n: 20 }) }, "+20 BOTS"),
    h("button", { class: "btn small", type: "button", onclick: () => cmd("addBots", { n: 80 }) }, "+80 BOTS"),
    h("button", { class: "btn small", type: "button", onclick: () => cmd("removeBots") }, "REMOVE BOTS"),
    longPress(h("button", { class: "btn small danger", type: "button" }, "HOLD TO RESET"), () => { if (confirm("Reset the whole game? Scores and answers are wiped; players stay.")) cmd("reset"); }));
  const links = h("p", { class: "tiny" },
    h("a", { href: "/api/board.csv?token=" + encodeURIComponent(token), download: "leaderboard.csv" }, "DOWNLOAD LEADERBOARD CSV"), " · ",
    h("a", { href: "/api/predictions.csv?token=" + encodeURIComponent(token), download: "predictions.csv" }, "PREDICTIONS CSV"));

  appendTo(app, h("div", { class: "screen stack" },
    statusPanel(s),
    next,
    sec,
    stageBtn,
    h("div", { class: "panel dark" }, h("div", { class: "label" }, "PLAYERS"), h("div", { dataset: { f: "plist" }, class: "plist" })),
    h("div", { class: "panel dark" }, h("div", { class: "label" }, "JUMP TO GAME"), jump),
    h("div", { class: "panel dark" }, h("div", { class: "label" }, "REHEARSAL & DANGER ZONE"), bots, links),
    h("p", { class: "tiny center" }, "TIP: KEEP THIS PHONE PLUGGED IN. THE SERVER RUNS THE CLOCK, SO EVEN IF THIS PAGE DIES THE ROUND STILL ENDS ON TIME.")));
  renderPlayers();
  updateControls();
  requestWake();
}

function updateControls() {
  const s = snap;
  const f = (k) => $("[data-f=" + k + "]");
  if (!f("phase")) return;
  f("phase").textContent = phaseLabel(s) + (s.paused ? " (PAUSED)" : "");
  f("players").textContent = s.connectedCount + "/" + s.playerCount + (s.botCount ? " (" + s.botCount + " BOTS)" : "");
  f("answers").textContent = s.phase === "playing" || s.phase === "locked" ? s.answerCount + "/" + s.playerCount : "—";
  const cdWrap = f("cd");
  const ae = f("autoend"); if (ae) ae.textContent = "AUTO-END: " + (s.settings && s.settings.autoEnd ? "ON" : "OFF");
  if (["playing", "locked"].includes(s.phase) && s.endsAt) {
    if (!cd) { cd = countdown(cdWrap, { endsAt: s.endsAt, roundTime: s.phase === "playing" ? s.roundTime : 1200, now: net.now, paused: s.paused, sound: false }); }
    else cd.update({ endsAt: s.endsAt, paused: s.paused, pauseLeft: s.pauseLeft });
  } else if (cd) { cd.stop(); cd = null; clear(cdWrap); }
}

function renderPlayers() {
  const el = $("[data-f=plist]");
  if (!el || !host) return;
  clear(el);
  const list = host.players.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name));
  list.slice(0, 150).forEach((p) => {
    el.appendChild(h("div", { class: "prow" + (p.connected ? "" : " off") },
      spriteEl(p.avatar, { size: "sm" }),
      h("span", { class: "nm" }, (p.rank ? "#" + p.rank + " " : "") + p.name + (p.bot ? " 🤖" : "")),
      h("span", { class: "tiny" }, p.points + "p"),
      h("button", { type: "button", "aria-label": "Kick " + p.name, onclick: () => confirm("Kick " + p.name + "?") && cmd("kick", { playerId: p.id }) }, "KICK")));
  });
  if (!list.length) el.appendChild(h("p", { class: "tiny" }, "NOBODY YET. SHOW THEM THE QR!"));
}

function longPress(btn, fn) {
  let t = null;
  const start = () => { t = setTimeout(() => { t = null; fn(); }, 900); btn.classList.add("blink"); };
  const stop = () => { clearTimeout(t); btn.classList.remove("blink"); };
  btn.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
  return btn;
}

// -------------------------------------------------------------- stage
function mountStage() {
  clear(app);
  if (cd) { cd.stop(); cd = null; }
  document.documentElement.dataset.screen = "stage";
  const root = h("div", null);
  app.appendChild(root);
  stageView = createStageView(root, { now: net.now, tv: false });
  const float = h("div", { class: "stage-float" },
    h("button", { class: "btn primary", type: "button", onclick: () => cmd("next") }, "NEXT ▶"),
    h("button", { class: "btn", type: "button", onclick: () => { stageMode = false; stageView.teardown(); stageView = null; document.documentElement.dataset.screen = "host"; float.remove(); lastKey = null; render(true); } }, "EXIT"));
  document.body.appendChild(float);
}
