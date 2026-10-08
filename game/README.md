# Baby Loading.. Party Games

Live, host-controlled party games that up to 80 guests play on their phones. One
Cloudflare Worker serves the pages; one Durable Object is the game room and owns
the clock, the answers and the scores. Phones only render what it broadcasts.

- **Players:** `https://baby.thenerdnextdoor.ca/` (the QR)
- **Host remote:** `https://baby.thenerdnextdoor.ca/host` (PIN)
- **Big screen (optional):** `https://baby.thenerdnextdoor.ca/tv`

See *Running the night* at the bottom for the step-by-step.

## Layout

```
game/
  wrangler.jsonc          Worker + Durable Object + static assets config
  src/
    index.js              Worker entry: /ws and /api/* go to the room, the rest is static
    room.js               GameRoom Durable Object: sockets, persistence, alarms, broadcast
    logic.js              The pure state machine (tested in test/logic.test.js)
    scoring.js            Shared scoring helpers (tested)
    bots.js  rng.js       Rehearsal bots, seeded RNG
    games/<id>.js         Server side of each game (see the contract below)
  public/
    index.html player.js  The phone
    host.html  host.js    The remote (+ STAGE view)
    tv.html    tv.js      The big screen
    game.css              Shared pixel styling
    engine/               net, dom, audio, avatars, moves, countdown, hype, stage, stageview
    games/<id>.js         Client side of each game
    data/<id>.js          Editable content (prices, questions, roster...)
    assets/               fonts, deco, scene, avatars (character + palette PNGs), babyphotos
  test/                   node --test
  scripts/                rehearse.mjs, robustness.mjs, practice-flow.mjs (Playwright), avatar palette generator
  docs/screens/           Screenshots from the last rehearsal
```

## Local development

```sh
cd game
npm install
npm run dev                 # http://localhost:8787 (host PIN from .dev.vars: 1234)
npm test                    # unit tests
node scripts/rehearse.mjs --bots 80      # full evening with Playwright, screenshots to docs/screens
```

## Game module contract

A game is three files plus a test. It touches nothing else. The engine registers
server modules in `src/games/index.js` and client modules in `public/games/index.js`
(play order comes from the server list).

### `src/games/<id>.js` (server, pure functions, no I/O)

```js
import data from "../../public/data/<id>.js";
export default {
  id: "<id>",                 // short, lowercase; roundIds are "<id>-<round>"
  title: "BINKY",             // shown on the intro card
  tagline: "WHERE'S THE...",  // one line under the title
  icon: "binky",
  rounds: 3,
  data,
  roundTime(round) { return 45000; },     // ms of play
  autoEnd: true,       // end early once every connected human has sent a final answer
  progressive: false,  // true = the answer is updated repeatedly during play (find/catch/pack);
                       //        the engine then never auto-ends and never shows the LOCKED IN overlay
  maxPoints(round) { return 1000; },      // used for PERFECT ROUND and the how-to card

  howto(round, content) {                 // the how-to card (phone + TV)
    return { title: "ROUND 1: NURSERY", text: "TAP THE 5 HIDDEN ITEMS.", demo: "tap", points: "UP TO 1000 PTS" };
  },

  // Public content for this round. Sent to every phone; MUST NOT contain the answer.
  // ctx = { roundId, round, seed, rng, rngFor(tag), data, roundTime, players, results, order }
  //   rng is seeded per round and content() is cached, so it is safe to use there. score(),
  //   revealData() and every bot's botAnswer() share ONE ctx (and one rng object), so when you
  //   need the same deterministic draw across those calls use ctx.rngFor("cards") for a fresh,
  //   identically seeded generator each time.
  content(round, ctx) { return { ... }; },

  // answers: { playerId: { a: <whatever the client submitted>, t: msSinceRoundStart, final } }
  // Return { playerId: points } (0..maxPoints). Players missing from answers score 0.
  score(answers, round, ctx) { ... },

  // What the reveal animation needs (correct answer, per-player summaries, best three...).
  revealData(answers, round, ctx, pointsById) { ... },

  // Optional: a small object for the host STAGE view / TV during play (throttled to ~2/s).
  liveStat(answers, round, ctx) { return { answered: Object.keys(answers).length, bars: [...] }; },

  // Optional: content for the PRACTICE ROUND the host can switch on from the how-to
  // screen. The game's simplest level. Phones run it on their own clock and nothing
  // reaches the server, so it may carry the answer. practiceMs defaults to roundTime(1).
  practice(ctx) { return { ...simplestContent, practiceMs: 30000 }; },

  // A plausible bot answer. rng is seeded. Return { a, delayMs } (delayMs within the round).
  botAnswer(round, ctx, bot, rng) { ... }
};
```

