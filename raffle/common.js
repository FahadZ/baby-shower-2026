// ============================================================
//  Shared by check-in and the draw screen: Pokédex helpers,
//  the saved entry list, and all sound (synth, clips, voice).
// ============================================================
(function () {
  "use strict";

  var C = window.RAFFLE || {};
  var DEX = window.POKEDEX || [];
  var SAY = window.POKEDEX_SAY || {};
  var MAX = DEX.length - 1;
  var KEY = "wtp-raffle-v1";
  var SETTINGS_KEY = "wtp-raffle-settings";
  var ASSETS = "../assets/pokemon/";
  // Sound URLs carry the build number, so a browser never reuses an old
  // copy (or an old "not found") after the site is updated.
  var buildMeta = document.querySelector('meta[name="build"]');
  var BUILD = "?v=" + (buildMeta ? buildMeta.content : "0");

  var missing = {};
  (C.missing || []).forEach(function (n) { missing[parseInt(n, 10)] = true; });

  function pad3(n) { return ("00" + n).slice(-3); }
  function label(n) { return "#" + pad3(n) + " " + DEX[n]; }

  var Dex = {
    max: MAX,
    pad3: pad3,
    label: label,
    name: function (n) { return DEX[n] || ""; },
    spoken: function (n) { return SAY[n] || DEX[n] || ""; },
    art: function (n) { return ASSETS + "art/" + pad3(n) + ".webp"; },
    cry: function (n) { return ASSETS + "cries/" + pad3(n) + ".mp3" + BUILD; },
    voice: function (file) { return ASSETS + "voice/" + file + BUILD; },
    isMissing: function (n) { return !!missing[n]; },
    inBook: function (n) { return n >= 1 && n <= MAX && !missing[n]; },
    all: function () {
      var out = [];
      for (var n = 1; n <= MAX; n++) if (!missing[n]) out.push(n);
      return out;
    },
    // Every 1–3 digit number in a block of text, e.g. "7, 025 and 151".
    parse: function (text) {
      return (String(text).match(/\d{1,3}/g) || []).map(function (s) { return parseInt(s, 10); });
    }
  };

  // ---------------------------------------------------------------
  //  Saved state: who's checked in and who's been drawn.
  //  { entries: [{ n, at }], draws: [{ n, at, result: "won" | "noshow" }] }
  // ---------------------------------------------------------------
  var persistent = true;
  var memory = null;

  function blank() { return { entries: [], draws: [] }; }

  function read() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { persistent = false; }
    if (!persistent) return memory || (memory = blank());
    try {
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.entries) && Array.isArray(d.draws)) return d;
    } catch (e) {}
    return blank();
  }

  function write(d) {
    memory = d;
    try { window.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { persistent = false; }
  }

  function find(list, n) {
    for (var i = 0; i < list.length; i++) if (list[i].n === n) return list[i];
    return null;
  }

  var Store = {
    persistent: function () { read(); return persistent; },
    entries: function () { return read().entries.slice(); },
    draws: function () { return read().draws.slice(); },
    has: function (n) { return !!find(read().entries, n); },
    drawOf: function (n) { return find(read().draws, n); },

    // Returns { ok: true } or { ok: false, reason: "range" | "missing" | "duplicate" }.
    add: function (n) {
      if (!(n >= 1 && n <= MAX)) return { ok: false, reason: "range" };
      if (missing[n]) return { ok: false, reason: "missing" };
      var d = read();
      if (find(d.entries, n)) return { ok: false, reason: "duplicate" };
      d.entries.push({ n: n, at: Date.now() });
      write(d);
      return { ok: true };
    },

    remove: function (n) {
      var d = read();
      d.entries = d.entries.filter(function (e) { return e.n !== n; });
      d.draws = d.draws.filter(function (e) { return e.n !== n; });
      write(d);
    },

    // Checked in and not drawn yet.
    pool: function () {
      var d = read();
      return d.entries
        .filter(function (e) { return !find(d.draws, e.n); })
        .map(function (e) { return e.n; });
    },

    recordDraw: function (n, result) {
      var d = read();
      d.draws = d.draws.filter(function (e) { return e.n !== n; });
      d.draws.push({ n: n, at: Date.now(), result: result || "won" });
      write(d);
    },

    // Put a drawn sticker back in the pool.
    undraw: function (n) {
      var d = read();
      d.draws = d.draws.filter(function (e) { return e.n !== n; });
      write(d);
    },

    importNumbers: function (nums) {
      var added = [], skipped = [];
      nums.forEach(function (n) {
        if (Store.add(n).ok) added.push(n); else skipped.push(n);
      });
      return { added: added, skipped: skipped };
    },

    reset: function () { write(blank()); },

    // Fires when another tab on this device changes the list.
    onChange: function (fn) {
      window.addEventListener("storage", function (e) { if (e.key === KEY) fn(); });
    }
  };

  // ---------------------------------------------------------------
  //  Per-device settings
  // ---------------------------------------------------------------
  var Settings = {
    get: function () {
      var s = {};
      try { s = JSON.parse(window.localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) {}
      if (s.voiceOn === undefined) s.voiceOn = true;
      if (s.cryOnCheckin === undefined) s.cryOnCheckin = true;
      return s;
    },
    set: function (patch) {
      var s = Settings.get();
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
      return s;
    }
  };

  // ---------------------------------------------------------------
  //  Sharing the list between devices: draw.html#add=1.25.95
  // ---------------------------------------------------------------
  function shareUrl(page) {
    var nums = Store.entries().map(function (e) { return e.n; });
    return new URL(page + "#add=" + nums.join("."), location.href).href;
  }

  // If the page was opened from a share link, offer to merge it in.
  function consumeShareLink() {
    var m = /[#&]add=([\d.,]*)/.exec(location.hash);
    if (!m) return null;
    history.replaceState(null, "", location.pathname + location.search);
    var nums = Dex.parse(m[1]).filter(function (n, i, all) { return Dex.inBook(n) && all.indexOf(n) === i; });
    var fresh = nums.filter(function (n) { return !Store.has(n); });
    if (!fresh.length) return { added: [], skipped: nums };
    var preview = fresh.slice(0, 12).map(label).join("\n") + (fresh.length > 12 ? "\n…" : "");
    if (!window.confirm("Add " + fresh.length + " sticker" + (fresh.length === 1 ? "" : "s") +
      " from the shared link?\n\n" + preview)) return null;
    return Store.importNumbers(nums);
  }

  // ---------------------------------------------------------------
  //  Sound. Web Audio for synth + clips (reliable timing, and one
  //  unlock covers iOS), with an <audio> fallback for file:// pages.
  // ---------------------------------------------------------------
  var Sound = (function () {
    var ctx = null, master = null, noiseBuf = null;
    var buffers = {};
    var live = [];
    var fallbackEl = null;
    var keepUtterances = [];
    var unlocked = false;

    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        var comp = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state === "suspended") {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return ctx;
    }

    function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    function track(node, end) {
      live.push(node);
      node.onended = function () { live = live.filter(function (x) { return x !== node; }); };
      node.start(end[0]);
      node.stop(end[1]);
    }

    function env(g, t0, peak, attack, hold, release) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
      g.gain.setValueAtTime(peak, t0 + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
      return t0 + attack + hold + release;
    }

    function tone(type, midi, t0, dur, vol, glideTo) {
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(hz(midi), t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(hz(glideTo), t0 + dur);
      var end = env(g, t0, vol, 0.005, Math.max(0, dur - 0.06), 0.06);
      o.connect(g); g.connect(master);
      track(o, [t0, end + 0.02]);
    }

    // Detuned saws through a closing low-pass: a cheap brass section.
    function brass(notes, t0, dur, vol) {
      var c = ac(); if (!c) return;
      var f = c.createBiquadFilter(), g = c.createGain();
      f.type = "lowpass";
      f.Q.value = 2;
      f.frequency.setValueAtTime(600, t0);
      f.frequency.exponentialRampToValueAtTime(4200, t0 + 0.04);
      f.frequency.exponentialRampToValueAtTime(900, t0 + dur);
      var end = env(g, t0, vol, 0.02, dur * 0.5, dur * 0.5);
      f.connect(g); g.connect(master);
      notes.forEach(function (m) {
        [-7, 7].forEach(function (cents) {
          var o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = hz(m);
          o.detune.value = cents;
          o.connect(f);
          track(o, [t0, end + 0.02]);
        });
      });
    }

    function noise(t0, dur, vol, type, from, to, attack) {
      var c = ac(); if (!c) return;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        var ch = noiseBuf.getChannelData(0);
        for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf;
      s.loop = true;
      f.type = type;
      f.frequency.setValueAtTime(from, t0);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      var end = env(g, t0, vol, attack || 0.01, 0, Math.max(0.05, dur - (attack || 0.01)));
      s.connect(f); f.connect(g); g.connect(master);
      track(s, [t0, end + 0.02]);
    }

    function boom(t0, vol) {
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(48, t0 + 0.45);
      var end = env(g, t0, vol, 0.004, 0.02, 0.5);
      o.connect(g); g.connect(master);
      track(o, [t0, end + 0.02]);
      noise(t0, 0.12, vol * 0.4, "lowpass", 900);
    }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // Fetch + decode a sound file. Resolves to null if it doesn't exist.
    function loadBuffer(url) {
      if (!buffers[url]) {
        buffers[url] = fetch(url)
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (data) {
            var c = ac();
            if (!c) throw new Error("no audio");
            return new Promise(function (resolve, reject) { c.decodeAudioData(data, resolve, reject); });
          })
          .catch(function () { delete buffers[url]; return null; });
      }
      return buffers[url];
    }

    function playBuffer(buf, gain) {
      return new Promise(function (resolve) {
        var c = ac();
        if (!c || !buf) return resolve();
        var s = c.createBufferSource(), g = c.createGain();
        s.buffer = buf;
        g.gain.value = gain || 1;
        s.connect(g); g.connect(master);
        live.push(s);
        s.onended = function () { live = live.filter(function (x) { return x !== s; }); resolve(); };
        s.start();
      });
    }

    // <audio> fallback (file:// can't fetch). Reuses one element so a
    // single unlock on iOS keeps working for later plays.
    function playElement(url) {
      return new Promise(function (resolve) {
        fallbackEl = fallbackEl || new Audio();
        var el = fallbackEl, done = false;
        function fin() { if (!done) { done = true; clearTimeout(timer); resolve(); } }
        var timer = setTimeout(fin, 6000);
        el.onended = fin;
        el.onerror = fin;
        el.src = url;
        var p = el.play();
        if (p && p.catch) p.catch(fin);
      });
    }

    // Plays a known file (e.g. a cry). Falls back to <audio> if fetch fails.
    function playUrl(url) {
      return loadBuffer(url).then(function (buf) {
        return buf ? playBuffer(buf) : playElement(url);
      });
    }

    // ---- Voice (text-to-speech) ----
    var synth = window.speechSynthesis;
    var PREFERRED = [
      "Google US English", "Samantha", "Alex", "Aaron", "Microsoft Guy Online",
      "Microsoft Aria Online", "Microsoft Jenny Online", "Microsoft David", "Microsoft Zira",
      "Daniel", "Karen", "Google UK English Male"
    ];

    function voices() {
      if (!synth) return [];
      return synth.getVoices().filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    }

    function chosenVoice() {
      var list = voices();
      if (!list.length) return null;
      var want = Settings.get().voiceURI;
      for (var i = 0; i < list.length; i++) if (list[i].voiceURI === want) return list[i];
      for (var p = 0; p < PREFERRED.length; p++) {
        for (var j = 0; j < list.length; j++) {
          if (list[j].name.indexOf(PREFERRED[p]) === 0) return list[j];
        }
      }
      var us = list.filter(function (v) { return /en[-_]US/i.test(v.lang); });
      return (us[0] || list[0]);
    }

    function say(text, opts) {
      opts = opts || {};
      return new Promise(function (resolve) {
        if (!synth || !window.SpeechSynthesisUtterance || !Settings.get().voiceOn) return resolve();
        var u = new SpeechSynthesisUtterance(text);
        var v = chosenVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
        u.rate = opts.rate || 1.02;
        u.pitch = opts.pitch || 1.15;
        u.volume = 1;
        var done = false;
        function fin() { if (!done) { done = true; clearTimeout(timer); resolve(); } }
        // Chrome sometimes never fires onend, so cap the wait.
        var timer = setTimeout(fin, 1200 + text.length * 90);
        u.onend = fin;
        u.onerror = fin;
        keepUtterances.push(u);
        if (keepUtterances.length > 8) keepUtterances.shift();
        if (synth.speaking || synth.pending) synth.cancel();
        synth.speak(u);
      });
    }

    return {
      // Call from a tap/keypress before the first sound (needed on iOS).
      unlock: function () {
        ac();
        if (unlocked) return;
        unlocked = true;
        if (synth && window.SpeechSynthesisUtterance) {
          var u = new SpeechSynthesisUtterance(" ");
          u.volume = 0;
          synth.speak(u);
        }
        fallbackEl = fallbackEl || new Audio();
        fallbackEl.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        var p = fallbackEl.play();
        if (p && p.catch) p.catch(function () {});
      },

      stopAll: function () {
        live.forEach(function (n) { try { n.stop(); } catch (e) {} });
        live = [];
        if (synth && (synth.speaking || synth.pending)) synth.cancel();
        if (fallbackEl) { try { fallbackEl.pause(); } catch (e) {} }
      },

      load: loadBuffer,
      playUrl: playUrl,
      playElement: playElement,
      playBuffer: playBuffer,
      say: say,
      voices: voices,
      chosenVoice: chosenVoice,
      onVoices: function (fn) {
        if (!synth) return;
        if (synth.addEventListener) synth.addEventListener("voiceschanged", fn);
        else synth.onvoiceschanged = fn;
      },
      wait: wait,

      // Original sting for the "Who's that Pokémon?" card: a run up into
      // two brass hits with timpani and a cymbal swell (~2.3 s).
      jingle: function () {
        var c = ac(); if (!c) return wait(0);
        var t = c.currentTime + 0.03;
        [62, 66, 69, 74, 78, 81].forEach(function (m, i) { tone("square", m, t + i * 0.055, 0.1, 0.07); });
        brass([58, 65, 70, 74], t + 0.38, 0.18, 0.16);
        boom(t + 0.38, 0.55);
        brass([60, 67, 72, 76], t + 0.6, 1.7, 0.18);
        boom(t + 0.6, 0.7);
        noise(t + 0.6, 1.8, 0.09, "highpass", 6500, null, 0.25);
        [84, 88, 91, 96, 100].forEach(function (m, i) { tone("triangle", m, t + 0.62 + i * 0.045, 0.22, 0.05); });
        return wait(2300);
      },

      // Bright hit for the reveal flash.
      reveal: function () {
        var c = ac(); if (!c) return;
        var t = c.currentTime + 0.02;
        noise(t, 0.3, 0.12, "bandpass", 800, 6000);
        brass([67, 71, 74, 79], t + 0.05, 1.1, 0.17);
        boom(t + 0.05, 0.55);
        [91, 95, 98, 103].forEach(function (m, i) { tone("triangle", m, t + 0.08 + i * 0.05, 0.3, 0.05); });
      },

      // Poké Ball wipe.
      whoosh: function () {
        var c = ac(); if (!c) return;
        noise(c.currentTime + 0.01, 0.5, 0.6, "bandpass", 300, 3200, 0.2);
      },

      blip: function () {
        var c = ac(); if (!c) return;
        var t = c.currentTime + 0.01;
        tone("square", 83, t, 0.07, 0.08);
        tone("square", 88, t + 0.07, 0.14, 0.08);
      },

      buzz: function () {
        var c = ac(); if (!c) return;
        var t = c.currentTime + 0.01;
        tone("square", 41, t, 0.12, 0.1);
        tone("square", 41, t + 0.16, 0.2, 0.1);
      }
    };
  })();

  window.Raffle = {
    Dex: Dex,
    Store: Store,
    Settings: Settings,
    Sound: Sound,
    shareUrl: shareUrl,
    consumeShareLink: consumeShareLink
  };
})();
