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
  assert.equal(st.core.endsAt, null, "the how-to waits for the host");
  L.tick(st, 99999);
  assert.equal(st.core.phase, "howto", "no auto-start");
  L.command(st, "next", null, 3000);
  let t = st.core.startedAt;
  assert.equal(st.core.phase, "playing");
  assert.equal(st.core.botQueue.length, 10);
  const snap = L.publicState(st, t);
  assert.equal(snap.content.items.length, 1);
  assert.equal(snap.content.max - snap.content.min, 100, "the slider spans the data's range, slid to a seeded spot");
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
  assert.equal(st.core.endsAt > 0, true);
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

test("auto-end is a host setting", () => {
  const st = fresh();
  const me = L.join(st, { name: "Solo", avatar: av("sonic") }, 0).playerId;
  L.addBots(st, 2, 0);
  L.command(st, "autoEnd", { on: false }, 0);
  L.command(st, "start", null, 0); L.command(st, "next", null, 0); L.command(st, "next", null, 0);
  const ends = st.core.endsAt;
  L.answer(st, me, "price-1", 40, 1000);
  assert.equal(st.core.endsAt, ends, "no early end while auto-end is off");
  L.command(st, "autoEnd", { on: true }, 1500);
  L.answer(st, me, "price-1", 41, 2000);
  assert.equal(st.core.endsAt, 2000 + L.AUTO_END_GRACE_MS);
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
    if (["playing", "locked"].includes(st.core.phase)) L.tick(st, st.core.endsAt);
    else L.command(st, "next", null, 0);
  }
  assert.equal(st.core.phase, "final");
  const snap = L.publicState(st, 0);
  assert.equal(snap.results.final, true);
  assert.equal(snap.results.board.length, 2);
  L.command(st, "next", null, 0);
  assert.equal(st.core.phase, "credits");
});

test("practice round: a host toggle on the how-to screen, off again once the round starts", () => {
  const st = fresh();
  L.join(st, { name: "Me", avatar: av("kirby") }, 1000);
  assert.ok(L.command(st, "practice", { on: true }, 1100).error, "not in the lobby");
  L.command(st, "goto", { gameIndex: st.core.order.indexOf("binky"), round: 1 }, 2000);
  L.command(st, "next", null, 2100);
  assert.equal(st.core.phase, "howto");
  let snap = L.publicState(st, 2200);
  assert.equal(snap.practiceAvailable, true);
  assert.equal(snap.practice, false);
  assert.equal(snap.practiceContent, undefined);
  assert.ok(L.command(st, "practice", { on: true }, 2300).ok);
  snap = L.publicState(st, 2400);
  assert.equal(snap.practice, true);
  assert.match(snap.practiceContent.title, /PRACTICE/);
  assert.equal(snap.practiceContent.practiceMs, 45000);
  assert.ok(snap.practiceContent.spec.density < 95, "simpler than round 1");
  assert.notEqual(snap.practiceContent.seed, st.core.seed, "its own seed, so it never matches round 1");
  assert.ok(L.command(st, "practice", { on: false }, 2450).ok);
  assert.equal(L.publicState(st, 2460).practice, false);
  L.command(st, "practice", { on: true }, 2470);
  L.command(st, "next", null, 2500);
  assert.equal(st.core.phase, "playing");
  assert.equal(st.core.practice, false, "cleared when the round starts");
  assert.equal(L.publicState(st, 2600).practice, undefined);
  // Games without a practice level refuse the toggle.
  L.command(st, "goto", { gameIndex: st.core.order.indexOf("price"), round: 1 }, 3000);
  L.command(st, "next", null, 3100);
  assert.equal(st.core.phase, "howto");
  assert.ok(L.command(st, "practice", { on: true }, 3200).error);
  assert.equal(L.publicState(st, 3300).practiceAvailable, false);
});

test("answerCount counts final answers only; a moved slider is just touched", () => {
  const st = fresh();
  const me = L.join(st, { name: "Me", avatar: av("kirby") }, 1000).playerId;
  L.command(st, "start", null, 2000);
  L.command(st, "next", null, 2100);
  L.command(st, "next", null, 2200);
  assert.equal(st.core.phase, "playing");
  L.answer(st, me, st.core.roundId, 50, 2300, false);
  let snap = L.publicState(st, 2400);
  assert.equal(snap.answerCount, 0);
  assert.equal(snap.touchedCount, 1);
  assert.equal(snap.game.progressive, false);
  L.answer(st, me, st.core.roundId, 50, 2500, true);
  snap = L.publicState(st, 2600);
  assert.equal(snap.answerCount, 1);
  assert.equal(snap.touchedCount, 1);
});

