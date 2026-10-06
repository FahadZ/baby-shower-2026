// The game room's brain: a pure, testable state machine. The Durable Object
// (room.js) feeds it events and persists whatever it marks dirty. Nothing in
// here touches sockets, storage or timers; it only returns what should happen.
import { GAMES, GAMES_BY_ID } from "./games/index.js";
import { ROSTER, PALETTES } from "../public/data/avatars.js";
import { rankBy } from "./scoring.js";
import { rngFor } from "./rng.js";
import { botName } from "./bots.js";

export const HOWTO_FIRST_MS = 8000;
export const HOWTO_MS = 4000;
export const LOCKED_MS = 1200;
export const AUTO_END_GRACE_MS = 1500;
export const EXTEND_MS = 15000;
export const MAX_PLAYERS = 150;
export const NAME_MAX = 16;
export const ANSWER_MAX_BYTES = 6000;

export const PHASES = ["lobby", "intro", "howto", "playing", "locked", "reveal", "results", "leaderboard", "final", "predictions", "credits"];

export function createState(now = Date.now(), seed) {
  return {
    core: {
      v: 1,
      phase: "lobby",
      gameIndex: -1,
      round: 0,
      roundId: null,
      phaseAt: now,
      endsAt: null,
      startedAt: null,
      paused: false,
      pauseLeft: 0,
      pausedAt: null,
      players: {},
      order: GAMES.map((g) => g.id),
      seed: seed ?? ((Math.random() * 2 ** 31) >>> 0),
      revealNonce: 0,
      hostTokens: [],
      botQueue: [],
      nextBot: 0,
      botCounter: 0,
      scoredRounds: [],
      firstRank: {}
    },
    answers: {},     // roundId -> { playerId: { a, t, final } }
    results: {},     // roundId -> result record (see lockRound)
    predictions: {}, // playerId -> { ...fields, at }
    cache: {},       // in-memory only: content per roundId
    dirty: new Set()
  };
}

// ------------------------------------------------------------------ helpers
export const currentGame = (core) => (core.gameIndex >= 0 ? GAMES_BY_ID[core.order[core.gameIndex]] : null);

export function gameInfo(game) {
  return game ? { id: game.id, title: game.title, tagline: game.tagline || "", rounds: game.rounds, icon: game.icon || "" } : null;
}

function publicPlayers(core) {
  return Object.values(core.players).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, bot: !!p.bot, connected: !!p.connected, points: p.points, rank: p.rank }));
}

export function roundCtx(state, game, round) {
  const core = state.core;
  const roundId = game.id + "-" + round;
  return {
    roundId,
    round,
    seed: core.seed,
    rng: rngFor(core.seed, roundId),
    data: game.data,
    roundTime: game.roundTime(round),
    players: publicPlayers(core),
    results: state.results,
    order: core.order
  };
}

function contentFor(state, game, round) {
  const roundId = game.id + "-" + round;
  if (!state.cache[roundId]) state.cache[roundId] = game.content(round, roundCtx(state, game, round)) || {};
  return state.cache[roundId];
}

