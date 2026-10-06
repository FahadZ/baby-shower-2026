// The hype engine: everything that happens between rounds. Round MVP podium,
// callouts, the personal rank card, and the leaderboard with rows that slide
// from their old positions to their new ones.
import { h, appendTo, clear, wait, countUp, ordinal, reduceMotion, vibrate, rain } from "./dom.js";
import { sfx } from "./audio.js";
import { spriteEl, moveFor, hop, bubble } from "./avatars.js";
import { playMove } from "./moves.js";

const RESULT_CALLOUTS = ["PERFECT_ROUND", "SPEED_DEMON", "FIRST_BLOOD"];
const BOARD_CALLOUTS = ["NEW_HIGH_SCORE", "BIGGEST_CLIMB", "COMEBACK", "PHOTO_FINISH"];

export function calloutText(c) {
  const n = (c.name || "").toUpperCase();
  switch (c.type) {
    case "NEW_HIGH_SCORE": return { big: "NEW HIGH SCORE!", small: n + " TAKES #1 WITH " + c.value + " PTS", cls: "red" };
    case "PERFECT_ROUND": return { big: "PERFECT ROUND!", small: n + " MAXED IT OUT" + (c.value > 1 ? " (AND " + (c.value - 1) + " MORE)" : ""), cls: "" };
    case "SPEED_DEMON": return { big: "SPEED DEMON", small: n + " LOCKED IN AT " + (c.value / 1000).toFixed(1) + "s", cls: "blue" };
    case "BIGGEST_CLIMB": return { big: "BIGGEST CLIMB ▲" + c.value, small: n + " JUMPED " + c.value + " SPOTS", cls: "green" };
    case "COMEBACK": return { big: "COMEBACK!", small: n + " CAME FROM #" + c.value + " INTO THE TOP 5", cls: "green" };
    case "PHOTO_FINISH": return { big: "PHOTO FINISH", small: n + " LEADS " + (c.other ? c.other.name.toUpperCase() : "") + " BY " + c.value + " PTS", cls: "red" };
    case "FIRST_BLOOD": return { big: "FIRST BLOOD", small: n + " IS ON THE BOARD", cls: "" };
    default: return { big: c.type, small: n, cls: "" };
  }
}

function calloutEl(c) {
  const t = calloutText(c);
  return h("div", { class: "callout " + t.cls }, t.big, h("small", null, t.small));
}

const dur = (ms) => (reduceMotion() ? 0 : ms);

