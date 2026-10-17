(function () {
  "use strict";

  var R = window.Raffle, Dex = R.Dex, Store = R.Store, Sound = R.Sound;
  var $ = function (sel) { return document.querySelector(sel); };

  var typed = "";
  var flashTimer = null;
  var justAdded = null;

  // ---------------------------------------------------------------
  //  Number entry
  // ---------------------------------------------------------------
  function current() { return typed ? parseInt(typed, 10) : null; }

  // Hide the old picture until the new one has loaded, so the name and
  // picture never disagree while the assistant is typing.
  function showArt(img, n) {
    var src = Dex.art(n);
    img.hidden = false;
    if (img.getAttribute("src") === src) return;
    img.style.visibility = "hidden";
    img.onload = img.onerror = function () { img.style.visibility = ""; };
    img.src = src;
  }

  function renderReadout() {
    $("#digits").textContent = typed;
    $("#lcd").classList.toggle("is-empty", !typed);
    $("#addKey").classList.toggle("ready", typed.length > 0);

    var img = $("#previewImg"), text = $("#previewText");
    var n = current();
    $("#lcd").classList.remove("is-bad", "is-added");

    if (justAdded && !typed) {
      showArt(img, justAdded);
      text.textContent = "✔ " + Dex.name(justAdded) + " is in!";
      $("#lcd").classList.add("is-added");
      return;
    }
    if (n === null) {
      img.hidden = true;
      text.textContent = "Type the number on your sticker";
      return;
    }
    if (!(n >= 1 && n <= Dex.max)) {
      img.hidden = true;
      text.textContent = "Stickers go from 001 to " + Dex.pad3(Dex.max);
      $("#lcd").classList.add("is-bad");
      return;
    }
    showArt(img, n);
    if (Dex.isMissing(n)) {
      text.textContent = Dex.label(n) + " isn't in the sticker book";
      $("#lcd").classList.add("is-bad");
    } else if (Store.has(n)) {
      text.textContent = Dex.label(n) + " is already in the Pokédex";
      $("#lcd").classList.add("is-bad");
    } else {
      text.textContent = Dex.label(n);
    }
  }

  function setStatus(msg, kind) {
    var s = $("#status");
    s.textContent = msg;
    s.className = "status" + (kind ? " " + kind : "");
  }

  function shake() {
    var lcd = $("#lcd");
    lcd.classList.remove("shake");
    void lcd.offsetWidth;
    lcd.classList.add("shake");
  }

  function press(key) {
    Sound.unlock();
    if (key === "enter") {
      submit();
      return;
    } else if (key === "back") {
      typed = typed.slice(0, -1);
    } else if (key === "clear") {
      typed = "";
    } else if (/^\d$/.test(key)) {
      if (typed.length >= 3) return;
      typed += key;
    }
    justAdded = null;
    setStatus("");
    renderReadout();
  }

  function submit() {
    var n = current();
    if (n === null) {
      setStatus("Type the sticker number first.", "bad");
      Sound.buzz(); shake();
      return;
    }
    var r = Store.add(n);
    if (!r.ok) {
      var msg = {
        range: "There's no Pokémon #" + Dex.pad3(n) + ". Stickers go from 001 to " + Dex.pad3(Dex.max) + ".",
        missing: Dex.label(n) + " isn't in the sticker book. Check the number?",
        duplicate: Dex.label(n) + " is already in the Pokédex" +
          (Store.drawOf(n) ? " (and already drawn)." : ". Pick another sticker?")
      }[r.reason];
      setStatus(msg, "bad");
      Sound.buzz(); shake();
      return;
    }
    typed = "";
    justAdded = n;
    setStatus("✔ " + Dex.label(n) + " added. " + Store.pool().length + " in the draw.", "good");
    Sound.blip();
    if (R.Settings.get().cryOnCheckin) Sound.wait(180).then(function () { Sound.playUrl(Dex.cry(n)); });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { justAdded = null; renderReadout(); }, 2500);
    renderReadout();
    renderList();
  }

  function initKeypad() {
    $("#keypad").addEventListener("click", function (e) {
      var b = e.target.closest("[data-key]");
      if (b) press(b.getAttribute("data-key"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === "Backspace") { press("back"); e.preventDefault(); }
      else if (e.key === "Escape") { press("clear"); }
      else if (e.key === "Enter" && !(t && t.tagName === "BUTTON")) { press("enter"); e.preventDefault(); }
    });
  }

  // ---------------------------------------------------------------
  //  The list
  // ---------------------------------------------------------------
  function renderList() {
    var entries = Store.entries().reverse();
    var list = $("#list");
    list.textContent = "";
    entries.forEach(function (e) {
      var n = e.n, draw = Store.drawOf(n);
      var li = document.createElement("li");
      li.className = "chip" + (draw ? " is-" + draw.result : "");

      var art = document.createElement("span");
      art.className = "chip-art";
      var img = document.createElement("img");
      img.src = Dex.art(n);
      img.alt = "";
      img.loading = "lazy";
      art.appendChild(img);
      if (draw) {
        var badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = draw.result === "won" ? "🏆" : "✗";
        art.appendChild(badge);
      }
      li.appendChild(art);

      var txt = document.createElement("span");
      txt.className = "chip-text";
      var num = document.createElement("b");
      num.textContent = "#" + Dex.pad3(n);
      txt.appendChild(num);
      txt.appendChild(document.createTextNode(" " + Dex.name(n)));
      if (draw) {
        var tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = draw.result === "won" ? "Won" : "No-show";
        txt.appendChild(tag);
      }
      li.appendChild(txt);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      if (draw) {
        btn.textContent = "↺";
        btn.title = "Put back in the draw";
        btn.setAttribute("aria-label", "Put " + Dex.label(n) + " back in the draw");
        btn.addEventListener("click", function () {
          if (confirm("Put " + Dex.label(n) + " back in the draw?")) { Store.undraw(n); renderAll(); }
        });
      } else {
        btn.textContent = "✕";
        btn.title = "Remove";
        btn.setAttribute("aria-label", "Remove " + Dex.label(n));
        btn.addEventListener("click", function () {
          if (confirm("Remove " + Dex.label(n) + " from the raffle?")) { Store.remove(n); renderAll(); }
        });
      }
      li.appendChild(btn);
      list.appendChild(li);
    });

    var count = entries.length, pool = Store.pool().length;
    $("#count").textContent = count;
    $("#countWord").textContent = count === 1 ? "trainer" : "trainers";
    $("#empty").hidden = count > 0;
    $("#undo").disabled = count === 0;
    var drawn = count - pool;
    $("#poolLine").textContent = count ? pool + " still in the draw" + (drawn ? " · " + drawn + " drawn" : "") : "";
  }

  function renderAll() { renderList(); renderReadout(); }

  function undoLast() {
    var entries = Store.entries();
    if (!entries.length) return;
    var n = entries[entries.length - 1].n;
    var extra = Store.drawOf(n) ? "\n\n(It has already been drawn.)" : "";
    if (!confirm("Undo the last one, " + Dex.label(n) + "?" + extra)) return;
    Store.remove(n);
    justAdded = null;
    setStatus("Removed " + Dex.label(n) + ".");
    renderAll();
  }

  // ---------------------------------------------------------------
  //  Tools
  // ---------------------------------------------------------------
  function copy(text, btn, done) {
    var old = btn.textContent;
    var ok = function () { btn.textContent = done; setTimeout(function () { btn.textContent = old; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () {});
    }
  }

  function initTools() {
    $("#shareBtn").addEventListener("click", function () {
      var url = R.shareUrl("draw.html");
      var field = $("#shareUrl");
      field.value = url;
      field.hidden = false;
      field.select();
      if (navigator.share) {
        navigator.share({ title: "Raffle stickers", text: "Who's That Pokémon? raffle list", url: url }).catch(function () {});
      } else {
        copy(url, $("#shareBtn"), "✔ Link copied");
      }
    });

    $("#copyNumsBtn").addEventListener("click", function () {
      var nums = Store.entries().map(function (e) { return Dex.pad3(e.n); }).join(", ");
      copy(nums || "(none yet)", $("#copyNumsBtn"), "✔ Copied");
    });

    $("#importBtn").addEventListener("click", function () {
      var nums = Dex.parse($("#importText").value);
      if (!nums.length) { setStatus("No numbers found to add.", "bad"); return; }
      var r = Store.importNumbers(nums);
      $("#importText").value = "";
      setStatus("Added " + r.added.length + (r.skipped.length ? " · skipped " + r.skipped.length + " (already in, or not in the book)" : "") + ".", "good");
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    var cry = $("#cryToggle");
    cry.checked = R.Settings.get().cryOnCheckin;
    cry.addEventListener("change", function () { R.Settings.set({ cryOnCheckin: cry.checked }); });

    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Clear every sticker and winner on this device?")) return;
      if (!confirm("Really? This can't be undone.")) return;
      Store.reset();
      typed = ""; justAdded = null;
      setStatus("Cleared. Ready for the first guest.");
      renderAll();
    });

    $("#undo").addEventListener("click", undoLast);
  }

  function init() {
    $("#storageWarning").hidden = Store.persistent();
    var shared = R.consumeShareLink();
    if (shared) setStatus("Added " + shared.added.length + " from the shared link.", "good");
    initKeypad();
    initTools();
    renderAll();
    Store.onChange(renderAll);
  }

  init();
})();