const cleanName = (raw) => String(raw || "").replace(/[<>&"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

export function validAvatar(av) {
  return !!av && typeof av.c === "string" && typeof av.p === "string" && ROSTER.some((r) => r.c === av.c) && PALETTES.includes(av.p);
}

function avatarTakenBy(core, av, exceptId) {
  for (const p of Object.values(core.players)) {
    if (p.id !== exceptId && p.avatar.c === av.c && p.avatar.p === av.p) return p.id;
  }
  return null;
}

function nameTakenBy(core, name, exceptId) {
  const n = name.toLowerCase();
  for (const p of Object.values(core.players)) {
    if (p.id !== exceptId && p.name.toLowerCase() === n) return p.id;
  }
  return null;
}

export function takenAvatars(core) {
  return Object.values(core.players).map((p) => p.avatar.c + ":" + p.avatar.p);
}

function setPhase(state, phase, now, endsAt = null) {
  const core = state.core;
  core.phase = phase;
  core.phaseAt = now;
  core.endsAt = endsAt;
  core.paused = false;
  core.pauseLeft = 0;
  core.pausedAt = null;
  state.dirty.add("core");
}

function newId() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

// --------------------------------------------------------------- players
export function join(state, { name, avatar, playerId }, now = Date.now()) {
  const core = state.core;
  const existing = playerId && core.players[playerId];
  const nm = cleanName(name);
  if (!existing) {
    if (!nm) return { error: "ENTER A NAME TO PLAY." };
    if (!validAvatar(avatar)) return { error: "PICK A CHARACTER." };
    if (Object.keys(core.players).length >= MAX_PLAYERS) return { error: "THE ROOM IS FULL." };
    if (nameTakenBy(core, nm)) return { error: "THAT NAME IS TAKEN. ADD A LETTER OR A NUMBER." };
    if (avatarTakenBy(core, avatar)) return { error: "SOMEONE GRABBED THAT ONE. TRY THE NEXT COLOUR." };
    const id = playerId && /^[a-z0-9]{6,20}$/.test(playerId) ? playerId : newId();
    core.players[id] = {
      id, name: nm, avatar: { c: avatar.c, p: avatar.p },
      points: 0, rank: null, prevRank: null, roundPoints: 0, roundRank: null,
      bot: false, connected: true, joinedAt: now, lastSeen: now
    };
    state.dirty.add("core");
    return { ok: true, playerId: id, created: true };
  }
  // Resume (and, in the lobby, allow changing name/avatar).
  existing.connected = true;
  existing.lastSeen = now;
  if (core.phase === "lobby") {
    if (nm && nm !== existing.name) {
      if (nameTakenBy(core, nm, existing.id)) return { error: "THAT NAME IS TAKEN." };
      existing.name = nm;
    }
    if (validAvatar(avatar) && (avatar.c !== existing.avatar.c || avatar.p !== existing.avatar.p)) {
      if (avatarTakenBy(core, avatar, existing.id)) return { error: "SOMEONE GRABBED THAT ONE. TRY THE NEXT COLOUR." };
      existing.avatar = { c: avatar.c, p: avatar.p };
    }
  }
  state.dirty.add("core");
  return { ok: true, playerId: existing.id, created: false };
}

export function hello(state, playerId, now = Date.now()) {
  const p = state.core.players[playerId];
  if (!p) return { error: "UNKNOWN PLAYER" };
  p.connected = true;
  p.lastSeen = now;
  state.dirty.add("core");
  return { ok: true, playerId };
}

export function setConnected(state, playerId, connected, now = Date.now()) {
  const p = state.core.players[playerId];
  if (!p) return false;
  p.connected = connected;
  p.lastSeen = now;
  state.dirty.add("core");
  return true;
}

export function removePlayer(state, playerId) {
  if (!state.core.players[playerId]) return false;
  delete state.core.players[playerId];
  state.dirty.add("core");
  return true;
}

// ---------------------------------------------------------------- answers
export function answer(state, playerId, roundId, a, now = Date.now(), final = true) {
  const core = state.core;
  const p = core.players[playerId];
  if (!p) return { error: "UNKNOWN PLAYER" };
  if (core.phase !== "playing" || core.paused) return { error: "NOT NOW", ignored: true };
  if (roundId !== core.roundId) return { error: "WRONG ROUND", ignored: true };
  let size = 0;
  try { size = JSON.stringify(a).length; } catch (e) { return { error: "BAD ANSWER" }; }
  if (size > ANSWER_MAX_BYTES) return { error: "ANSWER TOO BIG" };
  const game = currentGame(core);
  const bucket = state.answers[roundId] || (state.answers[roundId] = {});
  const prev = bucket[playerId];
  if (prev && prev.final && !game.progressive) {
    // Non-progressive games accept a resubmit (last one counts) until the lock.
  }
  bucket[playerId] = { a, t: Math.max(0, now - core.startedAt), final: !!final };
  state.dirty.add("answers:" + roundId);
  p.lastSeen = now;
  // Auto-end: every connected human has locked in.
  if (game.autoEnd !== false && !game.progressive) {
    const humans = Object.values(core.players).filter((q) => !q.bot && q.connected);
    const allIn = humans.length > 0 && humans.every((q) => bucket[q.id] && bucket[q.id].final);
    if (allIn && core.endsAt - now > AUTO_END_GRACE_MS) {
      core.endsAt = now + AUTO_END_GRACE_MS;
      state.dirty.add("core");
      return { ok: true, autoEnd: true };
    }
  }
  return { ok: true };
}

export function setPrediction(state, playerId, data, now = Date.now()) {
  const p = state.core.players[playerId];
  if (!p) return { error: "UNKNOWN PLAYER" };
  const clean = {};
  for (const k of ["dueDate", "weight", "looksLike", "firstWord", "hair", "name"]) {
    if (data && data[k] != null) clean[k] = String(data[k]).replace(/[<>]/g, "").slice(0, 60);
  }
  state.predictions[playerId] = { ...clean, name: p.name, at: now };
  state.dirty.add("predictions");
  return { ok: true };
}

// ------------------------------------------------------------ host / flow
export function authHost(state, { pin, token }, envPin) {
  const core = state.core;
  if (token && core.hostTokens.includes(token)) return { ok: true, token };
  if (!envPin) return { error: "HOST PIN IS NOT CONFIGURED ON THE SERVER." };
  if (pin !== undefined && String(pin) === String(envPin)) {
    const t = newId() + newId();
    core.hostTokens = core.hostTokens.concat(t).slice(-10);
    state.dirty.add("core");
    return { ok: true, token: t };
  }
  return { error: "WRONG PIN." };
}

export function isHostToken(state, token) {
  return !!token && state.core.hostTokens.includes(token);
}

function enterIntro(state, gameIndex, now) {
  const core = state.core;
  core.gameIndex = gameIndex;
  core.round = 0;
  core.roundId = null;
  core.startedAt = null;
  setPhase(state, "intro", now);
}

function enterHowto(state, round, now) {
  const core = state.core;
  const game = currentGame(core);
  core.round = round;
  core.roundId = game.id + "-" + round;
  core.startedAt = null;
  core.botQueue = [];
  core.nextBot = 0;
  const ms = round === 1 ? HOWTO_FIRST_MS : HOWTO_MS;
  setPhase(state, "howto", now, now + ms);
  contentFor(state, game, round);
}

function startPlaying(state, now) {
  const core = state.core;
  const game = currentGame(core);
  const ctx = roundCtx(state, game, core.round);
  core.startedAt = now;
  state.answers[core.roundId] = {};
  state.dirty.add("answers:" + core.roundId);
  // Bots decide now; their answers land over the round via tick().
  const bots = Object.values(core.players).filter((p) => p.bot);
  const rng = rngFor(core.seed, core.roundId + ":bots");
  core.botQueue = bots.map((b) => {
    const res = game.botAnswer(core.round, ctx, b, rng) || { a: null, delayMs: ctx.roundTime };
    const delay = Math.min(ctx.roundTime - 200, Math.max(300, res.delayMs | 0));
    return { id: b.id, at: now + delay, a: res.a };
  }).sort((x, y) => x.at - y.at);
  core.nextBot = 0;
  setPhase(state, "playing", now, now + ctx.roundTime);
}

function lockRound(state, now) {
  const core = state.core;
  const game = currentGame(core);
  const round = core.round;
  const roundId = core.roundId;
  // Flush any bots that had not "answered" yet so a short round still scores them.
  releaseBots(state, Infinity, now);
  const ctx = roundCtx(state, game, round);
  const answers = state.answers[roundId] || {};
  const ids = Object.keys(core.players);
  let points = {};
  try { points = game.score(answers, round, ctx) || {}; } catch (e) { points = {}; }
  const totalsBefore = {};
  ids.forEach((id) => { totalsBefore[id] = core.players[id].points; });
  const before = rankBy(totalsBefore, ids).ranks;
  ids.forEach((id) => {
    const p = core.players[id];
    const rp = Math.max(0, Math.round(points[id] || 0));
    points[id] = rp;
    p.roundPoints = rp;
    // Before anyone has scored, every rank is a tie at #1: no meaningful "previous rank".
    p.prevRank = core.scoredRounds.length > 0 ? before[id] : null;
    p.points += rp;
  });
  const totals = {};
  ids.forEach((id) => { totals[id] = core.players[id].points; });
  const after = rankBy(totals, ids);
  ids.forEach((id) => { core.players[id].rank = after.ranks[id]; });
  const rr = rankBy(points, ids);
  ids.forEach((id) => { core.players[id].roundRank = rr.ranks[id]; });
  const mvp = rr.sorted.filter((id) => points[id] > 0).slice(0, 3).map((id) => row(core.players[id]));
  const callouts = computeCallouts(state, game, round, answers, points, rr, before, after, ctx);
  let reveal = {};
  try { reveal = game.revealData(answers, round, ctx, points) || {}; } catch (e) { reveal = { error: true }; }
  const maxPoints = game.maxPoints ? game.maxPoints(round) : 1000;
  state.results[roundId] = {
    roundId, gameId: game.id, round, at: now,
    points, roundRanks: rr.ranks, mvp, callouts, reveal, maxPoints,
    board: boardRows(core),
    answered: Object.keys(answers).length
  };
  state.dirty.add("results:" + roundId);
  core.scoredRounds.push(roundId);
  core.revealNonce++;
  setPhase(state, "locked", now, now + LOCKED_MS);
}

function row(p) {
  return { id: p.id, name: p.name, avatar: p.avatar, points: p.points, rank: p.rank, prevRank: p.prevRank,
    delta: p.prevRank && p.rank ? p.prevRank - p.rank : 0, roundPoints: p.roundPoints, roundRank: p.roundRank, bot: !!p.bot };
}

export function boardRows(core) {
  return Object.values(core.players).map(row).sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9) || a.name.localeCompare(b.name));
}