// ------------------------------------------------------------ results
export async function showRoundResults(root, { results, you, big = false, cancelled }) {
  clear(root);
  const board = results.board || [];
  const byId = Object.fromEntries(board.map((r) => [r.id, r]));
  const alive = () => !(cancelled && cancelled());

  // 1. Your round (phones only).
  if (you && you.id) {
    const me = byId[you.id];
    const rp = you.roundPoints || 0;
    const card = h("div", { class: "panel dark you-card pop" },
      h("div", { class: "label" }, "YOUR ROUND"),
      h("div", { class: "pts" }, "0"),
      h("div", { class: "of" }, rp > 0 ? "YOU PLACED " + ordinal(you.roundRank || (me && me.roundRank) || 0) + " THIS ROUND" : (you.answered ? "NO POINTS THIS TIME" : "NO ANSWER THIS ROUND"))
    );
    root.appendChild(card);
    await countUp(card.querySelector(".pts"), 0, rp, dur(Math.min(1400, 300 + rp)), { format: (n) => n + " PTS", onTick: () => sfx("coin", 0.04) });
    if (rp > 0) vibrate(30);
    await wait(dur(500));
    if (!alive()) return;
  }

  // 2. Round MVP podium.
  const mvp = results.mvp || [];
  root.appendChild(h("h2", { class: "title" }, "ROUND MVP"));
  const podium = h("div", { class: "podium" });
  root.appendChild(podium);
  const order = [2, 1, 0]; // 3rd, 2nd, 1st
  const spots = {};
  [0, 1, 2].forEach((i) => {
    const r = mvp[i];
    const spot = h("div", { class: "spot p" + (i + 1) });
    if (r) {
      const av = spriteEl(r.avatar, { size: i === 0 ? "lg" : "", cls: "idle" });
      appendTo(spot, av, h("div", { class: "name" }, r.name), h("div", { class: "pts" }, "0"), h("div", { class: "block" }, String(i + 1)));
      spots[i] = { spot, av, r };
    }
    podium.appendChild(spot);
  });
  // Flex order: 2nd, 1st, 3rd visually.
  podium.style.flexDirection = "row";
  if (spots[1]) podium.insertBefore(spots[1].spot, podium.firstChild);
  for (const i of order) {
    const s = spots[i];
    if (!s) continue;
    s.spot.classList.add("in");
    sfx(i === 0 ? "win" : "select");
    await wait(dur(450));
    countUp(s.spot.querySelector(".pts"), 0, s.r.roundPoints || 0, dur(700), { format: (n) => "+" + n, onTick: () => sfx("coin", 0.03) });
    await wait(dur(i === 0 ? 300 : 550));
    if (!alive()) return;
  }
  if (spots[0]) {
    if (big) rain(18, 2400);
    await playMove(spots[0].av, moveFor(spots[0].r.avatar));
  }
  if (!mvp.length) root.appendChild(h("p", { class: "sub" }, "NOBODY SCORED THIS ROUND. OUCH."));

  // 3. Callouts.
  const cs = (results.callouts || []).filter((c) => RESULT_CALLOUTS.includes(c.type));
  for (const c of cs) {
    if (!alive()) return;
    await wait(dur(500));
    sfx(c.type === "PERFECT_ROUND" ? "fanfare" : "pop");
    root.appendChild(calloutEl(c));
  }
}

// --------------------------------------------------------- leaderboard
function rowEl(r, meId) {
  const delta = r.delta || 0;
  const dl = h("span", { class: "dl " + (delta > 0 ? "up" : delta < 0 ? "down" : "same"), style: r.prevRank ? null : { visibility: "hidden" } }, delta > 0 ? "▲" + delta : delta < 0 ? "▼" + Math.abs(delta) : "=");
  const el = h("div", { class: "brow" + (r.id === meId ? " me" : "") + (r.rank === 1 ? " top1" : "") + (r.bot ? " bot" : ""), dataset: { id: r.id } },
    h("span", { class: "rk" }, "#" + r.rank),
    spriteEl(r.avatar, { size: "sm" }),
    h("span", { class: "nm" }, r.name),
    dl,
    h("span", { class: "pt" }, String(r.points))
  );
  return el;
}

function gapText(me, board) {
  const n = board.length;
  if (!me || !me.rank) return "";
  if (me.rank === 1) {
    const second = board.find((r) => r.rank > 1);
    return second ? "YOU'RE WINNING BY " + (me.points - second.points) + " PTS" : "YOU'RE WINNING!";
  }
  const above = board.filter((r) => r.rank < me.rank).sort((a, b) => b.rank - a.rank)[0];
  const below = board.filter((r) => r.rank > me.rank).sort((a, b) => a.rank - b.rank)[0];
  const parts = [];
  if (above) parts.push((above.points - me.points) + " PTS BEHIND #" + above.rank);
  if (below) parts.push((me.points - below.points) + " PTS AHEAD OF #" + below.rank);
  if (me.rank === n && n > 1) return "NOWHERE TO GO BUT UP";
  return parts.join(" · ");
}

