// Host PIN lock for the draw screen. The PIN is the party games' host PIN and is
// checked by the game server, so it never appears in this page. Once unlocked,
// this device stays unlocked (no network needed after that).
(function () {
  "use strict";

  var SERVER = "wss://baby.thenerdnextdoor.ca/ws?role=raffle";
  var KEY = "raffle.drawUnlocked";

  function isUnlocked() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  if (isUnlocked()) return;

  var lock = document.createElement("div");
  lock.className = "pin-lock";
  lock.innerHTML =
    '<form class="pin-box" autocomplete="off">' +
      '<h2>Host PIN</h2>' +
      '<p>Enter the host PIN to open the draw screen.</p>' +
      '<input type="password" inputmode="numeric" aria-label="Host PIN" required>' +
      '<button type="submit" class="btn">Unlock</button>' +
      '<p class="pin-error" role="alert"></p>' +
    '</form>';
  document.body.appendChild(lock);
  document.body.classList.add("locked");

  var form = lock.querySelector("form");
  var input = lock.querySelector("input");
  var button = lock.querySelector("button");
  var error = lock.querySelector(".pin-error");
  input.focus();

  // Keep Space, T, F and the rest from reaching the draw screen while locked.
  window.addEventListener("keydown", function (e) {
    if (lock.isConnected && !lock.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  function unlock() {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    lock.remove();
    document.body.classList.remove("locked");
  }

  function fail(msg) {
    error.textContent = msg;
    button.disabled = false;
    input.select();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var pin = input.value.trim();
    if (!pin) return;
    button.disabled = true;
    error.textContent = "Checking…";
    var done = false, ws;
    var timer = setTimeout(function () {
      finish();
      fail("Can't reach the game server. Check the Wi-Fi and try again.");
    }, 8000);
    function finish() {
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch (err) {}
    }
    try { ws = new WebSocket(SERVER); } catch (err) { finish(); fail("Can't reach the game server."); return; }
    ws.onopen = function () { ws.send(JSON.stringify({ t: "host", pin: pin })); };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (err) { return; }
      if (done) return;
      if (msg.t === "host-ok") { finish(); unlock(); }
      else if (msg.t === "host-error") { finish(); fail(msg.error === "WRONG PIN." ? "Wrong PIN." : msg.error); }
    };
    ws.onclose = function () {
      if (!done) { finish(); fail("Can't reach the game server. Check the Wi-Fi and try again."); }
    };
  });
})();