// Drive the room to a game's first round, playing and scoring it.
function playRound(st, gameId, at) {
  const gi = st.core.order.indexOf(gameId);
  L.command(st, "goto", { gameIndex: gi, round: 1 }, at);
  L.command(st, "next", null, at);       // intro -> howto
  L.command(st, "next", null, at + 10);  // howto -> playing
  L.command(st, "end", null, at + 5000); // lock
  L.tick(st, st.core.endsAt);            // locked -> reveal
}

test("boss battle: results go straight to the next question and then the final, never the leaderboard", () => {
  const st = fresh();
  L.addBots(st, 6, 0);
  L.command(st, "start", null, 0);
  playRound(st, "boss", 1000);
  assert.equal(st.core.phase, "reveal");
  assert.equal(L.publicState(st, 2000).hideBoard, true);
  assert.ok(L.command(st, "showLeaderboard", null, 7000).error);
  L.command(st, "next", null, 7000);
  assert.equal(st.core.phase, "results");
  L.command(st, "next", null, 8000);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.round, 2);
  for (let r = 2; r <= 5; r++) {
    L.command(st, "next", null, 10000 * r);
    L.command(st, "end", null, 10000 * r + 3000);
    L.tick(st, st.core.endsAt);
    L.command(st, "next", null, 10000 * r + 5000); // reveal -> results
    L.command(st, "next", null, 10000 * r + 6000); // results -> next question / final
  }
  assert.equal(st.core.phase, "final");
  // Other games keep their leaderboard.
  const st2 = fresh();
  L.addBots(st2, 3, 0);
  L.command(st2, "start", null, 0);
  playRound(st2, "price", 1000);
  assert.equal(L.publicState(st2, 2000).hideBoard, false);
  L.command(st2, "next", null, 7000);
  L.command(st2, "next", null, 8000);
  assert.equal(st2.core.phase, "leaderboard");
});

test("redo round: back to the how-to card, answers and points from that round taken back", () => {
  const st = fresh();
  const me = L.join(st, { name: "Me", avatar: av("kirby") }, 0).playerId;
  L.addBots(st, 5, 0);
  L.command(st, "start", null, 0);
  L.command(st, "next", null, 0);   // howto price-1
  L.command(st, "next", null, 10);  // playing
  L.answer(st, me, "price-1", 40, 2000);
  L.command(st, "end", null, 3000);
  L.tick(st, st.core.endsAt);
  L.command(st, "next", null, 6000); // results
  L.command(st, "next", null, 7000); // leaderboard
  L.command(st, "next", null, 8000); // howto price-2
  L.command(st, "next", null, 8010); // playing price-2
  L.command(st, "end", null, 11000);
  L.tick(st, st.core.endsAt);
  const afterOne = Object.fromEntries(Object.values(st.core.players).map((p) => [p.id, p.points - st.results["price-2"].points[p.id]]));
  assert.ok(Object.values(st.results["price-2"].points).some((v) => v > 0));
  const res = L.command(st, "redoRound", null, 12000);
  assert.ok(res.ok);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.roundId, "price-2");
  assert.equal(st.results["price-2"], undefined);
  assert.equal(st.answers["price-2"], undefined);
  assert.deepEqual(st.core.scoredRounds, ["price-1"]);
  for (const p of Object.values(st.core.players)) assert.equal(p.points, afterOne[p.id], "points back to before the round");
  assert.ok(st.dirty.has("del:results:price-2"));
  // Play it again: it scores once, not twice.
  L.command(st, "next", null, 13000);
  assert.equal(st.core.phase, "playing");
  L.command(st, "end", null, 15000);
  L.tick(st, st.core.endsAt);
  assert.deepEqual(st.core.scoredRounds, ["price-1", "price-2"]);
  // Mid-round (and paused) works too, and nothing to redo in the lobby.
  L.command(st, "next", null, 16000);
  L.command(st, "next", null, 16100);
  L.command(st, "next", null, 16200);
  L.command(st, "next", null, 16300); // playing price-3
  L.command(st, "pause", null, 17000);
  assert.ok(L.command(st, "redoRound", null, 17500).ok);
  assert.equal(st.core.phase, "howto");
  assert.equal(st.core.paused, false);
  L.reset(st, 20000);
  assert.ok(L.command(st, "redoRound", null, 20001).error);
});
