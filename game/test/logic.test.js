import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const av = (c, p = "p1") => ({ c, p });

function fresh() {
  const st = L.createState(1000, 42);
  return st;
}

test("join: validates name, avatar uniqueness and resumes by id", () => {
  const st = fresh();
  assert.ok(L.join(st, { name: "", avatar: av("mario") }).error);
  assert.ok(L.join(st, { name: "Ann", avatar: { c: "nope", p: "p1" } }).error);
  const a = L.join(st, { name: "Ann", avatar: av("mario") }, 1000);
  assert.ok(a.ok && a.created);
  assert.ok(L.join(st, { name: "ann", avatar: av("peach") }).error, "names are unique, case-insensitive");
  assert.ok(L.join(st, { name: "Bob", avatar: av("mario") }).error, "avatar+palette is unique");
  const b = L.join(st, { name: "Bob", avatar: av("mario", "p2") });
  assert.ok(b.ok);
  const again = L.join(st, { name: "Ann 2", avatar: av("mario"), playerId: a.playerId });
  assert.ok(again.ok && !again.created);
  assert.equal(st.core.players[a.playerId].name, "Ann 2");
  assert.equal(Object.keys(st.core.players).length, 2);
});

test("full round flow with bots scores, ranks and produces results", () => {
  const st = fresh();
  const me = L.join(st, { name: "Me", avatar: av("kirby") }, 1000).playerId;
  assert.equal(L.addBots(st, 10, 1000), 10);
  assert.equal(st.core.phase, "lobby");
  L.command(st, "start", null, 2000);
  assert.equal(st.core.phase, "intro");
  L.command(st, "next", null, 2100);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.roundId, "price-1");
  let t = st.core.endsAt;
  L.tick(st, t);
  assert.equal(st.core.phase, "playing");
  assert.equal(st.core.botQueue.length, 10);
  const snap = L.publicState(st, t);
  assert.equal(snap.content.items.length, 1);
  assert.equal(snap.content.min, 0);
  // Human answers mid-round; bots drip in via tick.
  const res = L.answer(st, me, "price-1", 40, t + 3000);
  assert.ok(res.ok);
  assert.ok(L.answer(st, me, "wrong-round", 40, t + 3000).ignored);
  // The only human has locked in, so the round auto-ends after a short grace.
  assert.equal(st.core.endsAt, t + 3000 + L.AUTO_END_GRACE_MS);
  L.tick(st, st.core.endsAt);
  assert.equal(st.core.phase, "locked");
  const answered = Object.keys(st.answers["price-1"]).length;
  assert.equal(answered, 11, "bots are flushed at the lock so everyone has an answer");
  const r = st.results["price-1"];
  assert.ok(r);
  assert.equal(Object.keys(r.points).length, 11, "every player has a points entry");
  assert.equal(r.board.length, 11);
  assert.ok(r.board[0].rank === 1);
  assert.ok(r.mvp.length >= 1 && r.mvp.length <= 3);
  assert.ok(Array.isArray(r.callouts));
  assert.equal(r.reveal.answer > 0, true);
  L.tick(st, st.core.endsAt);
  assert.equal(st.core.phase, "reveal");
  const you = L.youMessage(st, me);
  assert.equal(you.roundPoints, r.points[me]);
  assert.ok(you.rank >= 1);
  L.command(st, "next", null, 9e5);
  assert.equal(st.core.phase, "results");
  L.command(st, "next", null, 9e5);
  assert.equal(st.core.phase, "leaderboard");
  L.command(st, "next", null, 9e5);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.round, 2);
});

test("pause and resume keep the remaining time and bot timings", () => {
  const st = fresh();
  L.addBots(st, 3, 0);
  L.command(st, "start", null, 0);
  L.command(st, "next", null, 0);
  L.command(st, "next", null, 0);
  assert.equal(st.core.phase, "playing");
  const endsAt = st.core.endsAt;
  L.command(st, "pause", null, 5000);
  assert.equal(st.core.paused, true);
  assert.equal(L.nextWake(st.core), null);
  L.tick(st, 60000);
  assert.equal(st.core.phase, "playing", "no transitions while paused");
  L.command(st, "resume", null, 60000);
  assert.equal(st.core.endsAt, 60000 + (endsAt - 5000));
  assert.ok(st.core.botQueue.every((b) => b.at >= 60000));
});

test("extend, end, skip, reset and goto", () => {
  const st = fresh();
  L.addBots(st, 2, 0);
  L.command(st, "start", null, 0);
  L.command(st, "next", null, 0);
  L.command(st, "next", null, 0);
  const e = st.core.endsAt;
  L.command(st, "extend", null, 100);
  assert.equal(st.core.endsAt, e + L.EXTEND_MS);
  L.command(st, "end", null, 200);
  assert.equal(st.core.phase, "locked");
  L.command(st, "skipRound", null, 300);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.round, 2);
  L.command(st, "skipGame", null, 400);
  assert.ok(["intro", "final"].includes(st.core.phase));
  L.command(st, "goto", { gameIndex: 0, round: 3 }, 500);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.round, 3);
  L.command(st, "reset", null, 600);
  assert.equal(st.core.phase, "lobby");
  assert.deepEqual(st.answers, {});
  assert.ok(Object.values(st.core.players).every((p) => p.points === 0));
  assert.equal(L.removeBots(st), 2);
});

test("host auth: pin gives a token, token re-auths, wrong pin fails", () => {
  const st = fresh();
  assert.ok(L.authHost(st, { pin: "0000" }, "1234").error);
  const ok = L.authHost(st, { pin: "1234" }, "1234");
  assert.ok(ok.token);
  assert.ok(L.authHost(st, { token: ok.token }, "1234").ok);
  assert.ok(L.isHostToken(st, ok.token));
  assert.ok(L.authHost(st, { pin: "1234" }, "").error, "no pin configured");
});

test("final phase after the last round of the last game", () => {
  const st = fresh();
  L.addBots(st, 2, 0);
  L.command(st, "start", null, 0);
  let guard = 0;
  while (st.core.phase !== "final" && guard++ < 500) {
    if (["howto", "playing", "locked"].includes(st.core.phase)) L.tick(st, st.core.endsAt);
    else L.command(st, "next", null, 0);
  }
  assert.equal(st.core.phase, "final");
  const snap = L.publicState(st, 0);
  assert.equal(snap.results.final, true);
  assert.equal(snap.results.board.length, 2);
  L.command(st, "next", null, 0);
  assert.equal(st.core.phase, "predictions");
});
