// Drives a full evening: host + two auto-playing phones + the TV, through every
// phase, screenshotting each one and collecting browser errors.
//   node scripts/rehearse.mjs [--base http://localhost:8787] [--bots 80] [--pin 1234] [--out docs/screens] [--fast]
//   node scripts/rehearse.mjs --game binky --base http://localhost:8791   # only that game, via the host's JUMP
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:8787");
const BOTS = Number(arg("bots", "80"));
const PIN = arg("pin", "1234");
const OUT = arg("out", "docs/screens");
const FAST = process.argv.includes("--fast");
const GAME = arg("game", "");
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async () => (await fetch(BASE + "/api/state")).json();

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
function track(page, name) {
  page.on("pageerror", (e) => errors.push(name + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(name + ": " + m.text()); });
}
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
const hostCtx = await browser.newContext(phone);
const p1Ctx = await browser.newContext(phone);
const p2Ctx = await browser.newContext(phone);
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const host = await hostCtx.newPage(), p1 = await p1Ctx.newPage(), p2 = await p2Ctx.newPage(), tv = await tvCtx.newPage();
track(host, "host"); track(p1, "player1"); track(p2, "player2"); track(tv, "tv");

async function shot(tag) {
  const safe = tag.replace(/[^a-z0-9-]+/gi, "_");
  await Promise.all([
    p1.screenshot({ path: path.join(OUT, `${safe}-player.png`), fullPage: true }).catch(() => {}),
    host.screenshot({ path: path.join(OUT, `${safe}-host.png`), fullPage: true }).catch(() => {}),
    tv.screenshot({ path: path.join(OUT, `${safe}-tv.png`), fullPage: false }).catch(() => {})
  ]);
  console.log("shot", safe);
}

// Reset the room so the run is repeatable.
await host.goto(BASE + "/host");
await host.fill("#pin", PIN);
await host.click("text=UNLOCK REMOTE");
await host.waitForSelector("text=HOLD TO RESET", { timeout: 15000 });
host.on("dialog", (d) => d.accept());
const st0 = await api();
if (st0.phase !== "lobby" || st0.playerCount) {
  // Hold to reset.
  const btn = await host.$("text=HOLD TO RESET");
  const box = await btn.boundingBox();
  await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await host.mouse.down(); await sleep(1200); await host.mouse.up();
  await sleep(500);
  await host.click("text=REMOVE BOTS");
  await sleep(500);
}

// Two real phones join.
for (const [pg, name] of [[p1, "Fahad Test"], [p2, "Oyshe Test"]]) {
  await pg.goto(BASE + "/?auto=1");
  await pg.waitForSelector("#name", { timeout: 15000 });
  await pg.fill("#name", name);
  await pg.click("text=RANDOM");
  await pg.click("text=READY!");
  await pg.waitForSelector("text=YOU'RE IN!", { timeout: 15000 });
}
await tv.goto(BASE + "/tv");
await tv.click("text=SILENT");
await host.click(`text=+${BOTS >= 80 ? "80" : "20"} BOTS`);
await sleep(800);
if (BOTS > 80) { await host.click("text=+80 BOTS"); await sleep(800); }
await sleep(1500);
await shot("00-lobby");

if (GAME) {
  // Jump straight to one game (its intro) from the lobby.
  await host.click("text=START GAME");
  await sleep(600);
  const s1 = await api();
  const gi = (s1.order || []).findIndex((g) => g.id === GAME);
  if (gi < 0) throw new Error("game not registered: " + GAME);
  await host.selectOption("select", String(gi));
  await host.click("text=JUMP");
  await sleep(600);
}
let last = "", n = 0, guard = 0, gameIdx = null, stageShot = false;
while (guard++ < 400) {
  const s = await api();
  if (GAME) {
    if (gameIdx == null && s.game && s.game.id === GAME) gameIdx = s.gameIndex;
    if (gameIdx != null && (s.gameIndex !== gameIdx || s.phase === "final")) break;
  }
  const key = s.phase + "|" + (s.roundId || "") + "|" + s.gameIndex;
  if (key !== last) {
    last = key;
    n++;
    const tag = String(n).padStart(2, "0") + "-" + s.phase + (s.roundId ? "-" + s.roundId : "");
    // Let animations play a little before the screenshot.
    const settle = { intro: 1200, howto: 1500, playing: 2500, locked: 600, reveal: 3500, results: 6500, leaderboard: 5500, final: 9000, predictions: 1500, credits: 1500 }[s.phase] || 1000;
    await sleep(FAST ? Math.min(settle, 2500) : settle);
    await shot(tag);
    if (s.phase === "leaderboard" && !stageShot) {
      stageShot = true;
      await host.click("text=STAGE VIEW (BIG SCREEN)");
      await sleep(FAST ? 2500 : 6000);
      await host.screenshot({ path: path.join(OUT, `${tag.replace(/[^a-z0-9-]+/gi, "_")}-host-stage.png`), fullPage: true }).catch(() => {});
      await host.click("text=EXIT");
      await sleep(400);
    }
    if (s.phase === "credits") break;
    if (["intro", "reveal", "results", "leaderboard", "final", "predictions"].includes(s.phase)) {
      if (s.phase === "predictions") { await p1.fill("#firstWord", "PIKACHU").catch(() => {}); await p1.click("text=SAVE PREDICTION").catch(() => {}); await sleep(600); }
      await host.click("text=/^(START GAME|SHOW HOW-TO|SHOW ROUND RESULTS|SHOW LEADERBOARD|NEXT ROUND.*|NEXT GAME|FINAL RANKINGS|PREDICTIONS|ROLL CREDITS)$/");
    } else if (s.phase === "lobby") {
      await host.click("text=START GAME");
    }
    continue;
  }
  await sleep(400);
}
await shot("99-end");
await browser.close();
const uniq = [...new Set(errors)];
console.log("\nBrowser errors:", uniq.length);
uniq.slice(0, 40).forEach((e) => console.log(" -", e));
process.exit(uniq.length ? 1 : 0);
