// The TV soundtrack player: a tiny 8-bit tracker on Web Audio. Pulse-wave lead,
// triangle bass, arpeggios and noise drums, scheduled a beat ahead. follow(snap)
// picks the song for the screen (data/music.js trackFor) and switches with a short
// fade; the last 10 seconds of a round play a little faster.
import { SONGS, trackFor } from "../data/music.js";
import { compileSong, compileSection, parseChord, leadEvents, HOLD, REST } from "./notes.js";

const LOOKAHEAD = 0.15;     // seconds scheduled ahead
const TICK_MS = 30;
const HYPE_MS = 10000;      // the last 10 s of a round
const HYPE = 1.12;
const LEVEL = 0.7;          // master music volume
const GAIN = { pulse25: 0.05, pulse12: 0.045, pulse50: 0.04, tri: 0.1, arp: 0.016, bass: 0.12, kick: 0.22, snare: 0.05, hat: 0.022 };

let ctx = null, out = null, waves = {}, noise = null;
let timer = 0, enabled = false, clock = () => Date.now();
let cur = null;             // the song being played
let want = null;            // { song, mode, key } from the last follow()
let snap = null, fileEl = null;
const compiled = {};

function setup(context) {
  ctx = context;
  out = ctx.createGain();
  out.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 4200; lp.Q.value = 0.3;
  out.connect(lp); lp.connect(ctx.destination);
  // Pulse waves with NES-style duty cycles.
  for (const [name, duty] of [["pulse25", 0.25], ["pulse12", 0.125], ["pulse50", 0.5]]) {
    const n = 40, real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    waves[name] = ctx.createPeriodicWave(real, imag);
  }
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ------------------------------------------------------------ voices
function tone(type, midi, t, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (waves[type]) o.setPeriodicWave(waves[type]); else o.type = type === "tri" ? "triangle" : type;
  o.frequency.value = hz(midi);
  const end = t + Math.max(0.03, dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.45), Math.max(t + 0.01, end - 0.02));
  g.gain.linearRampToValueAtTime(0.0001, end);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(end + 0.01);
}

function drum(kind, t, vol) {
  if (kind === "k") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(GAIN.kick * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.17);
    return;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise;
  const snare = kind === "s";
  f.type = snare ? "bandpass" : "highpass";
  f.frequency.value = snare ? 1800 : 7000;
  const len = snare ? 0.14 : 0.04;
  g.gain.setValueAtTime((snare ? GAIN.snare : GAIN.hat) * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.5); src.stop(t + len + 0.01);
}

// ------------------------------------------------------------ patterns
// Drum hits for step i of a bar: [[kind, volume], ...].
function drumHits(style, beats, div, i) {
  if (!style || style === "none") return [];
  const beat = Math.floor(i / div), sub = i % div, on = sub === 0;
  const half = div % 2 === 0 ? div / 2 : 0;          // the "and" of the beat (even divisions)
  const eighth = div === 3 ? true : div === 4 ? sub % 2 === 0 : true;
  const hits = [];
  switch (style) {
    case "rock":
      if (on && beat % 2 === 0) hits.push(["k", 1]);
      if (on && beat % 2 === 1) hits.push(["s", 1]);
      if (eighth) hits.push(["h", on ? 1 : 0.6]);
      break;
    case "four":
      if (on) hits.push(["k", 1]);
      if (on && beat % 2 === 1) hits.push(["s", 1]);
      if (half && sub === half) hits.push(["h", 1.2]);
      break;
    case "gallop":
      if (on && beat === 0) hits.push(["k", 1]);
      if (on && beat === 1) hits.push(["s", 0.8]);
      hits.push(["h", on ? 0.9 : 0.5]);
      break;
    case "waltz":
      if (on && beat === 0) hits.push(["k", 1]);
      if (on && beat > 0) hits.push(["h", 0.8]);
      break;
    case "rag":
      if (on && beat === 0) hits.push(["k", 1]);
      if (on && beat === 1) hits.push(["s", 0.8]);
      if (sub % 2 === 0) hits.push(["h", 0.6]);
      break;
    case "battle":
      if (sub % 2 === 0 && beat % 2 === 0) hits.push(["k", sub === 0 ? 1 : 0.7]);
      if (on && beat % 2 === 1) hits.push(["s", 1]);
      hits.push(["h", sub === 0 ? 0.8 : 0.45]);
      break;
    case "soft":
      if (on && beat === 0) hits.push(["k", 0.7]);
      if (on && beat === 2) hits.push(["s", 0.45]);
      if (eighth && Math.random() < 0.85) hits.push(["h", 0.45]);
      break;
    case "tick":
      if (eighth) hits.push(["h", on ? 0.7 : 0.35]);
      if (i === 0) hits.push(["k", 0.6]);
      break;
  }
  return hits;
}

// The chord sounding at step i of a bar (bars may hold two chords, split evenly).
function chordAt(bar, per, i) {
  const k = Math.min(bar.length - 1, Math.floor((i * bar.length) / per));
  return { chord: bar[k] || parseChord("C"), start: Math.round((k * per) / bar.length), len: Math.round(per / bar.length) };
}