export async function showLeaderboard(root, { results, you, big = false, cancelled, scrollAll = false }) {
  clear(root);
  const alive = () => !(cancelled && cancelled());
  const board = (results.board || []).slice().sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const meId = you && you.id;
  const me = board.find((r) => r.id === meId);

  // 1. Personal card.
  if (me) {
    const d = me.delta || 0;
    const av = spriteEl(me.avatar, { size: "lg", cls: d < 0 ? "sad" : "idle" });
    const card = h("div", { class: "panel dark you-card pop" },
      h("div", { class: "row", style: { justifyContent: "center", gap: "16px" } }, av,
        h("div", null,
          h("div", { class: "rank" }, "#" + me.rank),
          h("div", { class: "of" }, "OF " + board.length + " PLAYERS"))),
      h("div", { class: "delta " + (d > 0 ? "up" : d < 0 ? "down" : "") }, d > 0 ? "▲ UP " + d + (d === 1 ? " SPOT" : " SPOTS") : d < 0 ? "▼ DOWN " + Math.abs(d) + (d === -1 ? " SPOT" : " SPOTS") : (me.prevRank ? "HOLDING STEADY" : "ON THE BOARD")),
      h("div", { class: "gap" }, gapText(me, board))
    );
    root.appendChild(card);
    sfx(d > 0 ? "up" : d < 0 ? "down" : "select");
    if (d > 0) { vibrate([40, 60, 40]); hop(av); } else if (d < 0) bubble(av, "...", 1500);
    await wait(dur(1300));
    if (!alive()) return;
  }

  // 2. Big banners.
  const cs = (results.callouts || []).filter((c) => BOARD_CALLOUTS.includes(c.type));
  for (const c of cs) {
    if (c.type === "NEW_HIGH_SCORE") {
      sfx("fanfare");
      root.appendChild(h("div", { class: "banner" }, "NEW HIGH SCORE!", h("small", { style: { display: "block", fontSize: ".65em", marginTop: "6px" } }, c.name.toUpperCase() + " · " + c.value + " PTS"), h("img", { class: "hearts px", src: "assets/deco/hearts.png", alt: "" })));
      if (big) rain(24, 2600);
    } else {
      sfx("pop");
      root.appendChild(calloutEl(c));
    }
    await wait(dur(900));
    if (!alive()) return;
  }

  // 3. Top 10 with FLIP from previous positions.
  root.appendChild(h("h2", { class: "title" }, results.final ? "FINAL STANDINGS" : "LEADERBOARD"));
  const top = board.slice(0, 10);
  const prevOrder = top.slice().sort((a, b) => (a.prevRank || 999) - (b.prevRank || 999) || a.rank - b.rank);
  const list = h("div", { class: "board" });
  const rows = new Map();
  prevOrder.forEach((r) => { const el = rowEl(r, meId); el.querySelector(".pt").textContent = String(r.points - (r.roundPoints || 0)); el.querySelector(".dl").style.visibility = "hidden"; rows.set(r.id, el); list.appendChild(el); });
  root.appendChild(list);
  await wait(dur(600));
  if (!alive()) return;
  // FLIP
  const first = new Map();
  rows.forEach((el, id) => first.set(id, el.getBoundingClientRect().top));
  top.forEach((r) => list.appendChild(rows.get(r.id)));
  let moved = false;
  top.forEach((r) => {
    const el = rows.get(r.id);
    const dy = first.get(r.id) - el.getBoundingClientRect().top;
    if (dy && el.animate && !reduceMotion()) { moved = true; el.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], { duration: 650, easing: "steps(10)" }); }
  });
  if (moved) sfx("whoosh");
  top.forEach((r) => { const el = rows.get(r.id); el.querySelector(".dl").style.visibility = ""; countUp(el.querySelector(".pt"), r.points - (r.roundPoints || 0), r.points, dur(900), { onTick: () => sfx("tick", 0.02), every: 50 }); });
  await wait(dur(1100));
  if (!alive()) return;

  // 4. Your neighbourhood when you are outside the top 10, then FIND ME / full list.
  if (board.length > 10) {
    const rest = board.slice(10);
    if (me && me.rank > 10) {
      root.appendChild(h("div", { class: "ellipsis" }, "· · ·"));
      const i = board.findIndex((r) => r.id === meId);
      const around = board.slice(Math.max(10, i - 2), Math.min(board.length, i + 3));
      const nb = h("div", { class: "board" });
      around.forEach((r) => nb.appendChild(rowEl(r, meId)));
      root.appendChild(nb);
      await wait(dur(400));
    }
    const full = h("div", { class: "board", hidden: true });
    rest.forEach((r) => full.appendChild(rowEl(r, meId)));
    const btn = h("button", { class: "btn small find-me", type: "button", onclick: () => {
      full.hidden = !full.hidden;
      btn.textContent = full.hidden ? (me ? "FIND ME · ALL " + board.length : "SHOW ALL " + board.length) : "HIDE";
      if (!full.hidden) { const mine = full.querySelector(".brow.me"); (mine || full).scrollIntoView({ behavior: "smooth", block: "center" }); }
    } }, me ? "FIND ME · ALL " + board.length : "SHOW ALL " + board.length);
    root.appendChild(btn);
    root.appendChild(full);
    if (scrollAll && !reduceMotion()) {
      // TV: reveal the rest and glide through it so every name gets its moment.
      full.hidden = false;
      btn.hidden = true;
      await wait(dur(800));
      const total = full.scrollHeight;
      const steps = Math.ceil(total / 400);
      for (let s = 1; s <= steps && alive(); s++) {
        window.scrollTo({ top: full.offsetTop - 200 + (s * 400), behavior: "smooth" });
        await wait(1400);
      }
    }
  }
}

