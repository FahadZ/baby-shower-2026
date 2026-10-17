(function () {
  "use strict";

  var R = window.Raffle, Dex = R.Dex, Store = R.Store, Sound = R.Sound;
  var C = window.RAFFLE || {};
  var $ = function (sel) { return document.querySelector(sel); };

  var stage = $("#stage");
  var phase = "idle";    // idle → ball → ask → reveal
  var current = null;
  var isTest = false;
  var busy = false;
  var run = 0;           // bumps on every step so stale async callbacks bail out
  var clips = { whosThat: null, sting: null };

  function setPhase(p) {
    phase = p;
    stage.setAttribute("data-phase", p);
  }

  // Unbiased pick using the browser's crypto RNG.
  function pick(list) {
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      var limit = Math.floor(0x100000000 / list.length) * list.length;
      do { window.crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return list[buf[0] % list.length];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  function loadImage(img, src) {
    return new Promise(function (resolve) {
      img.onload = img.onerror = function () {
        if (img.decode) img.decode().then(resolve, resolve); else resolve();
      };
      img.src = src;
    });
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---------------------------------------------------------------
  //  Idle screen
  // ---------------------------------------------------------------
  function renderIdle(note) {
    var entries = Store.entries(), pool = Store.pool();
    var text;
    if (note) text = note;
    else if (!entries.length) text = "No stickers checked in yet.";
    else if (!pool.length) text = "Every sticker has been drawn!";
    else text = pool.length + (pool.length === 1 ? " sticker" : " stickers") + " in the draw";
    $("#poolText").textContent = text;

    var past = $("#past");
    past.textContent = "";
    Store.draws().filter(function (d) { return d.result === "won"; }).slice(-12).forEach(function (d) {
      var li = document.createElement("li");
      var img = document.createElement("img");
      img.src = Dex.art(d.n);
      img.alt = Dex.label(d.n);
      li.appendChild(img);
      var b = document.createElement("span");
      b.textContent = "#" + Dex.pad3(d.n);
      li.appendChild(b);
      past.appendChild(li);
    });

    // Warm the cache so the silhouette and cry are instant.
    pool.forEach(function (n) {
      new Image().src = Dex.art(n);
      Sound.load(Dex.cry(n));
    });
  }

  function toIdle(note) {
    run++;
    busy = false;
    Sound.stopAll();
    current = null;
    stage.classList.remove("is-test", "show-winner");
    setPhase("idle");
    renderIdle(note);
  }

  // ---------------------------------------------------------------
  //  The show
  // ---------------------------------------------------------------

  // The name in the show's lettering, one span per letter, each a little
  // off-kilter like the hand-drawn original.
  function setName(n) {
    var el = $("#monName");
    var name = Dex.name(n).toUpperCase();
    el.textContent = "";
    el.setAttribute("aria-label", Dex.name(n));
    el.style.setProperty("--len", Math.max(name.length, 6));
    for (var i = 0; i < name.length; i++) {
      var s = document.createElement("span");
      s.textContent = name[i];
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--rot", (Math.random() * 8 - 4).toFixed(1) + "deg");
      s.style.setProperty("--dy", (Math.random() * 8 - 4).toFixed(1) + "%");
      s.style.animationDelay = (0.035 * i).toFixed(3) + "s";
      el.appendChild(s);
    }
  }

  function setWinner(n, test) {
    var winner = $("#winner"), num = document.createElement("b");
    num.textContent = "#" + Dex.pad3(n);
    winner.textContent = test ? "Test run: " : "Sticker ";
    winner.appendChild(num);
    winner.appendChild(document.createTextNode(test ? " " + Dex.name(n) : " wins!"));
  }

  // Silhouette and full-colour art come from the same picture.
  function prepare(n) {
    var url = Dex.art(n), css = "url(\"" + url + "\")";
    ["#sil", "#silShadow"].forEach(function (sel) {
      var el = $(sel);
      el.style.webkitMaskImage = css;
      el.style.maskImage = css;
    });
    return loadImage($("#monImg"), url);
  }

  function playCry(n) {
    // An anime voice clip in assets/pokemon/voice/cry-NNN.mp3 wins over the game cry.
    return Sound.load(Dex.voice("cry-" + Dex.pad3(n) + ".mp3")).then(function (clip) {
      return clip ? Sound.playBuffer(clip) : Sound.playUrl(Dex.cry(n));
    });
  }

  function startDraw(test) {
    if (busy) return;
    var pool = test ? Dex.all() : Store.pool();
    if (!pool.length) {
      Sound.unlock();
      Sound.buzz();
      renderIdle(Store.entries().length ? "Every sticker has been drawn!" : "No stickers checked in yet. Open Check-in first.");
      restartAnim($("#poolText"), "nudge");
      return;
    }
    Sound.unlock();
    Sound.stopAll();
    var n = pick(pool);
    if (!test) Store.recordDraw(n, "won");
    current = n;
    isTest = test;
    busy = true;
    var my = ++run;

    // Leave the old Pokémon's screen first, so a redraw never shows the next one early.
    stage.classList.remove("show-winner");
    stage.classList.toggle("is-test", test);
    setPhase("ball");

    var ready = prepare(n);
    setName(n);
    setWinner(n, test);
    Sound.load(Dex.cry(n));
    Sound.load(Dex.voice("its-" + Dex.pad3(n) + ".mp3"));

    restartAnim($("#ball"), "go");
    Sound.whoosh();

    // The Poké Ball flies in, then a flash opens on the silhouette.
    Promise.all([Sound.wait(900), Promise.race([ready, Sound.wait(3000)])]).then(function () {
      if (my !== run) return;
      restartAnim($("#flash"), "go");
      setPhase("ask");
      announceWhosThat(my);
      setTimeout(function () { if (my === run) busy = false; }, 600);
    });
  }

  function announceWhosThat(my) {
    if (clips.whosThat) return Sound.playBuffer(clips.whosThat);
    var sting = Sound.jingle();
    return Sound.wait(700).then(function () {
      if (my !== run) return;
      return Sound.say(C.whosThatLine || "Who's that Pokémon?", { pitch: 1.2, rate: 1.0 });
    }).then(function () { return sting; });
  }

  function reveal() {
    if (phase !== "ask" || busy || current === null) return;
    busy = true;
    var my = ++run, n = current;
    Sound.stopAll();
    restartAnim($("#flash"), "go");
    setPhase("reveal");
    if (clips.sting) Sound.playBuffer(clips.sting, 0.6); else Sound.reveal();

    var showWinner = function () { if (my === run) stage.classList.add("show-winner"); };
    setTimeout(showWinner, 5000);

    Sound.wait(350)
      .then(function () { return my === run && sayIts(n, my); })
      .then(function () { return my === run && Sound.wait(100); })
      .then(function () { return my === run && playCry(n); })
      .then(showWinner);
    setTimeout(function () { if (my === run) busy = false; }, 900);
  }

  function sayIts(n, my) {
    return Sound.load(Dex.voice("its-" + Dex.pad3(n) + ".mp3")).then(function (clip) {
      if (my !== run) return;
      if (clip) return Sound.playBuffer(clip);
      var line = (C.itsLine || "It's {name}!").replace("{name}", Dex.spoken(n));
      return Sound.say(line, { pitch: 1.2, rate: 1.0 });
    });
  }

  function noShow() {
    if (phase !== "reveal" || isTest || current === null) return;
    var n = current;
    if (!confirm("Nobody has " + Dex.label(n) + "?\n\nMark it as a no-show and draw again.")) return;
    Store.recordDraw(n, "noshow");
    busy = false;
    startDraw(false);
  }

  // Bail out mid-show. If nobody has seen the answer yet, it goes back in the draw.
  function cancel() {
    if ((phase === "ball" || phase === "ask") && !isTest && current !== null) Store.undraw(current);
    toIdle();
  }

  function advance() {
    if (phase === "idle") startDraw(false);
    else if (phase === "ask") reveal();
    else if (phase === "reveal" && !busy) toIdle();
  }

  // ---------------------------------------------------------------
  //  Controls
  // ---------------------------------------------------------------
  function toggleFullscreen() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else if (el.requestFullscreen || el.webkitRequestFullscreen) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }

  var uiTimer = null;
  function pokeUi() {
    stage.classList.add("show-ui");
    clearTimeout(uiTimer);
    uiTimer = setTimeout(function () { stage.classList.remove("show-ui"); }, 2500);
  }

  function initControls() {
    $("#controls").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      b.blur();
      var act = b.getAttribute("data-act");
      if (act === "draw") startDraw(false);
      else if (act === "test") startDraw(true);
      else if (act === "reveal") reveal();
      else if (act === "done") toIdle();
      else if (act === "noshow") noShow();
    });

    // Tapping the scene moves the show along (but never starts a draw by accident).
    stage.addEventListener("click", function (e) {
      if (e.target.closest("button, a, .controls, .hud")) return;
      if (phase !== "idle") advance();
    });

    document.addEventListener("keydown", function (e) {
      if ($("#settings").open || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && (e.key === " " || e.key === "Enter")) return;
      var k = e.key;
      // Space/Enter, arrows and presentation clickers (PageDown) all advance.
      if (k === " " || k === "Enter" || k === "ArrowRight" || k === "PageDown") { e.preventDefault(); advance(); }
      else if (k === "t" || k === "T") { if (phase === "idle") startDraw(true); }
      else if (k === "r" || k === "R") { noShow(); }
      else if (k === "f" || k === "F") { toggleFullscreen(); }
      else if (k === "Escape" && phase !== "idle") { cancel(); }
      pokeUi();
    });

    stage.addEventListener("mousemove", pokeUi);
    $("#fsBtn").addEventListener("click", function (e) { e.currentTarget.blur(); toggleFullscreen(); });
  }

  // ---------------------------------------------------------------
  //  Sound settings
  // ---------------------------------------------------------------
  function fillVoices() {
    var sel = $("#voiceSelect");
    var list = Sound.voices();
    var chosen = Sound.chosenVoice();
    sel.textContent = "";
    if (!list.length) {
      var o = document.createElement("option");
      o.textContent = "Default voice";
      sel.appendChild(o);
      return;
    }
    list.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = v.name + " (" + v.lang + ")";
      if (chosen && v.voiceURI === chosen.voiceURI) o.selected = true;
      sel.appendChild(o);
    });
  }

  function initSettings() {
    var dlg = $("#settings");
    $("#settingsBtn").addEventListener("click", function (e) {
      e.currentTarget.blur();
      fillVoices();
      $("#voiceOn").checked = R.Settings.get().voiceOn;
      $("#clipNote").textContent = clips.whosThat
        ? "“Who's that Pokémon?” plays the original announcer clip."
        : "The announcer clip didn't load, so a synthesized sting and the computer voice stand in.";
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
    $("#voiceOn").addEventListener("change", function (e) { R.Settings.set({ voiceOn: e.target.checked }); });
    $("#voiceSelect").addEventListener("change", function (e) { R.Settings.set({ voiceURI: e.target.value }); });
    $("#voiceTest").addEventListener("click", function () {
      Sound.unlock();
      Sound.say((C.itsLine || "It's {name}!").replace("{name}", Dex.spoken(4)), { pitch: 1.2, rate: 1.0 })
        .then(function () { return playCry(4); });
    });
    Sound.onVoices(function () { if (dlg.open) fillVoices(); });
  }

  function init() {
    var shared = R.consumeShareLink();
    initControls();
    initSettings();
    renderIdle(shared ? "Added " + shared.added.length + " from the shared link · " + Store.pool().length + " in the draw" : null);
    Store.onChange(function () { if (phase === "idle") renderIdle(); });
    Sound.load(Dex.voice("whos-that-pokemon.mp3")).then(function (clip) { clips.whosThat = clip; });
    Sound.load(Dex.voice("reveal-sting.mp3")).then(function (clip) { clips.sting = clip; });
    pokeUi();
  }

  init();
})();