function computeCallouts(state, game, round, answers, points, rr, before, after, ctx) {
  const core = state.core;
  const out = [];
  const players = core.players;
  const ids = Object.keys(players);
  const maxPoints = game.maxPoints ? game.maxPoints(round) : 1000;
  const isFirstScored = core.scoredRounds.length === 0;
  const top = after.sorted;
  const name = (id) => ({ id, name: players[id].name, avatar: players[id].avatar });

  // NEW HIGH SCORE: a different player holds #1 now (and it is not the first round).
  const prevLeader = rankBy(Object.fromEntries(ids.map((id) => [id, players[id].points - points[id]])), ids).sorted[0];
  if (!isFirstScored && top[0] && prevLeader !== top[0] && players[top[0]].points > 0) {
    out.push({ type: "NEW_HIGH_SCORE", ...name(top[0]), value: players[top[0]].points });
  }
  // PERFECT ROUND
  const perfect = ids.filter((id) => points[id] >= maxPoints);
  if (perfect.length) out.push({ type: "PERFECT_ROUND", ...name(perfect[0]), value: perfect.length });
  // SPEED DEMON: fastest among those who scored at least 60% of the max.
  let fast = null;
  ids.forEach((id) => {
    const a = answers[id];
    if (a && points[id] >= maxPoints * 0.6 && (fast === null || a.t < answers[fast].t)) fast = id;
  });
  if (fast && ids.filter((id) => points[id] >= maxPoints * 0.6).length >= 2) out.push({ type: "SPEED_DEMON", ...name(fast), value: answers[fast].t });
  // BIGGEST CLIMB (>= 3 places)
  let climber = null, climb = 0;
  ids.forEach((id) => {
    const d = (before[id] || 0) - (after.ranks[id] || 0);
    if (d > climb) { climb = d; climber = id; }
  });
  if (climber && climb >= 3 && !isFirstScored) out.push({ type: "BIGGEST_CLIMB", ...name(climber), value: climb });
  // COMEBACK: bottom half -> top 5
  const n = ids.length;
  if (!isFirstScored && n >= 8) {
    const cb = ids.find((id) => before[id] > n / 2 && after.ranks[id] <= 5 && climber !== id);
    if (cb) out.push({ type: "COMEBACK", ...name(cb), value: before[cb] });
  }
  // PHOTO FINISH: top two within 50 points
  if (top.length >= 2 && players[top[0]].points > 0 && players[top[0]].points - players[top[1]].points <= 50) {
    out.push({ type: "PHOTO_FINISH", ...name(top[0]), other: name(top[1]), value: players[top[0]].points - players[top[1]].points });
  }
  // FIRST BLOOD: first points ever for a player (only meaningful after round 1)
  if (!isFirstScored) {
    const fresh = ids.filter((id) => points[id] > 0 && players[id].points === points[id]);
    if (fresh.length === 1) out.push({ type: "FIRST_BLOOD", ...name(fresh[0]), value: points[fresh[0]] });
  }
  return out.slice(0, 4);
}