// ------------------------------------------------------------- final
export async function showFinal(root, { results, you, big = false, cancelled }) {
  clear(root);
  const alive = () => !(cancelled && cancelled());
  const board = (results.board || []).slice().sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  root.appendChild(h("h2", { class: "title big" }, "FINAL RANKINGS"));
  const drum = h("p", { class: "sub blink" }, "DRUM ROLL...");
  root.appendChild(drum);
  for (let i = 0; i < 4; i++) { sfx("drum"); await wait(dur(500)); }
  drum.remove();
  if (!alive()) return;
  const podium = h("div", { class: "podium" });
  root.appendChild(podium);
  const spots = {};
  [1, 0, 2].forEach((i) => {
    const r = board[i];
    const spot = h("div", { class: "spot p" + (i + 1) });
    if (r) {
      const av = spriteEl(r.avatar, { size: i === 0 ? "xl" : "lg", cls: "idle" });
      appendTo(spot, av, h("div", { class: "name" }, r.name), h("div", { class: "pts" }, r.points + " PTS"), h("div", { class: "block" }, String(i + 1)));
      spots[i] = { spot, av, r };
    }
    podium.appendChild(spot);
  });
  for (const i of [2, 1, 0]) {
    const s = spots[i];
    if (!s) continue;
    await wait(dur(i === 0 ? 1400 : 900));
    if (!alive()) return;
    s.spot.classList.add("in");
    sfx(i === 0 ? "fanfare" : "win");
    if (i === 0) { rain(40, 3200); vibrate([60, 40, 60, 40, 120]); }
  }
  if (spots[0]) { await wait(dur(300)); await playMove(spots[0].av, moveFor(spots[0].r.avatar)); }
  if (!alive()) return;
  const me = board.find((r) => r.id === (you && you.id));
  if (me) {
    root.appendChild(h("div", { class: "panel dark you-card pop" },
      h("div", { class: "label" }, "YOU FINISHED"),
      h("div", { class: "rank" }, "#" + me.rank),
      h("div", { class: "of" }, "OF " + board.length + " · " + me.points + " PTS")));
  }
  const list = h("div", { class: "board mt" });
  board.forEach((r) => list.appendChild(rowEl(r, you && you.id)));
  root.appendChild(h("h3", { class: "sub" }, "EVERYONE"));
  root.appendChild(list);
}
