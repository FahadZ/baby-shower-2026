// Makes print/qr-game.png and print/join-card.pdf (A4, four A6 cards) for the tables.
//   node scripts/make-printables.mjs [--url https://baby.thenerdnextdoor.ca/]
import QRCode from "qrcode";
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const i = process.argv.indexOf("--url");
const URL_ = i > -1 ? process.argv[i + 1] : "https://baby.thenerdnextdoor.ca/";
const out = path.join(root, "print");
fs.mkdirSync(out, { recursive: true });

await QRCode.toFile(path.join(out, "qr-game.png"), URL_, { errorCorrectionLevel: "M", margin: 2, scale: 12, color: { dark: "#1d1b18", light: "#ffffff" } });
const svg = await QRCode.toString(URL_, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#1d1b18", light: "#ffffff" } });
const font = fs.readFileSync(path.join(root, "game/public/assets/fonts/press-start-2p-latin.woff2")).toString("base64");
const hearts = fs.readFileSync(path.join(root, "assets/deco/hearts.png")).toString("base64");
const logo = fs.readFileSync(path.join(root, "assets/scene/logo.png")).toString("base64");
const pretty = URL_.replace(/^https?:\/\//, "").replace(/\/$/, "");

const card = `
  <div class="card">
    <img class="logo" src="data:image/png;base64,${logo}" alt="Baby Loading..">
    <div class="tag">PARTY GAMES</div>
    <div class="qr">${svg}</div>
    <div class="scan">SCAN TO JOIN</div>
    <div class="url">${pretty}</div>
    <div class="hint">PICK A NAME + CHARACTER. KEEP THE PAGE OPEN. PLAYER 1 STARTS THE GAME.</div>
    <img class="hearts" src="data:image/png;base64,${hearts}" alt="">
  </div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Press Start 2P"; src: url(data:font/woff2;base64,${font}) format("woff2"); }
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: "Press Start 2P", monospace; text-transform: uppercase; }
  .sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .card { box-sizing: border-box; width: 105mm; height: 148.5mm; padding: 9mm 8mm; border: 0.4mm dashed #999; display: flex; flex-direction: column; align-items: center; text-align: center; background: #3f443a; color: #ecdcc0; }
  .logo { width: 58mm; image-rendering: pixelated; margin-top: 2mm; }
  .tag { font-size: 8pt; color: #bdb29c; margin: 3mm 0 4mm; letter-spacing: .1em; }
  .qr { width: 52mm; height: 52mm; padding: 3mm; background: #fff; border: 1.2mm solid #1d1b18; box-shadow: 1.5mm 1.5mm 0 #000; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .scan { font-size: 11pt; color: #ffd84a; margin-top: 5mm; text-shadow: 1mm 1mm 0 #000; }
  .url { font-size: 7.5pt; color: #f3e6cf; margin-top: 2.5mm; }
  .hint { font-size: 5pt; color: #bdb29c; line-height: 1.8; margin-top: 4mm; }
  .hearts { height: 5mm; image-rendering: pixelated; margin-top: auto; }
</style></head><body><div class="sheet">${card}${card}${card}${card}</div></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(out, "join-card.pdf"), format: "A4", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
await page.setViewportSize({ width: 794, height: 1123 });
await page.screenshot({ path: path.join(out, "join-card-preview.png"), fullPage: true });
await browser.close();
console.log("wrote", path.join(out, "qr-game.png"), path.join(out, "join-card.pdf"));