Scoring helpers in `src/scoring.js`: `closeness`, `speedPoints`, `relative`,
`orderingPoints`, `rankBy`, `clamp`, `MAX`.

### `public/games/<id>.js` (client)

```js
export default {
  id: "<id>",
  progressive: false,                 // same value as the server module

  howtoDemo(el, content) { ...; return () => stopDemoLoop(); },   // optional animated demo loop

  // Render the round's input into el. api:
  //   api.submit(answer, { final = true, label })  -> label shows on the LOCKED IN overlay
  //   api.timeLeft() ms, api.roundTime ms, api.now() server clock
  //   api.sfx(name), api.vibrate(pattern), api.you() {id,name,avatar,points,rank,myAnswer,answered}
  //   api.players() rows, api.live() latest liveStat, api.big (TV/STAGE), api.tv
  mount(el, content, api) { ... },
  unmount() { ... },                  // stop timers/listeners (also called when the round ends)

  // Optional: called with each liveStat broadcast while playing (phones too).
  onLive(stat) { ... },

  // Optional: grade a practice try (the practice content may carry the answer).
  practiceResult(answer, content) { return { ok: true, text: "PERFECT!" }; },

  // The answer reveal. reveal = revealData() from the server; api.results.board has every
  // player row ({id,name,avatar,points,rank,roundPoints}); api.content is the round's
  // content(); api.you() is null on the TV.
  reveal(el, reveal, api) { ... },

  // Optional: TV / host STAGE during play. Return { update(live, snap) }.
  stageView(el, content, api) { ... },

  // Rehearsal only (?auto=1 on a phone): interact like a human would and submit.
  autoplay(el, content, api) { ... }
};
```

Client helpers: `public/engine/dom.js` (`h`, `appendTo`, `clear`, `wait`,
`countUp`, `fmtMoney`, `ordinal`, `rain`, `toast`), `public/engine/avatars.js`
(`spriteEl`, `avatarName`), `public/engine/audio.js` (`sfx` names: blip select back
coin start jump thunder slash whoosh spin win over error tick tock buzzer thunk drum
fanfare pop up down), `public/engine/moves.js` (`playMove(avEl, name)`).

### `public/data/<id>.js`

Plain `export default { ... }` the host can edit. Imported by both sides.

### Rules

- The server scores. The client never computes points.
- Content must be identical on every phone: anything random comes from `ctx.rng`
  (server) or from a seeded RNG using `content.seed` that the server put there.
- Phones are small: big tap targets, `touch-action: none` on game surfaces (the
  engine already sets `.game-surface`), nothing hover-only, no horizontal scroll.
- Keep answers small (under 4 KB JSON).
- Unit-test `score()` in `test/<id>.test.js` with `node --test`.
- Never `el.append(maybeNull)`: use `appendTo(el, ...)` from `engine/dom.js`.

## Running the night

1. Print the join cards (`print/join-card.pdf`) or show the TV page's QR.
2. Open `/host` on your phone, enter the PIN. Keep the phone plugged in.
3. Optional: open `/tv` on a laptop or TV browser, tap "YES, PLAY IT" for sound, go fullscreen.
4. Watch players pile into the lobby. Kick anyone rude. Press **START GAME**.
5. From then on the big **NEXT** button always does the right thing, and nothing moves
   without you: each round's how-to screen waits for your **START ROUND** tap, and the
   reveal, results and leaderboard each wait for **NEXT**. Round timers run on the
   server, so you can lock your phone mid-round and the round still ends on time.
6. Use **+15 SEC** if people need more time, **PAUSE** for a toast, **SKIP** to move on,
   **END ROUND NOW** to cut a round short. **AUTO-END** (default on) ends a round a
   moment after every connected player has locked in; turn it off if you'd rather
   always run the full clock.
7. Price Is Right and Put It In Order count whatever a player's slider or tile order
   shows when time runs out, so slow lockers-in still score.
8. If a room looks confused on a how-to screen, tap **PRACTICE**: every phone runs the
   game's simplest level (Where's the Binky, Diaper Dash, Put It In Order and Fit the
   Diaper Bag have one) with nothing scored, as many tries as they like, until you press
   **START ROUND**. Tap it again to go back to the how-to card.