function advanceAfterRound(state, now) {
  const core = state.core;
  const game = currentGame(core);
  if (game && core.round < game.rounds) return enterHowto(state, core.round + 1, now);
  if (core.gameIndex + 1 < core.order.length) return enterIntro(state, core.gameIndex + 1, now);
  return setPhase(state, "final", now);
}

function releaseBots(state, until, now) {
  const core = state.core;
  if (core.phase !== "playing") return false;
  let any = false;
  const bucket = state.answers[core.roundId] || (state.answers[core.roundId] = {});
  while (core.nextBot < core.botQueue.length && core.botQueue[core.nextBot].at <= until) {
    const b = core.botQueue[core.nextBot++];
    if (core.players[b.id] && b.a !== null && b.a !== undefined) {
      bucket[b.id] = { a: b.a, t: Math.max(0, Math.min(b.at, now) - core.startedAt), final: true };
      any = true;
    }
  }
  if (any) state.dirty.add("answers:" + core.roundId);
  return any;
}

export function tick(state, now = Date.now()) {
  const core = state.core;
  let changed = false;
  if (core.paused) return { changed };
  if (core.phase === "playing") changed = releaseBots(state, now, now) || changed;
  if (core.endsAt != null && now >= core.endsAt) {
    if (core.phase === "howto") { startPlaying(state, now); changed = true; }
    else if (core.phase === "playing") { lockRound(state, now); changed = true; }
    else if (core.phase === "locked") { setPhase(state, "reveal", now); changed = true; }
  }
  return { changed };
}

