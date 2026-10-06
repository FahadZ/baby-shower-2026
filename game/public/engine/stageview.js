// Renders the big-screen version of every phase. Used by tv.html and by the
// host page's STAGE toggle. The player page has its own renderer.
import { h, appendTo, clear, wait } from "./dom.js";
import { sfx, music } from "./audio.js";
import { countdown } from "./countdown.js";
import { crowdStage, qrBlock, joinUrl } from "./stage.js";
import { showRoundResults, showLeaderboard, showFinal } from "./hype.js";
import { getGame } from "../games/index.js";
import { spriteEl } from "./avatars.js";

export function createStageView(root, { now, tv = false }) {
  let key = null, cur = { cancel: false, cd: null, game: null, view: null, crowd: null };
  let lastSnap = null, lastLive = null;

  function teardown() {
    cur.cancel = true;
    if (cur.cd) cur.cd.stop();
    if (cur.game && cur.game.unmount) { try { cur.game.unmount(); } catch (e) { /* ignore */ } }
    cur = { cancel: false, cd: null, game: null, view: null, crowd: null };
    clear(root);
    window.scrollTo(0, 0);
  }

  const api = (snap) => ({
    big: true, tv, now, sfx, you: () => null, results: snap.results, content: snap.content || null, players: () => snap.players || [],
    live: () => lastLive, timeLeft: () => Math.max(0, (snap.endsAt || 0) - now()), roundTime: snap.roundTime
  });

  function render(snap, live) {
    lastSnap = snap;
    if (live !== undefined) lastLive = live;
    const k = [snap.phase, snap.roundId, snap.revealNonce, snap.gameIndex].join("|");
    if (k !== key) { teardown(); key = k; mount(snap); }
    else update(snap);
  }

  function header(snap, text) {
    const g = snap.game;
    return h("div", { class: "hud" },
      h("span", { class: "tag" }, g ? "GAME " + (snap.gameIndex + 1) + "/" + snap.gameCount + " · " + g.title + (snap.round ? " · ROUND " + snap.round + "/" + g.rounds : "") : "BABY LOADING.."),
      h("span", null, text || (snap.playerCount + " PLAYERS")));
  }

  function mount(snap) {
    const me = cur;
    const cancelled = () => me.cancel;
    switch (snap.phase) {
      case "lobby": {
        music(true);
        const url = joinUrl();
        const left = h("div", { class: "center stack" },
          h("h1", { class: "title big" }, "BABY LOADING.."),
          h("p", { class: "sub" }, "PARTY GAMES · SCAN TO JOIN"),
          qrBlock(url, { size: 8 }),
          h("div", { class: "join-url" }, url.replace(/^https?:\/\//, "").replace(/\/$/, "")),
          h("div", { class: "counter", dataset: { role: "count" } }, snap.playerCount + " PLAYERS"),
          h("p", { class: "sub blink" }, "WAITING FOR PLAYER 1 TO PRESS START"));
        const right = h("div", null);
        const crowd = crowdStage(right, { phantom: true });
        crowd.update(snap.players || []);
        me.crowd = crowd;
        appendTo(root, header(snap, "LOBBY"), tv ? h("div", { class: "tv-lobby" }, left, right) : h("div", null, left, right));
        break;
      }
      case "intro": {
        sfx("start");
        appendTo(root, header(snap),
          h("div", { class: "center", style: { paddingTop: "8vh" } },
            h("p", { class: "sub" }, "GAME " + (snap.gameIndex + 1) + " OF " + snap.gameCount),
            h("h1", { class: "title huge pop" }, snap.game.title),
            h("p", { class: "sub" }, snap.game.tagline),
            h("p", { class: "blink gold" }, "GET READY")));
        break;
      }
      case "howto": {
        const g = getGame(snap.game.id);
        const demo = h("div", { class: "panel dark" });
        appendTo(root, header(snap),
          h("div", { class: "center" },
            h("h1", { class: "title big" }, (snap.howto && snap.howto.title) || snap.game.title),
            h("p", { class: "sub" }, "ROUND " + snap.round + " OF " + snap.game.rounds + (snap.howto && snap.howto.points ? " · " + snap.howto.points : "")),
            h("div", { class: "panel" }, (snap.howto && snap.howto.text) || ""),
            demo));
        if (g && g.howtoDemo) { try { g.howtoDemo(demo, snap.content || {}); } catch (e) { /* ignore */ } }
        root.appendChild(h("p", { class: "blink gold center mt" }, "WAITING FOR PLAYER 1 TO START THE ROUND"));
        break;
      }
      case "playing": {
        const g = getGame(snap.game.id);
        const cdWrap = h("div", null);
        appendTo(root, header(snap), cdWrap);
        me.cd = countdown(cdWrap, { endsAt: snap.endsAt, roundTime: snap.roundTime, now, paused: snap.paused, sound: true });
        const body = h("div", { class: "game-stage" });
        root.appendChild(body);
        if (g && g.stageView) { try { me.view = g.stageView(body, snap.content || {}, api(snap)); } catch (e) { console.error(e); } }
        else appendTo(body, h("h2", { class: "title big" }, snap.game.title), h("div", { class: "counter center", dataset: { role: "count" } }, snap.answerCount + " LOCKED IN"));
        if (me.view && me.view.update) me.view.update(lastLive, snap);
        me.game = g;
        break;
      }
      case "locked":
        sfx("buzzer");
        appendTo(root, header(snap), h("div", { class: "center", style: { paddingTop: "20vh" } }, h("div", { class: "stamp" }, "TIME!"), h("p", { class: "sub mt" }, "TALLYING SCORES...")));
        break;
      case "reveal": {
        const g = getGame(snap.game.id);
        const body = h("div", null);
        appendTo(root, header(snap), body);
        if (g && g.reveal && snap.results) g.reveal(body, snap.results.reveal || {}, api(snap));
        break;
      }
      case "results": {
        const body = h("div", null);
        appendTo(root, header(snap), body);
        if (snap.results) showRoundResults(body, { results: snap.results, you: null, big: true, cancelled });
        break;
      }
      case "leaderboard": {
        const body = h("div", null);
        appendTo(root, header(snap), body);
        if (snap.results) showLeaderboard(body, { results: snap.results, you: null, big: true, cancelled, scrollAll: tv });
        break;
      }
      case "final": {
        const body = h("div", null);
        appendTo(root, header(snap, "FINAL"), body);
        music(true);
        if (snap.results) showFinal(body, { results: snap.results, you: null, big: true, cancelled });
        break;
      }
      case "predictions":
        appendTo(root, header(snap, "PREDICTIONS"), h("div", { class: "center", style: { paddingTop: "8vh" } },
          h("h1", { class: "title big" }, "PREDICTIONS"),
          h("p", { class: "sub" }, "ON YOUR PHONE: DUE DATE, WEIGHT, WHO THE BABY LOOKS LIKE..."),
          h("p", { class: "tiny" }, "WE'LL READ THESE AFTER THE BABY ARRIVES")));
        break;
      case "credits":
        appendTo(root, header(snap, "THANKS"), h("div", { class: "center", style: { paddingTop: "6vh" } },
          h("img", { class: "hearts px", src: "assets/deco/hearts.png", alt: "" }),
          h("h1", { class: "title huge" }, "THANKS FOR PLAYING!"),
          h("p", { class: "sub" }, "SEE YOU ON LEVEL 17... AND WHEN PLAYER 3 SPAWNS."),
          h("div", { class: "stage-wrap", dataset: { role: "crowd" } })));
        { const crowd = crowdStage(root.querySelector("[data-role=crowd]"), { phantom: true }); crowd.update((snap.results && snap.results.board) || []); }
        break;
      default:
        appendTo(root, header(snap), h("p", { class: "sub" }, snap.phase));
    }
  }

  function update(snap) {
    const count = root.querySelector("[data-role=count]");
    if (count) count.textContent = snap.phase === "playing" ? snap.answerCount + " LOCKED IN" : snap.playerCount + " PLAYERS";
    if (cur.crowd && snap.players) cur.crowd.update(snap.players);
    if (cur.cd) cur.cd.update({ endsAt: snap.endsAt, paused: snap.paused, pauseLeft: snap.pauseLeft });
    if (cur.view && cur.view.update) cur.view.update(lastLive, snap);
  }

  function onLive(stat) {
    lastLive = stat;
    if (cur.view && cur.view.update && lastSnap) cur.view.update(stat, lastSnap);
  }

  return { render, onLive, teardown };
}
