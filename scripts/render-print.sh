#!/bin/sh
# Re-render the raffle posters and rule sheet PDFs (and PNG previews) from their HTML.
# Needs Node with Playwright: npm i -g playwright && npx playwright install chromium
set -e
cd "$(dirname "$0")/.."
python3 -m http.server 8765 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
node - <<'JS'
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1700 } });
  for (const [page, w, h, out] of [
    ['raffle-poster.html', '297mm', '420mm', 'raffle-poster-A3'],
    ['raffle-poster-landscape.html', '420mm', '297mm', 'raffle-poster-A3-landscape'],
    ['raffle-rules.html', '8.5in', '11in', 'raffle-rules-letter'],
  ]) {
    await p.emulateMedia({ media: 'print' });
    await p.goto('http://localhost:8765/print/' + page, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: 'print/' + out + '.pdf', width: w, height: h, printBackground: true });
    await (await p.$('.sheet')).screenshot({ path: 'print/' + out + '.png' });
    console.log('print/' + out + '.pdf');
  }
  await b.close();
})();
JS