export function nextWake(core) {
  if (core.paused) return null;
  let t = null;
  if (["howto", "playing", "locked"].includes(core.phase) && core.endsAt != null) t = core.endsAt;
  if (core.phase === "playing" && core.nextBot < core.botQueue.length) {
    const b = core.botQueue[core.nextBot].at;
    t = t == null ? b : Math.min(t, b);
  }
  return t;
}

export function addBots(state, n, now = Date.now()) {
  const core = state.core;
  const taken = new Set(takenAvatars(core));
  const combos = [];
  for (const p of PALETTES) for (const r of ROSTER) combos.push({ c: r.c, p });
  let added = 0;
  for (const av of combos) {
    if (added >= n || Object.keys(core.players).length >= MAX_PLAYERS) break;
    if (taken.has(av.c + ":" + av.p)) continue;
    let name, tries = 0;
    do { name = botName(core.botCounter++); tries++; } while (nameTakenBy(core, name) && tries < 500);
    const id = "bot" + newId().slice(0, 7);
    core.players[id] = { id, name, avatar: av, points: 0, rank: null, prevRank: null, roundPoints: 0, roundRank: null, bot: true, connected: true, joinedAt: now, lastSeen: now };
    taken.add(av.c + ":" + av.p);
    added++;
  }
  state.dirty.add("core");
  return added;
}

export function removeBots(state) {
  const core = state.core;
  let n = 0;
  for (const id of Object.keys(core.players)) if (core.players[id].bot) { delete core.players[id]; n++; }
  core.botQueue = [];
  core.nextBot = 0;
  state.dirty.add("core");
  return n;
}

