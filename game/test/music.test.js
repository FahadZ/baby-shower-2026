import { test } from "node:test";
import assert from "node:assert/strict";
import { SONGS, GAME_SONGS, trackFor } from "../public/data/music.js";
import { compileSong, parseChord, noteToMidi, parseMelody, leadEvents, HOLD, REST } from "../public/engine/notes.js";
import { GAMES } from "../src/games/index.js";

test("note and chord parsing", () => {
  assert.equal(noteToMidi("C4"), 60);
  assert.equal(noteToMidi("A4"), 69);
  assert.equal(noteToMidi("C#5"), 73);
  assert.equal(noteToMidi("Bb3"), 58);
  assert.equal(noteToMidi("H2"), null);
  assert.deepEqual(parseChord("Am"), { root: 9, tones: [0, 3, 7] });
  assert.deepEqual(parseChord("F#"), { root: 6, tones: [0, 4, 7] });
  assert.equal(parseChord("Cxyz"), null);
  assert.deepEqual(parseMelody("C4 . - |D4"), [60, HOLD, REST, 62]);
  assert.deepEqual(leadEvents(parseMelody("C4 . . D4 - E4")), [{ step: 0, midi: 60, len: 3 }, { step: 3, midi: 62, len: 1 }, { step: 5, midi: 64, len: 1 }]);
});

test("every written song compiles: whole bars, real notes, real chords", () => {
  for (const [id, song] of Object.entries(SONGS)) {
    if (song.file) continue;
    if (song.gen) {
      assert.ok(song.progs.length > 1, id + " has several progressions");
      for (const p of song.progs) for (const c of p) assert.ok(parseChord(c), id + ": " + c);
      for (const n of song.scale) assert.ok(parseChord(n), id + " scale: " + n);
      continue;
    }
    const c = compileSong({ id, ...song });
    assert.deepEqual(c.errors, [], id);
    assert.ok(c.loop.length > 0 && c.loop.every((s) => s.bars.length > 0), id);
    // Lead notes stay in a sensible range for a TV speaker.
    for (const s of c.intro.concat(c.loop)) for (const e of s.lead) assert.ok(e.midi >= 55 && e.midi <= 90, id + " note " + e.midi);
  }
});

test("every game has its own song", () => {
  for (const g of GAMES) assert.ok(SONGS[GAME_SONGS[g.id]], g.id);
  assert.equal(new Set(Object.values(GAME_SONGS)).size, GAMES.length, "no two games share a tune");
});

test("trackFor: the right song and mode for each screen", () => {
  const snap = (phase, extra = {}) => ({ phase, gameIndex: 1, roundId: "r1", game: { id: "price" }, ...extra });
  assert.equal(trackFor(null), null);
  assert.deepEqual(trackFor(snap("lobby", { game: null })), { song: "lobby", mode: "full", key: "lobby" });
  assert.equal(trackFor(snap("intro")).song, "entertainer");
  assert.deepEqual(trackFor(snap("howto")), { song: "entertainer", mode: "groove", key: "g1" });
  assert.equal(trackFor(snap("howto")).key, trackFor(snap("intro")).key, "intro -> how-to keeps playing, no restart");
  assert.deepEqual(trackFor(snap("playing")), { song: "entertainer", mode: "full", key: "rr1" });
  assert.notEqual(trackFor(snap("playing", { roundId: "r2" })).key, trackFor(snap("playing")).key, "each round starts the tune fresh");
  assert.equal(trackFor(snap("reveal")).song, "suspense");
  assert.equal(trackFor(snap("leaderboard")).song, "victory");
  assert.equal(trackFor(snap("results")).key, trackFor(snap("leaderboard")).key);
  assert.equal(trackFor(snap("final")).song, "ode");
  assert.equal(trackFor(snap("credits")).song, "credits");
  // Night feed gets the lullaby; the boss keeps its tune through every screen.
  assert.equal(trackFor(snap("playing", { game: { id: "binky" }, content: { mode: "night" } })).song, "lullaby");
  assert.equal(trackFor(snap("playing", { game: { id: "binky" }, content: { mode: "normal" } })).song, "weasel");
  for (const ph of ["intro", "howto", "playing", "reveal", "results"]) assert.equal(trackFor(snap(ph, { game: { id: "boss" } })).song, "toccata", ph);
  assert.equal(SONGS.toccata.continuous, true);
});
