// WebSocket client with reconnect, clock sync and a tiny message bus.
// The server is the clock: now() returns the server's time.
export function connect({ role = "player", onMessage, onStatus }) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = proto + "//" + location.host + "/ws?role=" + encodeURIComponent(role);
  let ws = null, closedByUs = false, attempt = 0, offset = 0, bestRtt = Infinity, pingTimer = null, openHooks = [];
  const status = (s) => { try { onStatus && onStatus(s); } catch (e) { /* ignore */ } };

  function open() {
    try { ws = new WebSocket(url); } catch (e) { retry(); return; }
    status("connecting");
    ws.onopen = () => {
      attempt = 0;
      status("open");
      ping(); setTimeout(ping, 400); setTimeout(ping, 1200);
      clearInterval(pingTimer);
      pingTimer = setInterval(ping, 20000);
      openHooks.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.t === "pong") {
        const now = Date.now();
        const rtt = now - msg.c;
        if (rtt <= bestRtt + 30) {
          bestRtt = Math.min(bestRtt, rtt);
          offset = msg.s + rtt / 2 - now;
        }
        return;
      }
      if (msg.t === "state" && typeof msg.serverNow === "number" && bestRtt === Infinity) offset = msg.serverNow - Date.now();
      try { onMessage(msg); } catch (e) { console.error(e); }
    };
    ws.onclose = () => { clearInterval(pingTimer); status("closed"); if (!closedByUs) retry(); };
    ws.onerror = () => { /* onclose follows */ };
  }

  function retry() {
    attempt++;
    const delay = Math.min(8000, 400 * Math.pow(1.6, attempt)) + Math.random() * 300;
    status("retrying");
    setTimeout(open, delay);
  }

  function ping() { send({ t: "ping", c: Date.now() }); }

  function send(msg) {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (!ws || ws.readyState > 1)) { attempt = 0; open(); }
    else if (!document.hidden) ping();
  });
  window.addEventListener("online", () => { if (!ws || ws.readyState > 1) { attempt = 0; open(); } });

  open();
  return {
    send,
    now: () => Date.now() + offset,
    offset: () => offset,
    onOpen: (fn) => { openHooks.push(fn); if (ws && ws.readyState === 1) fn(); },
    isOpen: () => !!ws && ws.readyState === 1,
    close: () => { closedByUs = true; try { ws && ws.close(); } catch (e) { /* ignore */ } }
  };
}
