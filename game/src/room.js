// The game room: one Durable Object that every phone, the host and the TV
// connect to over WebSockets (Hibernation API). It owns the clock, the answers
// and the scores; clients only render what it broadcasts.
import { DurableObject } from "cloudflare:workers";
import * as L from "./logic.js";

const BROADCAST_COALESCE_MS = 120;
const LIVE_MS = 400;
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 25;

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.state = null;
    this.flushTimer = null;
    this.liveTimer = null;
    this.persistTimer = null;
    this.rates = new Map();
    this.ctx.blockConcurrencyWhile(async () => { await this.load(); });
  }

  async load() {
    const all = await this.ctx.storage.list();
    const st = L.createState(Date.now());
    const core = all.get("core");
    if (core) st.core = { ...st.core, ...core, order: st.core.order };
    for (const [k, v] of all) {
      if (k.startsWith("answers:")) st.answers[k.slice(8)] = v;
      else if (k.startsWith("results:")) st.results[k.slice(8)] = v;
      else if (k === "predictions") st.predictions = v;
    }
    st.dirty.clear();
    this.state = st;
    if (!core) await this.ctx.storage.put("core", st.core);
  }

  async persist() {
    const st = this.state;
    if (!st.dirty.size) return;
    const puts = {};
    const dels = [];
    for (const k of st.dirty) {
      if (k === "core") puts.core = st.core;
      else if (k.startsWith("answers:")) puts[k] = st.answers[k.slice(8)] || {};
      else if (k.startsWith("results:")) puts[k] = st.results[k.slice(8)] || {};
      else if (k === "predictions") puts.predictions = st.predictions;
      else if (k.startsWith("del:")) dels.push(k.slice(4));
    }
    st.dirty.clear();
    if (Object.keys(puts).length) await this.ctx.storage.put(puts);
    if (dels.length) await this.ctx.storage.delete(dels);
  }

  // ------------------------------------------------------------ HTTP
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ pid: null, host: false, role: url.searchParams.get("role") || "player" });
      this.sendTo(server, L.publicState(this.state, Date.now()));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/api/state") {
      return json({ ...L.publicState(this.state, Date.now()), sockets: this.ctx.getWebSockets().length });
    }
    if (url.pathname === "/api/predictions.csv") {
      if (!L.isHostToken(this.state, url.searchParams.get("token"))) return new Response("forbidden", { status: 403 });
      const rows = [["Player", "Due date", "Weight", "Looks like", "First word", "Hair", "Name idea", "Submitted"]];
      for (const p of Object.values(this.state.predictions)) {
        rows.push([p.name, p.dueDate, p.weight, p.looksLike, p.firstWord, p.hair, p.name2 || p.nameIdea || "", new Date(p.at).toISOString()].map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"'));
      }
      return new Response(rows.map((r) => r.join(",")).join("\n"), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=predictions.csv" } });
    }
    if (url.pathname === "/api/board.csv") {
      if (!L.isHostToken(this.state, url.searchParams.get("token"))) return new Response("forbidden", { status: 403 });
      const rows = [["Rank", "Player", "Points", "Bot"]];
      for (const r of L.boardRows(this.state.core)) rows.push([r.rank, '"' + r.name.replace(/"/g, '""') + '"', r.points, r.bot ? "yes" : "no"]);
      return new Response(rows.map((r) => r.join(",")).join("\n"), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=leaderboard.csv" } });
    }
    return new Response("not found", { status: 404 });
  }

  // ------------------------------------------------------- WebSockets
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 20000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.t !== "string") return;
    const now = Date.now();
    if (msg.t === "ping") { this.sendTo(ws, { t: "pong", c: msg.c, s: now }); return; }
    if (!this.allow(ws, now)) { this.sendTo(ws, { t: "error", error: "SLOW DOWN" }); return; }

    const att = ws.deserializeAttachment() || {};
    const st = this.state;
    const reply = (m) => this.sendTo(ws, m);
    let changed = false;

    switch (msg.t) {
      case "join": {
        const res = L.join(st, { name: msg.name, avatar: msg.avatar, playerId: msg.playerId }, now);
        if (res.error) { reply({ t: "join-error", error: res.error }); break; }
        this.bindPlayer(ws, att, res.playerId);
        reply({ t: "joined", playerId: res.playerId, created: res.created });
        reply(L.youMessage(st, res.playerId));
        changed = true;
        break;
      }
      case "hello": {
        const res = L.hello(st, msg.playerId, now);
        if (res.error) { reply({ t: "join-error", error: res.error, unknown: true }); break; }
        this.bindPlayer(ws, att, res.playerId);
        reply({ t: "joined", playerId: res.playerId, created: false });
        reply(L.youMessage(st, res.playerId));
        if (st.core.phase === "playing") { const live = L.liveStat(st); if (live) reply({ t: "live", roundId: st.core.roundId, stat: live }); }
        changed = true;
        break;
      }
      case "answer": {
        if (!att.pid) { reply({ t: "error", error: "JOIN FIRST" }); break; }
        const res = L.answer(st, att.pid, msg.roundId, msg.a, now, msg.final !== false);
        if (res.error && !res.ignored) reply({ t: "error", error: res.error });
        if (res.ok) {
          reply({ t: "answer-ok", roundId: msg.roundId, final: msg.final !== false });
          this.scheduleLive();
          // Progressive (partial) answers arrive many times a second from 80 phones:
          // persist them soon, but only re-broadcast state for final answers / auto-end.
          if (msg.final === false && !res.autoEnd) { this.persistSoon(); break; }
          changed = true;
        }
        break;
      }
      case "prediction": {
        if (!att.pid) break;
        const res = L.setPrediction(st, att.pid, msg.data, now);
        if (res.ok) {
          reply({ t: "prediction-ok" });
          reply(L.youMessage(st, att.pid));
          this.mirrorPrediction(att.pid);
        }
        await this.persist();
        break;
      }
      case "host": {
        const res = L.authHost(st, { pin: msg.pin, token: msg.token }, this.env.HOST_PIN);
        if (res.error) { reply({ t: "host-error", error: res.error }); break; }
        att.host = true;
        ws.serializeAttachment(att);
        reply({ t: "host-ok", token: res.token });
        reply(L.hostView(st));
        await this.persist();
        break;
      }
      case "cmd": {
        if (!att.host || !L.isHostToken(st, msg.token)) { reply({ t: "error", error: "NOT THE HOST" }); break; }
        const res = L.command(st, msg.cmd, msg.arg, now);
        reply({ t: "cmd-ok", cmd: msg.cmd, ...res });
        if (res.kicked) this.closePlayerSockets(res.kicked, "KICKED");
        if (msg.cmd === "removeBots" || msg.cmd === "reset") this.state.cache = {};
        changed = true;
        break;
      }
      default:
        break;
    }
    if (changed) await this.afterChange();
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const att = ws.deserializeAttachment() || {};
    if (att.pid) {
      const stillOpen = this.ctx.getWebSockets().some((s) => s !== ws && (s.deserializeAttachment() || {}).pid === att.pid);
      if (!stillOpen) L.setConnected(this.state, att.pid, false, Date.now());
      await this.afterChange();
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1006, "error", false);
  }

  async alarm() {
    const now = Date.now();
    const { changed } = L.tick(this.state, now);
    if (changed) this.scheduleLive();
    await this.afterChange(changed);
  }

  // ------------------------------------------------------------ helpers
  // Mirror a prediction into the RSVP Google Sheet (Apps Script web app), best effort.
  mirrorPrediction(pid) {
    const endpoint = this.env.RSVP_ENDPOINT;
    const p = this.state.predictions[pid];
    if (!endpoint || !p) return;
    const body = JSON.stringify({ kind: "prediction", playerId: pid, player: p.name, dueDate: p.dueDate, weight: p.weight, looksLike: p.looksLike, firstWord: p.firstWord, hair: p.hair });
    this.ctx.waitUntil(fetch(endpoint, { method: "POST", headers: { "content-type": "text/plain" }, body, redirect: "follow" }).catch(() => {}));
  }

  bindPlayer(ws, att, pid) {
    att.pid = pid;
    ws.serializeAttachment(att);
  }

  closePlayerSockets(pid, reason) {
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment() || {};
      if (a.pid === pid) { try { s.send(JSON.stringify({ t: "kicked", reason })); s.close(4001, reason); } catch (e) { /* gone */ } }
    }
  }

  allow(ws, now) {
    const key = ws;
    let r = this.rates.get(key);
    if (!r || now - r.at > RATE_WINDOW_MS) { r = { at: now, n: 0 }; this.rates.set(key, r); }
    r.n++;
    if (this.rates.size > 500) this.rates.clear();
    return r.n <= RATE_MAX;
  }

  sendTo(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch (e) { /* socket closed */ }
  }

  persistSoon() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => { this.persistTimer = null; this.persist().catch(() => {}); }, 600);
  }

  async afterChange(broadcast = true) {
    await this.persist();
    await this.armAlarm();
    if (broadcast) this.scheduleBroadcast();
  }

  async armAlarm() {
    const t = L.nextWake(this.state.core);
    const current = await this.ctx.storage.getAlarm();
    if (t == null) { if (current != null) await this.ctx.storage.deleteAlarm(); return; }
    if (current == null || Math.abs(current - t) > 5) await this.ctx.storage.setAlarm(t);
  }

  scheduleBroadcast() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; this.broadcast(); }, BROADCAST_COALESCE_MS);
  }

  scheduleLive() {
    if (this.liveTimer) return;
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      const st = this.state;
      if (st.core.phase !== "playing") return;
      const live = L.liveStat(st);
      if (!live) return;
      const msg = JSON.stringify({ t: "live", roundId: st.core.roundId, stat: live });
      for (const s of this.ctx.getWebSockets()) { try { s.send(msg); } catch (e) { /* gone */ } }
    }, LIVE_MS);
  }

  broadcast() {
    const st = this.state;
    const now = Date.now();
    const snap = JSON.stringify(L.publicState(st, now));
    const hostMsg = JSON.stringify(L.hostView(st));
    const youCache = new Map();
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment() || {};
      try {
        s.send(snap);
        if (a.pid) {
          if (!youCache.has(a.pid)) youCache.set(a.pid, JSON.stringify(L.youMessage(st, a.pid)));
          s.send(youCache.get(a.pid));
        }
        if (a.host) s.send(hostMsg);
      } catch (e) { /* socket closed */ }
    }
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