// Bass notes starting at step i: [[midi, steps]].
function bassAt(style, song, sec, bar, i) {
  const { beats, div } = song, per = sec.per;
  const { chord, start, len } = chordAt(bar, per, i);
  const root = 36 + chord.root, fifth = root + 7, third = root + chord.tones[1];
  const beat = Math.floor(i / div), sub = i % div;
  const step8 = div === 4 ? 2 : 1;
  switch (style) {
    case "long": return i === start ? [[root, len]] : [];
    case "oct8": return sub % step8 === 0 ? [[(i / step8) % 2 ? root + 12 : root, step8]] : [];
    case "root8": return sub % step8 === 0 ? [[root, step8 * 0.7]] : [];
    case "pulse16": return [[root, 0.8]];
    case "walk": return sub === 0 ? [[[root, third, fifth, root + 12][beat % 4], div]] : [];
    case "rootfifth": return sub === 0 ? [[beat % 2 ? fifth - 12 : root, div * 0.9]] : [];
    case "oompah": {
      if (sub !== 0) return [];
      if (beats === 2) return [[beat === 0 ? root : fifth - 12, div * 0.6]];
      return beat % 2 === 0 ? [[beat === 0 ? root : fifth - 12, div * 0.6]] : [];
    }
    default: return [];
  }
}

// Arpeggio / chord notes starting at step i: [[midi, steps]].
function arpAt(style, song, sec, bar, i) {
  const { div } = song, per = sec.per;
  const { chord, start } = chordAt(bar, per, i);
  const tones = chord.tones.map((t) => 60 + chord.root + t).map((m) => (m > 76 ? m - 12 : m));
  const step = 1;
  const k = i - start;
  switch (style) {
    case "up": return k % step === 0 ? [[tones[(k / step) % tones.length] + (Math.floor(k / step / tones.length) % 2 ? 12 : 0), step * 0.8]] : [];
    case "updown": {
      const seq = tones.concat(tones.slice(1, -1).reverse());
      return [[seq[k % seq.length], 0.9]];
    }
    case "stab": {
      const off = div === 4 ? i % 4 === 2 : i % div !== 0;
      return off ? tones.slice(0, 3).map((m) => [m + 12, 0.6]) : [];
    }
    default: return [];
  }
}

// ------------------------------------------------------------ generated sections
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function generate(song) {
  const prog = pick(song.progs);
  const per = song.beats * song.div;
  const scale = [];
  const pcs = song.scale.map((n) => parseChord(n).root);
  for (let m = song.range[0]; m <= song.range[1]; m++) if (pcs.includes(m % 12)) scale.push(m);
  const steps = [];
  let at = Math.floor(scale.length / 2);
  for (let b = 0; b < prog.length; b++) {
    for (let i = 0; i < per; i++) {
      const strong = i % song.div === 0;
      if (steps.length && Math.random() > (strong ? song.density : song.density * 0.5)) { steps.push(Math.random() < 0.6 ? HOLD : REST); continue; }
      at = Math.max(0, Math.min(scale.length - 1, at + pick([-2, -1, -1, 0, 1, 1, 2])));
      steps.push(scale[at]);
    }
  }
  // Every phrase ends resting on a chord tone of its last chord.
  const last = parseChord(prog[prog.length - 1]);
  const landing = scale.filter((m) => last.tones.some((t) => (last.root + t) % 12 === m % 12));
  steps[steps.length - per] = landing.length ? landing[Math.floor(landing.length / 2)] : steps[steps.length - per];
  const sec = compileSection(song, { mel: "", chords: prog.join(" ") });
  return { ...sec, steps, lead: leadEvents(steps), errors: [] };
}

// ------------------------------------------------------------ the player
function startSong(id, mode, at) {
  const song = SONGS[id];
  stopFile();
  if (!song) { cur = null; return; }
  if (song.file) { cur = { id, file: true }; playFile(song.file); return; }
  if (!song.gen && !compiled[id]) compiled[id] = compileSong({ id, ...song });
  cur = { id, song, mode, sections: null, secIdx: 0, step: 0, pass: 0, intro: !song.gen && compiled[id].intro.length > 0, barsPlayed: 0, next: at };
  cur.sections = song.gen ? [generate(song)] : (cur.intro ? compiled[id].intro : compiled[id].loop);
}

function section() { return cur.sections[cur.secIdx]; }

function advance() {
  cur.step++;
  const sec = section();
  if (cur.step % sec.per === 0) cur.barsPlayed++;
  if (cur.step < sec.steps.length) return;
  cur.step = 0;
  cur.secIdx++;
  if (cur.secIdx < cur.sections.length) return;
  cur.secIdx = 0;
  if (cur.song.gen) { cur.sections = [generate(cur.song)]; return; }
  if (cur.intro) { cur.intro = false; cur.sections = compiled[cur.id].loop; return; }
  cur.pass++;
}

