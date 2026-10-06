// 8-bit sound effects (square-wave synth, same recipes as the RSVP site) and
// the chiptune theme. Everything is silent until enable() runs from a tap.
const SFX = {
  blip: [[660, 0.05]],
  select: [[523, 0.06], [784, 0.08]],
  back: [[392, 0.06], [262, 0.08]],
  coin: [[988, 0.07], [1319, 0.25]],
  start: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.2]],
  jump: [[440, 0.04], [660, 0.04], [880, 0.06]],
  inhale: [[1046, 0.06], [880, 0.06], [740, 0.06], [622, 0.06], [523, 0.06], [440, 0.06], [370, 0.08]],
  swallow: [[196, 0.07], [392, 0.07], [784, 0.12]],
  spit: [[784, 0.04], [1175, 0.1]],
  thunder: [[98, 0.08], [1318, 0.04], [110, 0.08], [1568, 0.04], [87, 0.2]],
  charge: [[330, 0.06], [392, 0.06], [494, 0.06], [587, 0.06], [698, 0.08]],
  slash: [[1760, 0.03], [880, 0.06]],
  whoosh: [[988, 0.03], [740, 0.03], [554, 0.05]],
  spin: [[523, 0.05], [784, 0.05], [1046, 0.05], [784, 0.05], [1318, 0.1]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [784, 0.08], [1047, 0.3]],
  over: [[392, 0.18], [370, 0.18], [349, 0.18], [330, 0.4]],
  error: [[196, 0.12], [147, 0.2]],
  tick: [[1200, 0.03]],
  tock: [[800, 0.05]],
  buzzer: [[180, 0.25], [160, 0.3]],
  thunk: [[220, 0.05], [160, 0.08]],
  drum: [[90, 0.08], [0, 0.06], [90, 0.08], [0, 0.06], [90, 0.08]],
  fanfare: [[523, 0.12], [523, 0.12], [523, 0.12], [659, 0.3], [587, 0.12], [659, 0.4]],
  pop: [[880, 0.04], [1320, 0.05]],
  up: [[440, 0.06], [554, 0.06], [659, 0.1]],
  down: [[659, 0.06], [554, 0.06], [440, 0.12]]
};

let ctx = null, on = false, bgm = null, wantMusic = false;

function ac() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function sfx(name, vol = 0.06) {
  if (!on || !SFX[name]) return;
  try {
    const c = ac();
    let t = c.currentTime;
    SFX[name].forEach((n) => {
      if (n[0] > 0) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "square"; o.frequency.value = n[0];
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + n[1]);
      }
      t += n[1];
    });
  } catch (e) { /* audio unsupported */ }
}

export function music(play) {
  wantMusic = play;
  if (!on) return;
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
    if (!bgm) { bgm = new Audio("assets/audio/theme.wav"); bgm.loop = true; bgm.volume = 0.5; }
    if (play) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); } else bgm.pause();
  } catch (e) { /* ignore */ }
}

export function enable(flag = true) {
  on = flag;
  if (flag) { try { ac(); } catch (e) { /* ignore */ } }
  if (!flag && bgm) bgm.pause();
  if (flag && wantMusic) music(true);
}
export const isOn = () => on;

document.addEventListener("visibilitychange", () => {
  if (!bgm || !on || !wantMusic) return;
  if (document.hidden) bgm.pause(); else { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); }
});