9. After the last game: **FINAL RANKINGS**, then **PREDICTIONS**, then **ROLL CREDITS**.
10. Download the leaderboard and the predictions as CSV from the host page.

Rehearse beforehand: **+80 BOTS**, **START GAME**, and tap through. **HOLD TO RESET**
wipes scores and answers (players stay) when you are done.

### The games, in order

| # | Game | Rounds | Time | Input |
|---|---|---|---|---|
| 1 | Price Is Right: Baby Edition | 3 | 15 s | slider (tap/drag anywhere, − / +) |
| 2 | Where's the Binky? | 3 | 45 s | tap the 5 hidden items; round 2 is a tall pile you drag through; round 3 is dark with a flashlight |
| 3 | Mom or Dad? | 2 (3 with photos) | 32 s | swipe left/right, 5 cards |
| 4 | Diaper Dash | 3 | 20 s | tap the falling pacifiers (+1) and gold bottles (+3), dodge poopies (−1) and vomit (−5); every item falls at its own speed, round 3 adds wind |
| 5 | Put It In Order | 3 | 30 s | drag 5 tiles into order |
| 6 | Fit the Diaper Bag | 2 | 60/75 s | drag items into a grid bag, tap to rotate; more stuff than fits, so pack tight |
| 7 | Boss Battle | 5 | 10 s | 4-option quiz, double points, hits the boss |

If the wifi dies: phones reconnect on their own and show the current phase within a
second of being back online. Submitted answers are kept. If the venue wifi is hopeless,
tell people to use mobile data: the game is tiny.

## Rehearsal results

`node scripts/rehearse.mjs --bots 80` drives a host phone, two auto-playing phones and
the TV through all 22 rounds plus the final, predictions and credits, screenshotting
every phase into `docs/screens/full/` (player, host, TV). Last run: all phases
reached, **0 browser errors, 0 server errors**.

`node scripts/robustness.mjs` checks the failure modes that matter on the night. Last run:

| Check | Result |
|---|---|
| Phone offline for 20 s mid-round, then back | reconnected in 13 ms, phase correct |
| Answer submitted before the outage | preserved, shown on the reveal |
| Phone reloaded mid-game | same player, same points, leaderboard rebuilt with their row |
| Host phone closed mid-round | round ended and scored on the server clock |

`node scripts/practice-flow.mjs` checks the practice round on Put It In Order: the host
toggle, the graded overlay after LOCK IN, TRY AGAIN, toggling off, and START ROUND
clearing it, with nothing reaching the server. Last run: all checks pass.

## Deploying (one command once the secrets exist)

The Worker, the Durable Object and the static files deploy together. The custom
domain `baby.thenerdnextdoor.ca` is created on first deploy because the zone is on
the same Cloudflare account (see `routes` in `wrangler.jsonc`).

```sh
cd game
npm install
# Either log in interactively on your own machine...
npx wrangler login
# ...or, in a cloud session, have CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
npx wrangler secret put HOST_PIN        # the PIN for /host; pick 4-6 digits, never commit it
npx wrangler deploy
```

Then open `https://baby.thenerdnextdoor.ca/host`, enter the PIN, and you are live.
Redeploys are safe mid-evening: the room's state lives in Durable Object storage, and
phones reconnect on their own.

To change the PIN later: `npx wrangler secret put HOST_PIN` again (existing host
sessions keep their token until the next **RESET GAME**). To wipe everything, use
**HOLD TO RESET** on the host page.

### Cost

Workers Paid already covers it. One evening is roughly 85 WebSocket connections, a few
thousand incoming messages (billed at a 20:1 ratio) and under a minute of Durable
Object compute, all inside the plan's included allowance (1 million requests and
400,000 GB-s per month). Expected extra charge: $0.

## What the hosts fill in before the party

| Where | What |
|---|---|
| `public/data/momordad.js` | The `answer` for each fact and prediction card ("mom"/"dad"); drop 5+ baby photos into `public/assets/babyphotos/` and list them in `photoCards` (see the README.txt there) |
| `public/data/price.js` | Re-check prices the week of the party; swap any item that is on the registry for a spare (list at the bottom of the file) |
| `public/data/boss.js` | Optional: swap in your own trivia |
| `public/data/avatars.js` | Generated from `scripts/roster.json`; remove characters you don't want and rerun `python3 scripts/make-avatar-palettes.py` |
| Cloudflare secret `HOST_PIN` | The host PIN |

After any data edit: `npm test` then `npx wrangler deploy`.
