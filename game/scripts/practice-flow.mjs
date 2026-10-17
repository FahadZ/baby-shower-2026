// Checks the practice round end to end on Put It In Order: the host toggle, the
// overlay after LOCK IN, TRY AGAIN, toggling off, and START ROUND clearing it.
//   node scripts/practice-flow.mjs [--base http://localhost:8787] [--pin 1234] [--out docs/screens]
import { chromium } from "playwright-core";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:8787"), OUT = arg("out", "docs/screens"), PIN = arg("pin", "1234");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async () => (await fetch(BASE + "/api/state")).json();
const errors = [];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const host = await (await browser.newContext(phone)).newPage();
const p1 = await (await browser.newContext(phone)).newPage();
for (const [pg, n] of [[host, "host"], [p1, "p1"]]) { pg.on("pageerror", (e) => errors.push(n + ": " + e.message)); pg.on("console", (m) => { if (m.type() === "error") errors.push(n + ": " + m.text()); }); }
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) process.exitCode = 1; };

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

await p1.goto(BASE + "/?auto=1");
await p1.waitForSelector("#name", { timeout: 15000 });
await p1.fill("#name", "Tester " + (Date.now() % 10000));
await p1.click("text=RANDOM");
await p1.click("text=READY!");
await p1.waitForSelector("text=YOU'RE IN!", { timeout: 15000 });

// Jump to Put It In Order and open its how-to.
await host.click("text=START GAME");
for (let i = 0; i < 20 && (await api()).phase !== "intro"; i++) await sleep(200);
await host.waitForSelector("text=SHOW HOW-TO");
const gi = (await api()).order.findIndex((g) => g.id === "order");
await host.selectOption("select", String(gi));
await host.click('button:has-text("JUMP")');
await sleep(700);
await host.click(".btn.primary.huge");   // SHOW HOW-TO
for (let i = 0; i < 20 && (await api()).phase !== "howto"; i++) await sleep(200);
check((await api()).phase === "howto", "on the how-to of Put It In Order");
await sleep(600);
check(await p1.$("text=WAITING FOR PLAYER 1") !== null, "phone shows the how-to card before practice");

// Practice on: the phone runs the level, autoplay locks in, the overlay appears.
await host.click("[data-f=practice]");
await p1.waitForSelector("text=PRACTICE ROUND", { timeout: 5000 });
check(true, "phone switched to the practice screen");
await p1.waitForSelector(".locked-in", { timeout: 45000 });
const ovText = await p1.$eval(".locked-in", (el) => el.textContent);
check(/NICE|NOT YET/.test(ovText) && /ORDER LOCKED/.test(ovText) && /PERFECT ORDER|NOT QUITE/.test(ovText), "overlay grades the try: " + ovText.replace(/\s+/g, " ").slice(0, 90));
check((await api()).phase === "howto" && (await api()).answerCount === 0, "nothing reached the server");
await p1.screenshot({ path: OUT + "/practice-overlay.png", fullPage: false });
await p1.click("text=TRY AGAIN");
await sleep(400);
check(await p1.$(".locked-in") === null, "TRY AGAIN removes the overlay");
check((await p1.$eval(".ord-lock", (el) => el.textContent)) === "LOCK IN", "TRY AGAIN re-mounts a fresh level");

// Practice off: back to the how-to card. On again, then START ROUND clears it all.
await host.click("[data-f=practice]");
await p1.waitForSelector("text=WAITING FOR PLAYER 1", { timeout: 5000 });
check(await p1.$("text=PRACTICE ROUND") === null, "toggle off restores the how-to card");
await host.click("[data-f=practice]");
await p1.waitForSelector("text=PRACTICE ROUND", { timeout: 5000 });
await host.click(".btn.primary.huge");   // START ROUND
for (let i = 0; i < 20 && (await api()).phase !== "playing"; i++) await sleep(200);
await sleep(800);
check((await api()).phase === "playing" && !(await api()).practice, "START ROUND clears practice on the server");
check(await p1.$("text=PRACTICE ROUND") === null && await p1.$(".locked-in") === null, "phone is in the real round with no practice remains");
check(await p1.$(".ord-lock") !== null, "real round mounted on the phone");
console.log("Browser errors: " + errors.length + (errors.length ? "\n" + errors.join("\n") : ""));
if (errors.length) process.exitCode = 1;
await browser.close();