export function reset(state, now = Date.now()) {
  const core = state.core;
  for (const p of Object.values(core.players)) { p.points = 0; p.rank = null; p.prevRank = null; p.roundPoints = 0; p.roundRank = null; }
  const oldAnswers = Object.keys(state.answers), oldResults = Object.keys(state.results);
  state.answers = {};
  state.results = {};
  state.cache = {};
  core.scoredRounds = [];
  core.botQueue = [];
  core.nextBot = 0;
  core.gameIndex = -1;
  core.round = 0;
  core.roundId = null;
  core.startedAt = null;
  core.seed = (core.seed + 7919) >>> 0;
  setPhase(state, "lobby", now);
  state.dirty.add("core");
  oldAnswers.forEach((k) => state.dirty.add("del:answers:" + k));
  oldResults.forEach((k) => state.dirty.add("del:results:" + k));
  return true;
}

export function command(state, cmd, arg, now = Date.now()) {
  const core = state.core;
  const phase = core.phase;
  switch (cmd) {
    case "start":
      if (phase !== "lobby") return { error: "ALREADY STARTED" };
      enterIntro(state, 0, now);
      return { ok: true };
    case "next":
      if (phase === "lobby") { enterIntro(state, 0, now); return { ok: true }; }
      if (phase === "intro") { enterHowto(state, 1, now); return { ok: true }; }
      if (phase === "howto") { startPlaying(state, now); return { ok: true }; }
      if (phase === "playing") { lockRound(state, now); return { ok: true }; }
      if (phase === "locked") return { ok: true, wait: true };
      if (phase === "reveal") { setPhase(state, "results", now); return { ok: true }; }
      if (phase === "results") { setPhase(state, "leaderboard", now); return { ok: true }; }
      if (phase === "leaderboard") { advanceAfterRound(state, now); return { ok: true }; }
      if (phase === "final") { setPhase(state, "predictions", now); return { ok: true }; }
      if (phase === "predictions") { setPhase(state, "credits", now); return { ok: true }; }
      return { ok: true, wait: true };
    case "extend":
      if (phase !== "playing") return { error: "NOT PLAYING" };
      if (core.paused) core.pauseLeft += EXTEND_MS; else core.endsAt += EXTEND_MS;
      state.dirty.add("core");
      return { ok: true };
    case "end":
      if (phase === "howto") { startPlaying(state, now); return { ok: true }; }
      if (phase !== "playing") return { error: "NOT PLAYING" };
      if (core.paused) command(state, "resume", null, now);
      lockRound(state, now);
      return { ok: true };
    case "skipRound":
      if (["lobby", "final", "predictions", "credits"].includes(phase)) return { error: "NOTHING TO SKIP" };
      if (phase === "intro") { enterHowto(state, 1, now); return { ok: true }; }
      advanceAfterRound(state, now);
      return { ok: true };
    case "skipGame":
      if (["lobby", "final", "predictions", "credits"].includes(phase)) return { error: "NOTHING TO SKIP" };
      if (core.gameIndex + 1 < core.order.length) enterIntro(state, core.gameIndex + 1, now); else setPhase(state, "final", now);
      return { ok: true };
    case "goto": {
      const gi = Number(arg && arg.gameIndex), r = Number(arg && arg.round) || 1;
      if (!(gi >= 0 && gi < core.order.length)) return { error: "BAD GAME" };
      enterIntro(state, gi, now);
      if (r > 1) enterHowto(state, Math.min(r, currentGame(core).rounds), now);
      return { ok: true };
    }
    case "showLeaderboard":
      if (["results", "reveal"].includes(phase)) { setPhase(state, "leaderboard", now); return { ok: true }; }
      return { error: "NOT NOW" };
    case "replay":
      if (!["reveal", "results", "leaderboard"].includes(phase)) return { error: "NOTHING TO REPLAY" };
      core.revealNonce++;
      if (phase !== "reveal") setPhase(state, "reveal", now);
      state.dirty.add("core");
      return { ok: true };
    case "pause":
      if (phase !== "playing" || core.paused) return { error: "NOT NOW" };
      core.paused = true;
      core.pausedAt = now;
      core.pauseLeft = Math.max(0, core.endsAt - now);
      core.endsAt = null;
      state.dirty.add("core");
      return { ok: true };
    case "resume": {
      if (!core.paused) return { error: "NOT PAUSED" };
      const gap = now - core.pausedAt;
      core.botQueue.forEach((b, i) => { if (i >= core.nextBot) b.at += gap; });
      core.paused = false;
      core.endsAt = now + core.pauseLeft;
      core.pausedAt = null;
      core.pauseLeft = 0;
      state.dirty.add("core");
      return { ok: true };
    }
    case "kick":
      return removePlayer(state, arg && arg.playerId) ? { ok: true, kicked: arg.playerId } : { error: "NO SUCH PLAYER" };
    case "addBots":
      return { ok: true, added: addBots(state, Math.max(1, Math.min(120, Number(arg && arg.n) || 20)), now) };
    case "removeBots":
      return { ok: true, removed: removeBots(state) };
    case "reset":
      reset(state, now);
      return { ok: true };
    default:
      return { error: "UNKNOWN COMMAND" };
  }
}

