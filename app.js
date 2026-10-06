(function () {
  "use strict";

  var P = window.PARTY || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var START = new Date(P.start);
  var END = new Date(P.end);
  var DEADLINE = new Date(P.rsvpDeadline);

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  function fmt(date, opts) {
    return new Intl.DateTimeFormat("en-CA", Object.assign({ timeZone: P.timeZone }, opts)).format(date);
  }

  // ---------------------------------------------------------------
  //  Bind config → page
  // ---------------------------------------------------------------
  function bindDetails() {
    $("#dDate").textContent = fmt(START, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase().replace(/\./g, "");
    $("#dTime").textContent = fmt(START, { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase().replace(/\./g, "");
    var parts = P.address.split(",");
    var addrEl = $("#dAddr");
    addrEl.textContent = "";
    addrEl.appendChild(document.createTextNode(parts[0].trim().toUpperCase()));
    addrEl.appendChild(document.createElement("br"));
    addrEl.appendChild(document.createTextNode(parts.slice(1).join(",").trim().toUpperCase()));
    $("#dMap").href = mapUrl();
    $("#dHosts").textContent = P.hosts.join(" & ").toUpperCase();
    $("#closedHosts").textContent = P.hostsShort.toUpperCase();
    var dl = fmt(DEADLINE, { weekday: "short", month: "short", day: "numeric" }).replace(/\./g, "");
    $("#dDeadline").textContent = dl.toUpperCase();
    $("#closedDate").textContent = fmt(DEADLINE, { month: "long", day: "numeric" }).toUpperCase();

    if (P.registryUrl) {
      $$("[data-registry-link]").forEach(function (a) { a.href = P.registryUrl; });
    } else {
      $$("[data-registry]").forEach(function (el) { el.hidden = true; el.style.display = "none"; });
    }

    $("#gcalLink").href = gcalUrl();
    $("#mapLink").href = mapUrl();
  }

  function mapUrl() {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(P.address);
  }

  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function eventText() {
    return "Baby shower for " + P.hostsShort + " — Player 3 has entered the game! " +
      "Optional side quest: come dressed as any character you love. " + P.siteUrl;
  }

  function gcalUrl() {
    var q = new URLSearchParams({
      action: "TEMPLATE",
      text: "Baby Loading.. — " + P.hostsShort + "'s Baby Shower",
      dates: icsDate(START) + "/" + icsDate(END),
      details: eventText(),
      location: P.address,
      ctz: P.timeZone
    });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }

  function downloadIcs() {
    var esc = function (s) { return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); };
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baby Loading//RSVP//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:baby-shower-2026@fahadz.github.io",
      "DTSTAMP:" + icsDate(new Date()),
      "DTSTART:" + icsDate(START),
      "DTEND:" + icsDate(END),
      "SUMMARY:" + esc("Baby Loading.. — " + P.hostsShort + "'s Baby Shower"),
      "DESCRIPTION:" + esc(eventText()),
      "LOCATION:" + esc(P.address),
      "URL:" + P.siteUrl,
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Level 17 starts tomorrow!", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "baby-shower-oct-17-2026.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    sfx("coin");
  }

  function share() {
    var data = { title: "Baby Loading..", text: "Player 3 has entered the game! Baby shower on Oct 17 — RSVP here:", url: P.siteUrl };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(P.siteUrl).then(function () {
        announce("Link copied to clipboard!");
        var b = $("#shareBtn"); var old = b.textContent;
        b.textContent = "✔ LINK COPIED"; setTimeout(function () { b.textContent = old; }, 2000);
      });
    } else {
      window.prompt("Copy this link:", P.siteUrl);
    }
  }

  // ---------------------------------------------------------------
  //  Sound (Web Audio, off by default)
  // ---------------------------------------------------------------
  var soundOn = false, ctx = null;
  var SFX = {
    blip: [[660, 0.05]],
    select: [[523, 0.06], [784, 0.08]],
    back: [[392, 0.06], [262, 0.08]],
    coin: [[988, 0.07], [1319, 0.25]],
    start: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.2]],
    jump: [[440, 0.04], [660, 0.04], [880, 0.06]],
    inhale: [[1046, 0.06], [880, 0.06], [740, 0.06], [622, 0.06], [523, 0.06], [440, 0.06], [370, 0.08]],
    swallow: [[196, 0.07], [392, 0.07], [784, 0.12]],
    spit: [[784, 0.04], [1175, 0.1]],
    win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [784, 0.08], [1047, 0.3]],
    over: [[392, 0.18], [370, 0.18], [349, 0.18], [330, 0.4]],
    error: [[196, 0.12], [147, 0.2]]
  };
  function sfx(name) {
    if (!soundOn) return;
    try {
      audio();
      var t = ctx.currentTime;
      SFX[name].forEach(function (n) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + n[1]);
        t += n[1];
      });
    } catch (e) { /* audio unsupported */ }
  }
  function audio() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Theme song: an original 8-bar chiptune loop, pre-rendered to a file so it
  // plays through <audio> (which iPhones don't mute with the silent switch).
  var bgm = null;
  function startMusic() {
    try {
      // Safari 16.4+: treat page audio like media so the silent switch doesn't mute it.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      if (!bgm) {
        bgm = new Audio("assets/audio/theme.wav");
        bgm.loop = true;
        bgm.volume = 0.6;
      }
      var p = bgm.play();
      if (p && p.catch) p.catch(function () { setSound(false); });
    } catch (e) { /* audio unsupported */ }
  }
  function stopMusic() { if (bgm) bgm.pause(); }
  document.addEventListener("visibilitychange", function () {
    if (!soundOn || !bgm) return;
    if (document.hidden) stopMusic(); else startMusic();
  });

  function setSound(on) {
    soundOn = on;
    var btn = $("#soundToggle");
    btn.setAttribute("aria-pressed", String(on));
    $("#soundState").textContent = on ? "ON" : "OFF";
  }

  function initSound() {
    setSound(false);
    $("#soundToggle").addEventListener("click", function () {
      setSound(!soundOn);
      store("music", soundOn ? "on" : "off");
      if (soundOn) { startMusic(); sfx("coin"); } else stopMusic();
    });

    // Ask once per visit (unless they said no before). Tapping YES is a real
    // tap, which is what phones require before any sound can play.
    var dlg = $("#soundPrompt");
    if (store("music") === "off") return;
    var close = function (on) {
      dlg.hidden = true;
      document.removeEventListener("keydown", onKey);
      store("music", on ? "on" : "off");
      if (on) { setSound(true); startMusic(); sfx("coin"); }
      $("#main").focus({ preventScroll: true });
    };
    var onKey = function (e) { if (e.key === "Escape") close(false); };
    $("#soundYes").addEventListener("click", function () { close(true); });
    $("#soundNo").addEventListener("click", function () { close(false); });
    setTimeout(function () {
      dlg.hidden = false;
      document.addEventListener("keydown", onKey);
      $("#soundYes").focus();
    }, 700);
  }

  // ---------------------------------------------------------------
  //  Screens
  // ---------------------------------------------------------------
  var current = "title";
  function go(name, opts) {
    opts = opts || {};
    var next = $('[data-screen="' + name + '"]');
    if (!next) return;
    $$(".screen").forEach(function (s) {
      var on = s === next;
      s.hidden = !on;
      s.classList.toggle("is-active", on);
      s.classList.remove("is-entering");
    });
    if (!reduceMotion) { void next.offsetWidth; next.classList.add("is-entering"); }
    current = name;
    $(".frame").setAttribute("data-screen", name);
    hideBubble();
    window.scrollTo(0, 0);
    if (!opts.silent) {
      var heading = next.querySelector("h1, h2");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    }
    if (name === "title") startLoadbar();
  }

  function isClosed() { return Date.now() > DEADLINE.getTime(); }

  function initNav() {
    $$("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = b.getAttribute("data-go");
        if (target === "mode" && isClosed()) { sfx("error"); go("closed"); return; }
        sfx(b.classList.contains("btn-back") ? "back" : "start");
        go(target);
      });
    });
    $$("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        sfx("select");
        setMode(b.getAttribute("data-mode"));
        go("form");
        $("#fName").focus();
      });
    });
    // Arrow keys move between menu items like a real menu.
    $(".menu").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      var items = $$(".menu-item");
      var i = items.indexOf(document.activeElement);
      i = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i].focus(); sfx("blip"); e.preventDefault();
    });
    // Enter/space anywhere on the title screen = PRESS START
    document.addEventListener("keydown", function (e) {
      if (current !== "title" || e.key !== "Enter") return;
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/^(A|BUTTON|INPUT|TEXTAREA|SUMMARY)$/.test(tag)) return;
      $("#btnStart").click();
    });
    $("#icsBtn").addEventListener("click", downloadIcs);
    $("#shareBtn").addEventListener("click", share);
  }

  // ---------------------------------------------------------------
  //  Loading bar + countdown
  // ---------------------------------------------------------------
  var loadTimer = null;
  function startLoadbar() {
    var fill = $("#loadbarFill"), bar = $("#loadbar"), label = $("#loadbarLabel");
    // "Loading" progress = how close we are to the party, within the last 30 days, floored at 60%.
    var span = 30 * 864e5;
    var target = Math.round(Math.max(60, Math.min(99, 100 - ((START - Date.now()) / span) * 40)));
    if (Date.now() >= START.getTime()) target = 100;
    clearInterval(loadTimer);
    var set = function (p) {
      fill.style.width = p + "%";
      bar.setAttribute("aria-valuenow", String(p));
      label.textContent = p >= 100 ? "PLAYER 3 READY!" : "LOADING... " + p + "%";
    };
    if (reduceMotion) { set(target); return; }
    var p = 0; set(0);
    loadTimer = setInterval(function () {
      p = Math.min(target, p + 3);
      set(p);
      if (p >= target) clearInterval(loadTimer);
    }, 55);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tickCountdown() {
    var ms = START - Date.now();
    var el = $("#countdown");
    if (ms <= 0) {
      el.querySelector(".countdown-title").textContent = Date.now() < END ? "LEVEL 17: IN PROGRESS!" : "LEVEL 17: CLEARED!";
      ["#cdD", "#cdH", "#cdM", "#cdS"].forEach(function (s) { $(s).textContent = "00"; });
      return;
    }
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    $("#cdD").textContent = pad(d); $("#cdH").textContent = pad(h); $("#cdM").textContent = pad(m); $("#cdS").textContent = pad(sec);
    $("#countdownText").textContent = d + " days, " + h + " hours and " + m + " minutes until the party.";
  }

  // ---------------------------------------------------------------
  //  Falling tetromino blocks (decorative)
  // ---------------------------------------------------------------
  function initFalling() {
    if (reduceMotion) return;
    var box = $("#falling");
    var blocks = ["block-t", "block-l", "block-s"];
    function spawn() {
      if (document.hidden) return;
      var img = document.createElement("img");
      img.src = "assets/deco/" + blocks[Math.floor(Math.random() * blocks.length)] + ".png";
      img.alt = "";
      img.style.left = Math.round(Math.random() * 92) + "%";
      var dur = 14 + Math.random() * 10;
      img.style.animationDuration = dur + "s";
      img.style.setProperty("--rot", (Math.floor(Math.random() * 4) * 90) + "deg");
      box.appendChild(img);
      setTimeout(function () { img.remove(); }, dur * 1000 + 200);
    }
    spawn();
    setInterval(spawn, 4200);
  }

  // ---------------------------------------------------------------
  //  RSVP form
  // ---------------------------------------------------------------
  var mode = "yes";

  function buildOptions(wrap, name, from, to, labelFor) {
    for (var i = from; i <= to; i++) {
      var label = document.createElement("label");
      label.className = "player-option";
      label.innerHTML = '<input type="radio" name="' + name + '" value="' + i + '"' + (i === from ? " checked" : "") + ">" +
        "<span><b>" + (i === to && name === "kids" ? i + "+" : i) + "</b>" + labelFor(i) + "</span>";
      wrap.appendChild(label);
    }
    wrap.addEventListener("change", function () { sfx("blip"); });
  }

  function buildPlayerOptions() {
    var n = P.maxPlayers || 5;
    buildOptions($("#playerOptions"), "guests", 1, n, function (i) { return i === 1 ? "PLAYER" : "PLAYERS"; });
    buildOptions($("#kidOptions"), "kids", 0, n, function (i) { return i === 0 ? "NO KIDS" : (i === 1 ? "KID" : "KIDS"); });
  }

  function setMode(m) {
    mode = m;
    $("#fAttending").value = m;
    var yes = m === "yes";
    $$("[data-yes-only]").forEach(function (el) { el.hidden = !yes; });
    $("#formTitle").textContent = yes ? "PLAYER SELECT" : "LEAVE A MESSAGE";
    $("#formSub").textContent = yes
      ? "QUICK SAVE. TAKES 20 SECONDS."
      : "WE'LL MISS YOU! TELL US WHO YOU ARE AND LEAVE A NOTE IF YOU LIKE.";
    $("#btnSaveText").textContent = yes ? "SAVE GAME" : "SEND & QUIT";
    $("#lMessage").firstChild.nodeValue = yes ? "MESSAGE FOR " + P.hostsShort.toUpperCase() + " " : "A NOTE FOR THE HIGH SCORE BOARD ";
    setStatus("");
  }

  function setError(input, msg) {
    var err = $("#" + input.getAttribute("aria-describedby").split(" ").pop());
    err.textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  function setStatus(msg, kind) {
    var el = $("#formStatus");
    el.className = "form-status" + (kind ? " is-" + kind : "");
    if (kind === "saving") {
      el.innerHTML = "SAVING… <span class='saving-bar' aria-hidden='true'><i></i></span>";
    } else {
      el.textContent = msg;
    }
  }

  function validate() {
    var ok = true;
    var name = $("#fName"), email = $("#fEmail");
    if (!name.value.trim()) { setError(name, "Every hero needs a name! Please enter yours."); ok = false; }
    else setError(name, "");
    var ev = email.value.trim();
    if (!ev) { setError(email, "We need an email to save your game."); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { setError(email, "Hmm, that email looks glitched. Try again?"); ok = false; }
    else setError(email, "");
    if (!ok) {
      sfx("error");
      var first = $('[aria-invalid="true"]');
      if (first) first.focus();
    }
    return ok;
  }

  function initForm() {
    buildPlayerOptions();
    var saved = store("rsvp");
    if (saved) {
      try {
        var s = JSON.parse(saved);
        if (s.name) $("#fName").value = s.name;
        if (s.email) $("#fEmail").value = s.email;
      } catch (e) {}
    }

    ["#fName", "#fEmail"].forEach(function (id) {
      $(id).addEventListener("input", function () { if (this.getAttribute("aria-invalid")) setError(this, ""); });
    });

    $("#rsvpForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (isClosed()) { go("closed"); return; }
      if (!validate()) return;

      var f = e.target;
      var payload = {
        name: f.name.value.trim(),
        email: f.email.value.trim().toLowerCase(),
        attending: mode,
        guests: mode === "yes" ? Number((f.querySelector('input[name="guests"]:checked') || {}).value || 1) : 0,
        kids: mode === "yes" ? Number((f.querySelector('input[name="kids"]:checked') || {}).value || 0) : 0,
        message: f.message.value.trim(),
        website: f.website.value
      };

      if (!P.rsvpEndpoint) {
        sfx("error");
        setStatus("The save point isn't connected yet. Please let " + P.hostsShort + " know directly, then try again later!", "error");
        return;
      }

      var btn = $("#btnSave");
      btn.disabled = true;
      setStatus("", "saving");

      fetch(P.rsvpEndpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || "Unknown error");
          store("rsvp", JSON.stringify({ name: payload.name, email: payload.email }));
          setStatus("");
          f.message.value = "";
          if (mode === "yes") {
            var n = payload.guests;
            $("#thanksSub").textContent = (res.updated ? "Save file updated" : "Save file created") +
              " for " + payload.name.split(" ")[0] + " — party of " + n + (n === 1 ? " player" : " players") +
              (payload.kids ? " + " + payload.kids + (payload.kids === 1 ? " kid" : " kids") : "") + ".";
            sfx("win");
            go("thanks");
          } else {
            sfx("over");
            go("gameover");
          }
        })
        .catch(function (err) {
          console.error(err);
          sfx("error");
          var msg = /closed/i.test(String(err && err.message)) ? "RSVPs are closed — please contact the hosts directly." :
            "Connection lost! Your RSVP didn't save. Check your signal and press SAVE again.";
          setStatus(msg, "error");
        })
        .then(function () { btn.disabled = false; });
    });
  }

  // ---------------------------------------------------------------
  //  Living sprites: tap/click/Enter to poke; random idle hops & glances
  // ---------------------------------------------------------------
  var LINES = {
    pikachu: ["Pika pika! ⚡", "Pika-boo! Baby incoming!", "Pi-ka-CHU-per excited!"],
    kirby: ["Poyo!", "*inhales the cake*", "Poyo poyo!"],
    sonic: ["Gotta go fast… to the party!", "Way past cool! 👍", "See ya Oct 17!"],
    peach: ["The party's in THIS castle!", "Tea and cake, anyone? 🍰", "Player 3 is royalty!"],
    mario: ["Let's-a go! 🍄", "Wahoo! Level 17!", "Here we go-o!"],
    pacman: ["Waka waka… snacks?", "I'm here for the food 🍕", "Waka waka waka!"],
    ghost: ["Boo! …I mean, congrats!", "Don't eat me, I RSVP'd!", "Boo-tiful baby!"],
    link: ["It's dangerous to go alone — bring a +1!", "Hyaaa!", "Found: 1 baby shower invite!"],
    cloud: ["Not interested… in missing this.", "Let's mosey. To the party.", "This save point is guarded."]
  };
  function spriteName(img) {
    var m = /sprites\/(\w+)\.png/.exec(img.getAttribute("src") || "");
    return m && LINES[m[1]] ? m[1] : null;
  }
  var bubble = null, bubbleTimer = null;
  function say(img, text, ms) {
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.className = "speech";
      bubble.setAttribute("aria-hidden", "true");
      document.body.appendChild(bubble);
    }
    bubble.textContent = text;
    var r = img.getBoundingClientRect();
    bubble.classList.add("is-on");
    var bw = bubble.offsetWidth;
    var left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
    bubble.style.left = (left + window.scrollX) + "px";
    bubble.style.top = (r.top + window.scrollY - bubble.offsetHeight - 10) + "px";
    announce(text);
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, ms || 2200);
  }
  function hideBubble() {
    if (!bubble) return;
    bubble.classList.remove("is-on");
    bubble.style.top = "0px";
  }
  function hop(img) {
    if (img.dataset.busy) return; // Kirby mid-inhale
    img.classList.remove("hop");
    void img.offsetWidth;
    img.classList.add("hop");
  }
  function poke(img) {
    var name = spriteName(img);
    var lines = LINES[name];
    var n = (Number(img.getAttribute("data-pokes")) || 0);
    img.setAttribute("data-pokes", String(n + 1));
    hop(img);
    var hint = $("#tapHint");
    if (hint) hint.classList.add("is-done");
    sfx(name === "pacman" ? "coin" : "jump");
    say(img, lines[n % lines.length]);
  }
  // Where every character and brick piece sits in the invite (invite pixels).
  var INV = {
    pikachu: [40, 530, 222, 208], kirby: [856, 425, 129, 111], link: [40, 829, 185, 253],
    cloud: [771, 735, 222, 351], sonic: [275, 1054, 125, 190], peach: [430, 1045, 122, 209],
    mario: [570, 1073, 95, 173], pacman: [683, 1053, 81, 87], ghost: [698, 1156, 58, 63],
    mushroom: [960, 1028, 38, 56]
  };
  var NAMES = { pikachu: "Pikachu", kirby: "Kirby", link: "Link", cloud: "Cloud", sonic: "Sonic",
    peach: "Princess Peach", mario: "Mario", pacman: "Pac-Man", ghost: "Inky the ghost", mushroom: "A mushroom" };
  var FRAMES = { stage: [30, 1085, 966, 196], "ledge-left": [30, 735, 205, 97], "ledge-right": [826, 537, 170, 196] };
  var FLOOR_Y = 1246;

  function place(img, name, frame, at) {
    var f = FRAMES[frame], p = at || INV[name];
    img.style.left = ((p[0] - f[0]) / f[2] * 100) + "%";
    img.style.top = ((p[1] - f[1]) / f[3] * 100) + "%";
    img.style.width = (p[2] / f[2] * 100) + "%";
  }

  function buildScenes() {
    $$(".ledge").forEach(function (ledge) {
      var frame = ledge.classList.contains("ledge-left") ? "ledge-left" : "ledge-right";
      $$(".sprite[data-at]", ledge).forEach(function (img) { place(img, img.getAttribute("data-at"), frame); });
    });
    $$(".stage").forEach(function (stage) {
      var cast = stage.getAttribute("data-cast").split(/\s+/);
      var chase = stage.classList.contains("is-chase");
      var art = document.createElement("div");
      art.className = "stage-art";
      art.innerHTML = '<img class="stage-bg" src="assets/scene/stage.png" alt="" width="966" height="196">';
      var tallest = 0;
      cast.forEach(function (name) {
        var p = INV[name].slice();
        if (chase) { p[1] = FLOOR_Y - p[3]; p[0] = name === "ghost" ? 420 : 290; }
        var img = document.createElement("img");
        img.className = "sprite";
        img.src = "assets/sprites/" + name + ".png";
        img.alt = NAMES[name];
        img.width = INV[name][2]; img.height = INV[name][3];
        place(img, name, "stage", p);
        art.appendChild(img);
        tallest = Math.max(tallest, FRAMES.stage[1] - p[1]);
      });
      stage.style.paddingTop = "calc(" + (tallest - 70) + " * var(--s))";
      stage.appendChild(art);
      // Keep the floor going: bricks below the scene (the side-quest scroll sits on them).
      var floor = document.createElement("div");
      var quest = stage.nextElementSibling;
      if (quest && quest.classList.contains("quest")) {
        floor.className = "quest-floor";
        floor.appendChild(quest);
      } else {
        floor.className = "stage-floor";
      }
      stage.appendChild(floor);
    });
  }

  function initSprites() {
    buildScenes();
    $$(".sprite").forEach(function (img) {
      if (!spriteName(img)) return;
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", (img.getAttribute("alt") || "Character") + " — tap to say hi");
      img.addEventListener("click", function () { poke(img); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); poke(img); }
      });
      img.addEventListener("animationend", function (e) { if (e.animationName === "hop") img.classList.remove("hop"); });
    });
    if (reduceMotion) return;
    // Idle life: every few seconds a visible character hops or glances around.
    setInterval(function () {
      if (document.hidden) return;
      var visible = $$(".screen.is-active .sprite").filter(function (i) {
        var r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && spriteName(i) !== "pacman" && !i.dataset.busy;
      });
      if (!visible.length) return;
      var img = visible[Math.floor(Math.random() * visible.length)];
      if (Math.random() < 0.5) hop(img);
      else {
        img.classList.add("glance");
        setTimeout(function () { img.classList.remove("glance"); }, 900);
      }
    }, 2600);
  }

  // ---------------------------------------------------------------
  //  Kirby's copy ability, using real Kirby Super Star sprites: an enemy
  //  falls, Kirby inhales it, puffs up, becomes Fire / Sword / Ice Kirby,
  //  then spits the ability out as a star and turns back into himself.
  // ---------------------------------------------------------------
  var K = "assets/kirby/";
  var ABILITIES = [
    { name: "FIRE KIRBY!", enemy: [K + "leo-1.png", K + "leo-2.png"], enemyW: 32,
      frames: [K + "fire-1.png", K + "fire-2.png", K + "fire-3.png", K + "fire-4.png"], frameW: 24 },
    { name: "SWORD KIRBY!", enemy: [K + "blade-1.png"], enemyW: 35,
      frames: [K + "sword-1.png", K + "sword-2.png", K + "sword-3.png", K + "sword-4.png"], frameW: 31 },
    { name: "ICE KIRBY!", enemy: [K + "chilly-1.png", K + "chilly-2.png"], enemyW: 32,
      frames: [K + "ice-1.png", K + "ice-2.png", K + "ice-3.png", K + "ice-4.png"], frameW: 24 }
  ];
  // Preload so frame swaps never flash blank.
  ABILITIES.forEach(function (ab) { ab.enemy.concat(ab.frames).forEach(function (u) { new Image().src = u; }); });
  [K + "puffed-1.png", K + "spit-1.png"].forEach(function (u) { new Image().src = u; });

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function play(el, frames, opts) {
    var a = el.animate(frames, Object.assign({ fill: "forwards" }, opts));
    return a.finished.catch(function () {});
  }
  // Cycle an <img> through sprite frames; returns a stop() function.
  function flip(img, frames, ms) {
    if (frames.length < 2) return function () {};
    var i = 0, t = setInterval(function () { i = (i + 1) % frames.length; img.src = frames[i]; }, ms);
    return function () { clearInterval(t); };
  }

  function initKirby() {
    var kirby = $('.ledge-right .sprite[data-at="kirby"]');
    if (!kirby || reduceMotion || !kirby.animate) return;
    var ledge = kirby.parentNode;
    // Random first ability on each visit, then the rest in order.
    var next = Math.floor(Math.random() * ABILITIES.length);

    function pick() {
      var ab = ABILITIES[next];
      next = (next + 1) % ABILITIES.length;
      return ab;
    }

    function make(src, w, cls) {
      var img = document.createElement("img");
      img.src = src; img.alt = ""; img.className = "kirby-fx " + (cls || "");
      img.setAttribute("aria-hidden", "true");
      img.style.width = w + "px";
      ledge.appendChild(img);
      return img;
    }

    async function cycle() {
      var ab = pick();
      kirby.dataset.busy = "1";
      kirby.classList.remove("hop", "glance");
      var kw = kirby.offsetWidth, kh = kirby.offsetHeight;
      var kx = kirby.offsetLeft, ky = kirby.offsetTop;
      var mouthX = kx + kw * 0.5, mouthY = ky + kh * 0.55, feetY = ky + kh;
      // One SNES pixel, sized so the game's Kirby body matches the invite's Kirby.
      var px = kw * 0.92 / 22;

      // 1. An enemy falls from the sky, wobbling (and walking in mid-air).
      var iw = Math.round(ab.enemyW * px * 0.85);
      var item = make(ab.enemy[0], iw);
      var stopWalk = flip(item, ab.enemy, 220);
      item.style.left = (mouthX - iw / 2 - kw * 0.15) + "px";
      item.style.top = (ky - kh * 2.6) + "px";
      await play(item, [
        { transform: "translate(0,-40px) rotate(0deg)", opacity: 0 },
        { transform: "translate(6px,10px) rotate(12deg)", opacity: 1, offset: 0.25 },
        { transform: "translate(-6px,50px) rotate(-10deg)", offset: 0.6 },
        { transform: "translate(0," + Math.round(kh * 1.1) + "px) rotate(6deg)", opacity: 1 }
      ], { duration: 1800, easing: "linear" });

      // 2. Inhale: Kirby stretches wide, wind streaks rush in, the enemy gets pulled into his mouth.
      sfx("inhale");
      var streaks = [0, 1, 2].map(function (n) {
        var d = document.createElement("i");
        d.className = "kirby-wind";
        d.style.left = (mouthX - kw * 0.35 + n * kw * 0.35) + "px";
        d.style.top = (ky - kh * 0.6) + "px";
        d.style.height = (kh * 0.5) + "px";
        ledge.appendChild(d);
        d.animate([{ transform: "translateY(-10px)", opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: "translateY(" + kh * 0.5 + "px)", opacity: 0 }],
          { duration: 260, iterations: 3, delay: n * 80 });
        return d;
      });
      var inhale = play(kirby, [
        { transform: "scale(1,1)" }, { transform: "scale(1.22,.86) translateY(4%)", offset: 0.2 },
        { transform: "scale(1.18,.9) translateY(3%)", offset: 0.8 }, { transform: "scale(1.18,.9) translateY(3%)" }
      ], { duration: 900, easing: "steps(6)" });
      var ir = item.getBoundingClientRect(), lr = ledge.getBoundingClientRect();
      var dx = mouthX - (ir.left - lr.left + ir.width / 2), dy = mouthY - (ir.top - lr.top + ir.height / 2);
      item.getAnimations().forEach(function (a) { a.commitStyles && a.commitStyles(); a.cancel(); });
      var cur = getComputedStyle(item).transform; if (cur === "none") cur = "";
      await play(item, [
        { transform: cur + " translate(0,0) scale(1)", opacity: 1 },
        { transform: cur + " translate(" + dx + "px," + dy + "px) scale(.15) rotate(540deg)", opacity: 0.9 }
      ], { duration: 650, easing: "cubic-bezier(.6,0,1,1)" });
      stopWalk(); item.remove();
      await inhale;
      streaks.forEach(function (d) { d.remove(); });
      kirby.getAnimations().forEach(function (a) { a.cancel(); });

      // From here the game's own sprites stand in for Kirby, feet planted where his are.
      var body = make(K + "puffed-1.png", Math.round(32 * px), "kirby-body");
      function stand(w) {
        body.style.width = w + "px";
        body.style.left = (mouthX - w / 2) + "px";
        body.style.top = "auto";
        body.style.bottom = (ledge.offsetHeight - feetY) + "px";
      }
      stand(Math.round(32 * px));
      kirby.style.visibility = "hidden";

      // 3. Mouthful... gulp! Flash, and become the copy ability.
      sfx("swallow");
      await play(body, [
        { transform: "scale(1,1)" }, { transform: "scale(1.08,.92)", offset: 0.3 },
        { transform: "scale(.96,1.05)", offset: 0.6 }, { transform: "scale(1,1)" }
      ], { duration: 700, easing: "steps(4)" });
      await play(body, [{ filter: "brightness(1)" }, { filter: "brightness(3)" }, { filter: "brightness(1)" }], { duration: 300, easing: "steps(3)" });
      body.getAnimations().forEach(function (a) { a.cancel(); });
      body.src = ab.frames[0];
      stand(Math.round(ab.frameW * px));
      var stopIdle = flip(body, ab.frames, 140);
      var HOLD = 4500;
      say(body, ab.name, HOLD - 300);
      var bob = body.animate([{ transform: "translateY(0)" }, { transform: "translateY(-5%)" }], { duration: 560, iterations: Infinity, direction: "alternate", easing: "steps(2)" });
      await wait(HOLD);
      bob.cancel(); stopIdle();

      // 4. Release: squash, the ability pops out as a star, back to plain Kirby.
      await play(body, [{ transform: "scale(1,1)" }, { transform: "scale(1.15,.88)" }], { duration: 160, easing: "steps(2)" });
      sfx("spit");
      var puff = make(K + "spit-1.png", Math.round(16 * px), "kirby-puff");
      puff.style.left = (kx - 8 * px) + "px";
      puff.style.top = (mouthY - 8 * px) + "px";
      play(puff, [{ opacity: 1, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1.1)", offset: 0.5 }, { opacity: 0, transform: "scale(1.2)" }], { duration: 400, easing: "steps(4)" })
        .then(function () { puff.remove(); });
      body.remove();
      kirby.style.visibility = "";
      var star = make("assets/deco/sparkle.png", Math.round(kw * 0.45), "kirby-star");
      star.style.left = (kx - kw * 0.1) + "px";
      star.style.top = (mouthY - kw * 0.22) + "px";
      var flyX = -Math.max(240, ledge.closest(".frame").offsetWidth * 0.75);
      play(kirby, [{ transform: "scale(1.2,.85)" }, { transform: "scale(.92,1.08)", offset: 0.5 }, { transform: "scale(1,1)" }], { duration: 300, easing: "steps(3)" });
      await play(star, [
        { transform: "translate(0,0) rotate(0deg) scale(.6)", opacity: 1 },
        { transform: "translate(" + flyX * 0.5 + "px,-30px) rotate(360deg) scale(1)", opacity: 1, offset: 0.6 },
        { transform: "translate(" + flyX + "px,-10px) rotate(720deg) scale(.8)", opacity: 0 }
      ], { duration: 1100, easing: "linear" });
      star.remove();
      kirby.getAnimations().forEach(function (a) { a.cancel(); });
      delete kirby.dataset.busy;
    }

    async function loop() {
      await wait(1200);
      for (;;) {
        if (!document.hidden && current === "title") {
          try { await cycle(); } catch (e) { delete kirby.dataset.busy; kirby.style.visibility = ""; $$(".kirby-fx", ledge).forEach(function (n) { n.remove(); }); }
          await wait(1300 + Math.random() * 500);
        } else {
          await wait(1000);
        }
      }
    }
    loop();
  }

  function announce(msg) { $("#liveRegion").textContent = msg; }

  // Score ticks up a little — just for vibes.
  function initScore() {
    if (reduceMotion) return;
    var el = $("#score"), n = 30216202;
    setInterval(function () { n += 17; el.textContent = String(n); }, 1700);
  }

  // ---------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    bindDetails();
    initSound();
    initNav();
    initForm();
    initFalling();
    initScore();
    initSprites();
    initKirby();
    tickCountdown();
    setInterval(tickCountdown, 1000);
    if (isClosed()) {
      var start = $("#btnStart");
      start.querySelector("span:last-child").innerHTML = "RSVPS<br>CLOSED";
    }
    go("title", { silent: true });
  });
})();
