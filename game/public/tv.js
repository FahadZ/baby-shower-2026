// The optional big screen. Shows the QR in the lobby, the rounds, the reveals
// and the leaderboard at 1080p, with sound. Nothing depends on it being open.
import { connect } from "./engine/net.js";
import { h, $, clear, store } from "./engine/dom.js";
import * as audio from "./engine/audio.js";
import { createStageView } from "./engine/stageview.js";
import { preloadMoves } from "./engine/moves.js";

const app = $("#app");
const netDot = $("#netDot");
let snap = null, live = null, wake = null;
const view = createStageView(app, { now: () => net.now(), tv: true });

const net = connect({
  role: "tv",
  onStatus(s) { netDot.className = "dot " + (s === "open" ? "on" : s === "connecting" ? "sync" : ""); },
  onMessage(msg) {
    if (msg.t === "state") { snap = msg; view.render(snap, live); }
    else if (msg.t === "live") { live = msg.stat; view.onLive(live); }
  }
});

async function requestWake() {
  try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { /* ignore */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) requestWake(); });

// Sound prompt: one real click is what browsers need before audio can play.
const prompt = $("#soundPrompt");
$("#soundYes").addEventListener("click", () => { audio.enable(true); audio.music(true); audio.sfx("coin"); prompt.hidden = true; requestWake(); tryFullscreen(); });
$("#soundNo").addEventListener("click", () => { audio.enable(false); prompt.hidden = true; requestWake(); tryFullscreen(); });
$("#fsBtn").addEventListener("click", tryFullscreen);
$("#muteBtn").addEventListener("click", () => { const on = !audio.isOn(); audio.enable(on); if (on) audio.music(true); $("#muteBtn").textContent = on ? "MUTE" : "UNMUTE"; });

function tryFullscreen() {
  try { if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
}
preloadMoves();