// ----------------------------------------------------------- snapshots
export function publicState(state, now = Date.now()) {
  const core = state.core;
  const game = currentGame(core);
  const players = Object.values(core.players);
  const humans = players.filter((p) => !p.bot);
  const bucket = core.roundId ? state.answers[core.roundId] || {} : {};
  const snap = {
    t: "state",
    phase: core.phase,
    phaseAt: core.phaseAt,
    endsAt: core.endsAt,
    serverNow: now,
    paused: core.paused,
    pauseLeft: core.pauseLeft,
    gameIndex: core.gameIndex,
    gameCount: core.order.length,
    game: gameInfo(game),
    round: core.round,
    roundId: core.roundId,
    roundTime: game && core.round ? game.roundTime(core.round) : null,
    maxPoints: game && core.round && game.maxPoints ? game.maxPoints(core.round) : 1000,
    playerCount: players.length,
    humanCount: humans.length,
    botCount: players.length - humans.length,
    connectedCount: players.filter((p) => p.connected).length,
    answerCount: Object.keys(bucket).length,
    revealNonce: core.revealNonce,
    order: core.order.map((id) => gameInfo(GAMES_BY_ID[id])),
    scored: core.scoredRounds.length,
    taken: takenAvatars(core)
  };
  if (game && core.round && ["howto", "playing", "locked", "reveal", "results"].includes(core.phase)) {
    snap.content = contentFor(state, game, core.round);
    snap.howto = game.howto ? game.howto(core.round, snap.content) : null;
  }
  if (core.phase === "lobby") snap.players = publicPlayers(core);
  if (core.roundId && ["reveal", "results", "leaderboard"].includes(core.phase)) {
    const r = state.results[core.roundId];
    if (r) snap.results = { roundId: r.roundId, gameId: r.gameId, round: r.round, mvp: r.mvp, callouts: r.callouts, reveal: r.reveal, board: r.board, maxPoints: r.maxPoints, answered: r.answered };
  }
  if (["final", "predictions", "credits"].includes(core.phase)) snap.results = { final: true, board: boardRows(core) };
  return snap;
}

export function youMessage(state, playerId) {
  const core = state.core;
  const p = core.players[playerId];
  if (!p) return { t: "you", gone: true };
  const bucket = core.roundId ? state.answers[core.roundId] || {} : {};
  const a = bucket[playerId];
  const r = core.roundId && state.results[core.roundId];
  return {
    t: "you", id: p.id, name: p.name, avatar: p.avatar, points: p.points, rank: p.rank, prevRank: p.prevRank,
    roundPoints: r ? r.points[playerId] || 0 : 0, roundRank: r ? r.roundRanks[playerId] || null : null,
    answered: !!a, answerFinal: !!(a && a.final), myAnswer: a ? a.a : undefined,
    playerCount: Object.keys(core.players).length,
    prediction: state.predictions[playerId] || null
  };
}

export function hostView(state) {
  const core = state.core;
  return {
    t: "host",
    players: Object.values(core.players).map(row).map((r) => ({ ...r, connected: !!core.players[r.id].connected })),
    taken: takenAvatars(core),
    predictions: Object.keys(state.predictions).length
  };
}

export function liveStat(state) {
  const core = state.core;
  if (core.phase !== "playing") return null;
  const game = currentGame(core);
  if (!game.liveStat) return null;
  try { return game.liveStat(state.answers[core.roundId] || {}, core.round, roundCtx(state, game, core.round)); } catch (e) { return null; }
}