function tempo() {
  const s = cur.song;
  let mult = 1;
  if (s.accel && cur.mode === "full" && snap && snap.phase === "playing") mult = Math.min(s.accel.max, 1 + s.accel.perBar * cur.barsPlayed);
  if (snap && snap.phase === "playing" && snap.endsAt && !snap.paused && snap.endsAt - clock() < HYPE_MS) mult *= HYPE;
  return s.bpm * mult;
}

function scheduleStep(t) {
  const s = cur.song, sec = section();
  const per = sec.per, i = cur.step % per, bar = sec.bars[Math.floor(cur.step / per)] || sec.bars[0];
  const stepDur = 60 / tempo() / s.div;
  const groove = cur.mode === "groove";
  const volume = (s.volume || 1);
  // Lead: the tune (silent in groove mode). Passes vary: plain, then an echo, then up an octave.
  if (!groove) {
    const ev = sec.lead.find((e) => e.step === cur.step);
    if (ev) {
      const v = s.gen ? 0 : cur.pass % 3;
      const lift = v === 2 ? (ev.midi <= 79 ? 12 : 0) : 0;
      const type = s.lead || "pulse25";
      tone(type, ev.midi + lift, t, ev.len * stepDur * 0.92, GAIN[type] * volume);
      if (v === 1) tone(type, ev.midi - 12, t + stepDur, ev.len * stepDur * 0.8, GAIN[type] * 0.35 * volume);
    }
  }
  for (const [m, len] of bassAt(sec.bass || s.bass, s, sec, bar, i)) tone("tri", m, t, len * stepDur, GAIN.bass * volume);
  for (const [m, len] of arpAt(sec.arp || s.arp, s, sec, bar, i)) tone("pulse12", m, t, len * stepDur, GAIN.arp * volume * (groove ? 1.4 : 1));
  for (const [k, v] of drumHits(sec.drums || s.drums, sec.beats || s.beats, sec.div || s.div, i)) drum(k, t, v * volume * (groove ? 0.6 : 1));
  return stepDur;
}

function tick() {
  if (!ctx || !cur || cur.file) return;
  if (snap && snap.paused) { cur.next = ctx.currentTime + 0.05; return; }
  if (cur.next < ctx.currentTime) cur.next = ctx.currentTime + 0.02;
  while (cur.next < ctx.currentTime + LOOKAHEAD) {
    const d = scheduleStep(cur.next);
    cur.next += d;
    advance();
  }
}

function fadeTo(level, secs) {
  const now = ctx.currentTime;
  out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(out.gain.value, now);
  out.gain.linearRampToValueAtTime(level, now + secs);
}

function playFile(src) {
  fadeTo(0, 0.2);
  try {
    if (!fileEl) { fileEl = new Audio(src); fileEl.loop = true; fileEl.volume = 0.5; }
    fileEl.currentTime = 0;
    const p = fileEl.play(); if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
}
function stopFile() { if (fileEl) try { fileEl.pause(); } catch (e) { /* ignore */ } }

function apply() {
  if (!ctx || !enabled) return;
  const w = want;
  if (!w) { fadeTo(0, 0.3); cur = null; stopFile(); return; }
  const song = SONGS[w.song];
  const same = cur && cur.id === w.song;
  if (same && (cur.key === w.key || (song && song.continuous))) {
    cur.key = w.key; cur.mode = w.mode;
    if (!cur.file) fadeTo(LEVEL * (w.mode === "groove" ? 0.75 : 1), 0.4);
    return;
  }
  // A new song (or a restart): quick fade, then start just after it.
  const at = ctx.currentTime + (cur ? 0.3 : 0.05);
  if (cur) fadeTo(0, 0.25);
  const start = () => {
    if (want !== w) return;
    startSong(w.song, w.mode, ctx.currentTime + 0.02);
    if (cur) { cur.key = w.key; if (!cur.file) fadeTo(LEVEL * (w.mode === "groove" ? 0.75 : 1), 0.15); }
  };
  if (cur) { cur = { ...cur, file: true }; setTimeout(start, Math.max(0, (at - ctx.currentTime) * 1000)); } else start();
}

// --------------------------------------------------------------- API
export function attach(context, opts = {}) {
  if (!ctx) setup(context);
  if (opts.clock) clock = opts.clock;
}

export function setEnabled(on) {
  enabled = !!on && !!ctx;
  if (!ctx) return;
  if (enabled) {
    if (!timer) timer = setInterval(tick, TICK_MS);
    cur = null;
    apply();
  } else {
    if (timer) clearInterval(timer);
    timer = 0;
    fadeTo(0, 0.2);
    stopFile();
    cur = null;
  }
}

export function follow(s) {
  snap = s;
  const w = trackFor(s);
  const changed = !want || !w || w.song !== want.song || w.key !== want.key || w.mode !== want.mode;
  want = w;
  if (changed) apply();
}

// For rehearsal scripts: what is playing right now.
export const nowPlaying = () => (cur ? { song: cur.id, mode: cur.mode, pass: cur.pass || 0, bpm: cur.song ? Math.round(tempo()) : null } : null);
