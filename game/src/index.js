// Worker entry: WebSocket + API requests go to the single game room; everything
// else is a static file from public/.
export { GameRoom } from "./room.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws" || url.pathname.startsWith("/api/")) {
      if (url.pathname === "/ws" && request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const id = env.ROOM.idFromName(env.ROOM_NAME || "main");
      return env.ROOM.get(id).fetch(request);
    }
    const res = await env.ASSETS.fetch(request);
    if (url.pathname.endsWith(".html") || url.pathname === "/" || !url.pathname.includes(".")) {
      const h = new Headers(res.headers);
      h.set("cache-control", "no-cache");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  }
};
