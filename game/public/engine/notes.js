// Pure helpers for the TV soundtrack: note names, chord symbols and the little
// tracker format the songs in data/music.js are written in. No DOM, no audio,
// so the songs can be checked by node --test.
//
//   melody: one token per step, bars split by "|" for reading only.
//           "E5" a note (C4 = middle C), "." holds the previous note, "-" is a rest.
//   chords: one entry per bar, separated by spaces; "F/C" splits the bar in two.
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { "#": 1, b: -1 };
export const HOLD = -1;
export const REST = -2;

const QUAL = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  dim: [0, 3, 6], sus4: [0, 5, 7], "6": [0, 4, 7, 9], aug: [0, 4, 8]
};

export function noteToMidi(tok) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (ACC[m[2]] || 0);
}

export function parseChord(sym) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  if (!m || !(m[3] in QUAL)) return null;
  return { root: (NAMES[m[1]] + (ACC[m[2]] || 0) + 12) % 12, tones: QUAL[m[3]] };
}

export function parseMelody(str) {
  return String(str || "").split(/[\s|]+/).filter(Boolean).map((t) => (t === "." ? HOLD : t === "-" ? REST : noteToMidi(t)));
}

export function parseChords(str) {
  return String(str || "").split(/\s+/).filter(Boolean).map((bar) => bar.split("/").map(parseChord));
}

export const stepsPerBar = (song, sec = {}) => (sec.beats || song.beats) * (sec.div || song.div);

// Melody steps -> lead notes { step, midi, len } (a held note runs until the next note or rest).
export function leadEvents(steps) {
  const out = [];
  steps.forEach((s, i) => {
    if (s === null || s < 0) return;
    let len = 1;
    while (steps[i + len] === HOLD) len++;
    out.push({ step: i, midi: s, len });
  });
  return out;
}

// A section ready to play, plus a list of problems (wrong bar lengths, bad tokens).
export function compileSection(song, sec, name = "section") {
  const per = stepsPerBar(song, sec);
  const steps = parseMelody(sec.mel);
  const bars = parseChords(sec.chords);
  const errors = [];
  if (steps.some((s) => s === null)) errors.push(name + ": bad note token");
  if (bars.some((b) => b.some((c) => !c))) errors.push(name + ": bad chord symbol");
  if (steps.length !== bars.length * per) errors.push(name + ": " + steps.length + " steps for " + bars.length + " bars of " + per);
  return { ...sec, per, steps, bars, lead: leadEvents(steps), errors };
}

export function compileSong(song) {
  const intro = (song.intro || []).map((s, k) => compileSection(song, s, song.id + " intro " + (k + 1)));
  const loop = (song.loop || []).map((s, k) => compileSection(song, s, song.id + " part " + (k + 1)));
  return { song, intro, loop, errors: intro.concat(loop).flatMap((s) => s.errors) };
}
