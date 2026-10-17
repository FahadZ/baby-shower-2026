// Checks the Binky map on a phone: rounds 1 and 3 fit inside the visible window, round 2
// is a taller pile that scrolls under a drag, and the night canvas shrinks to fit.
//   node scripts/binky-map.mjs [--base http://localhost:8787] [--pin 1234] [--out docs/screens]
import { chromium } from "playwright-core";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:8787"), OUT = arg("out", "docs/screens"), PIN = arg("pin", "1234");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async () => (await fetch(BASE + "/api/state")).json();
const errors = [];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const phone = { viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const host = await (await browser.newContext(phone)).newPage();
const p1 = await (await browser.newContext(phone)).newPage();
for (const [pg, n] of [[host, "host"], [p1, "p1"]]) { pg.on("pageerror", (e) => errors.push(n + ": " + e.message)); pg.on("console", (m) => { if (m.type() === "error") errors.push(n + ": " + m.text()); }); }
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) process.exitCode = 1; };
const waitPhase = async (ph) => { for (let i = 0; i < 40 && (await api()).phase !== ph; i++) await sleep(200); return (await api()).phase === ph; };

await host.goto(BASE + "/host");
await host.fill("#pin", PIN);
await host.click("text=UNLOCK REMOTE");
await host.waitForSelector("text=HOLD TO RESET", { timeout: 15000 });
host.on("dialog", (d) => d.accept());
const btn = await host.$("text=HOLD TO RESET");
await btn.scrollIntoViewIfNeeded();
const box = await btn.boundingBox();
await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await host.mouse.down(); await sleep(1200); await host.mouse.up();
await sleep(500);
await host.click("text=REMOVE BOTS");
await sleep(500);

await p1.goto(BASE + "/");
await p1.waitForSelector("#name", { timeout: 15000 });
// The READY button rides along the bottom of the join screen, visible without scrolling.
const readyBox = await (await p1.$("text=READY!")).boundingBox();
check(readyBox && readyBox.y + readyBox.height <= 700 && readyBox.y > 400, "READY! is on screen at the bottom of the join screen (y=" + Math.round(readyBox ? readyBox.y : -1) + ")");
await p1.fill("#name", "Mapper " + (Date.now() % 10000));
await p1.click("text=RANDOM");
await p1.click("text=READY!");
await p1.waitForSelector("text=YOU'RE IN!", { timeout: 15000 });

await host.click("text=START GAME");
await waitPhase("intro");
await host.waitForSelector("text=SHOW HOW-TO");
const gi = (await api()).order.findIndex((g) => g.id === "binky");
await host.selectOption("select", String(gi));
await host.click('button:has-text("JUMP")');
await sleep(700);

const canvasBox = async () => p1.evaluate(() => {
  const c = document.querySelector("canvas.game-surface");
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, width: r.width, height: r.height, parent: c.parentElement.clientWidth, inner: window.innerHeight, scrollY: window.scrollY, hint: (document.querySelector("p.tiny.center") || {}).textContent || "" };
});
const canvasHash = async () => p1.evaluate(() => { const c = document.querySelector("canvas.game-surface"); const d = c.getContext("2d").getImageData(0, 0, c.width, Math.min(c.height, 400)).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; });

for (let round = 1; round <= 3; round++) {
  // From the intro the big button shows the how-to; after a skip the next how-to is already up.
  if ((await api()).phase === "intro") { await host.click(".btn.primary.huge"); await waitPhase("howto"); }
  if ((await api()).phase !== "howto") { check(false, "round " + round + " how-to (phase " + (await api()).phase + ")"); break; }
  await host.click(".btn.primary.huge");   // START ROUND
  check(await waitPhase("playing"), "round " + round + " playing");
  await sleep(1200);
  const b = await canvasBox();
  check(b && b.bottom <= b.inner + 1 && b.top >= 0, "round " + round + ": the whole canvas is inside the visible window (" + Math.round(b.top) + ".." + Math.round(b.bottom) + " of " + b.inner + ")");
  await p1.screenshot({ path: OUT + "/binky-map-round" + round + ".png", fullPage: false });
  if (round === 2) {
    check(/DRAG UP AND DOWN/.test(b.hint), "round 2 hint says to drag");
    check(b.width >= b.parent - 2, "round 2 keeps the full width (" + Math.round(b.width) + " of " + b.parent + ")");
    const before = await canvasHash();
    const cx = b.width / 2, y0 = b.top + b.height * 0.75, y1 = b.top + b.height * 0.25;
    await p1.mouse.move(cx, y0); await p1.mouse.down();
    for (let k = 1; k <= 8; k++) { await p1.mouse.move(cx, y0 + (y1 - y0) * k / 8); await sleep(30); }
    await p1.mouse.up();
    await sleep(300);
    const after = await canvasHash();
    check(before !== after, "round 2: a drag scrolls the pile");
    const st = await api();
    check(st.touchedCount === 0, "a drag is not a tap (nothing submitted)");
    await p1.screenshot({ path: OUT + "/binky-map-round2-dragged.png", fullPage: false });
  }
  if (round === 3) check(b.width < b.parent - 20, "round 3 (night) shrinks to fit instead of scrolling (" + Math.round(b.width) + " of " + b.parent + ")");
  if (round < 3) { await host.click("text=SKIP ROUND"); await waitPhase("howto"); }
}
console.log("Browser errors: " + errors.length + (errors.length ? "\n" + errors.join("\n") : ""));
if (errors.length) process.exitCode = 1;
await browser.close();
