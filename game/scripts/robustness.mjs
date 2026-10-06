// Robustness checks against a running local server:
//  1. a phone goes offline for 20 s mid-round, comes back, and shows the right phase with its answer kept
//  2. a phone reloads mid-game and keeps its identity, name and points
//  3. the host phone closes mid-round and the round still ends and scores on the server clock
//   node scripts/robustness.mjs [--base http://localhost:8787] [--pin 1234]
import { chromium } from "playwright-core";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:8787"), PIN = arg("pin", "1234");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async () => (await fetch(BASE + "/api/state")).json();
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const ok = (m) => console.log("ok:", m);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const hostCtx = await browser.newContext(phone), pCtx = await browser.newContext(phone);
const host = await hostCtx.newPage(), p = await pCtx.newPage();
host.on("dialog", (d) => d.accept());

await host.goto(BASE + "/host");
await host.fill("#pin", PIN); await host.click("text=UNLOCK REMOTE");
await host.waitForSelector("text=HOLD TO RESET");
{ const btn = await host.$("text=HOLD TO RESET"); await btn.scrollIntoViewIfNeeded(); const b = await btn.boundingBox(); await host.mouse.move(b.x + 10, b.y + 10); await host.mouse.down(); await sleep(1200); await host.mouse.up(); await sleep(400); await host.click("text=REMOVE BOTS"); await sleep(400); }
await p.goto(BASE + "/"); await p.waitForSelector("#name"); await p.fill("#name", "Robust Rita"); await p.click("text=RANDOM"); await p.click("text=READY!");
await p.waitForSelector("text=YOU'RE IN!");
await host.click("text=+20 BOTS"); await sleep(600);
await host.click("text=START GAME"); await sleep(400);
await host.click("text=SHOW HOW-TO"); await sleep(300);
await host.click("text=START ROUND NOW"); await sleep(800);
let s = await api();
if (s.phase !== "playing") fail("expected playing, got " + s.phase);

// 1. Offline mid-round: answer first, then drop the network for 20 s.
const range = await p.$("input[type=range]");
if (range) { await p.evaluate((el) => { el.value = String(Math.round(Number(el.max) * 0.4)); el.dispatchEvent(new Event("input")); }, range); await p.click("text=LOCK IN"); await sleep(500); }
await pCtx.setOffline(true);
await sleep(20000);
await pCtx.setOffline(false);
const t0 = Date.now();
await p.waitForSelector(".dot.on", { timeout: 15000 }).catch(() => fail("socket did not reconnect"));
ok("reconnected in " + (Date.now() - t0) + " ms after 20 s offline");
await host.click("text=END ROUND NOW"); await sleep(2500);
s = await api();
if (!["reveal", "locked"].includes(s.phase)) fail("expected reveal after END ROUND NOW, got " + s.phase);
const txt = await p.textContent("body");
if (!/YOUR GUESS/.test(txt)) fail("answer not preserved across the offline gap (no YOUR GUESS on reveal)"); else ok("answer preserved across offline gap");

// 2. Reload keeps identity and points.
await host.click("text=SHOW ROUND RESULTS"); await sleep(300); await host.click("text=SHOW LEADERBOARD"); await sleep(500);
await p.reload(); await p.waitForSelector(".dot.on", { timeout: 15000 });
await sleep(2500);
const after = await p.textContent("body");
if (!/LEADERBOARD|#\d+/.test(after)) fail("after reload the phone did not render the leaderboard phase");
const youRow = await p.$(".brow.me");
if (!youRow) fail("after reload the player's own row is missing (identity lost?)"); else ok("identity kept across reload: " + (await youRow.textContent()).trim().slice(0, 40));

// 3. Host phone dies mid-round: the server still ends the round.
await host.click("text=/^NEXT ROUND/"); await sleep(300);
await host.click("text=START ROUND NOW"); await sleep(500);
s = await api();
const endsAt = s.endsAt;
await hostCtx.close();
await sleep(Math.max(0, endsAt - Date.now()) + 3000);
s = await api();
if (["reveal", "locked", "results"].includes(s.phase) && s.scored >= 2) ok("round ended and scored on the server clock without the host (" + s.phase + ")");
else fail("round did not end without the host: " + s.phase + " scored=" + s.scored);

await browser.close();
console.log(process.exitCode ? "ROBUSTNESS: FAILURES" : "ROBUSTNESS: ALL GOOD");
