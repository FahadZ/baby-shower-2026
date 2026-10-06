# Build brief for Claude Code: "Baby Loading.. Party Games" (v1)

Paste everything below the line into Claude Code, run from a clone of this repo.
Like `PROMPT.md`, keep personal details (PIN, tokens) out of committed files.

## How to run it

| | Recommendation |
|---|---|
| Model | **Claude Opus 5.5** (Fable 5.1 if your plan has it; it is the stronger model for the server state machine and the animation work) |
| Effort | **high** for the whole build. Go to **max** only if a session gets stuck on sync bugs or timing drift. Lower effort will cut corners on the leaderboard animations and reconnect handling, the two things that make or break this on the day. |
| Mode | Start in **plan mode**, approve the plan, then let it run. One engine session, then six game sessions in parallel, then integration and polish (see *Phasing* and *Expected timeline* at the end). Every session ends with pushed, working code. |
| Before session 1 | Add two values to the Claude Code cloud environment (cloud environment menu in the session title bar → Edit → API credentials, or environment variables): `CLOUDFLARE_API_TOKEN` (a token with Workers Scripts: Edit, Workers Routes: Edit, DNS: Edit for thenerdnextdoor.ca) and `CLOUDFLARE_ACCOUNT_ID`. Never paste them into the chat. A new session picks them up. |
| Still open | (a) Strike any Price Is Right candidate that is on your registry (see game 1). (b) Trim or extend the character roster list (see *Character select*). (c) Commit your Fit the Diaper Bag design (images, sketches or notes) to `game/docs/diaper-bag-design/` before the game sessions start. |

---

# The prompt (paste everything below this line)

You are my game designer, pixel-art director, full-stack developer and QA. Build a
live, host-controlled party game into this repo (FahadZ/baby-shower-2026) that up to
**80 guests** play on their phones after scanning a QR code. Make routine creative and
technical decisions yourself. Only stop to ask me if an account login or permission
blocks you, or if an action would cost money beyond my existing Cloudflare Workers Paid
plan. Do not buy or sign up for anything new.

## Context: what already exists

- Read `README.md`, `index.html`, `styles.css`, `app.js`, `config.js` first. The RSVP
  site is plain HTML/CSS/JS, no framework, no build step, on GitHub Pages at
  https://fahadz.github.io/baby-shower-2026/. Do not change the RSVP flow. Guests reach
  the game by QR only; nothing on the RSVP site links to it.
- Reuse the visual system exactly: the CSS variables in `styles.css`, the Press Start 2P
  font, cream panels with pixel borders, the brick stage, clouds, falling blocks,
  sparkles and hearts from `assets/deco/` and `assets/scene/`.
- The signature moves coded in `app.js` (Pikachu Thunderbolt, Cloud Cross Slash, Link
  Spin Attack, Kirby copy ability) and the 8-bit sound effects and chiptune theme in
  `assets/audio/` are reusable. Factor the moves into a shared module the game can call.
- `scripts/bump-version.sh` stamps a build number for cache busting on the RSVP site.
  The game has its own deploy (below) so it does not need it, but keep the RSVP site's
  flow intact.

## Architecture: phones first, server authoritative

**Primary mode is phones only.** There may be no TV at the venue. So every phone must
render the complete experience, including the full leaderboard show, and the host's
phone must be able to run the entire evening on its own. A TV page exists as a bonus for
when a screen is available.

**Backend: Cloudflare Workers + one Durable Object, deployed to a subdomain of
thenerdnextdoor.ca** (I have Workers Paid; the Cloudflare API token and account id are
in the environment as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).

- The whole game is one Worker project in `game/`: `wrangler.jsonc`, `src/` (Worker +
  Durable Object), `public/` (static front end served with Workers Static Assets). One
  `wrangler deploy` ships both. Bind the custom domain **baby.thenerdnextdoor.ca**
  (the zone is already on my Cloudflare account). Vendor nothing from CDNs; all
  front-end code is plain JS modules in `public/`.
- **One Durable Object instance is the game room.** Use the WebSocket Hibernation API
  (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`; never `ws.accept()` or
  `addEventListener` inside the DO). It supports thousands of sockets per object, so 80
  phones plus a host and a TV are nothing. Use `serializeAttachment` so a player's
  identity survives hibernation. Persist all state (players, answers, scores, phase) in
  the DO's SQLite storage so a deploy or an eviction loses nothing.
- **The server owns time and truth.** Round timers are DO alarms: when a round starts
  the DO writes `endsAt` and sets an alarm; when it fires the DO locks the round, scores
  it with `src/scoring.js`, computes ranks and deltas, and broadcasts. Phones only render
  countdowns from `endsAt` minus a measured clock offset (ping/pong on connect). Phones
  never compute scores. The host phone can lock, die or lose signal mid-round and the
  round still ends and scores on time.
- Messages are small JSON. Server → everyone: `state` snapshots `{ phase, gameId,
  round, roundId, endsAt, serverNow, playerCount, content }` on every change. Server →
  one player: `you { playerId, points, rank, prevRank, roundPoints, roundRank }`. Server
  → everyone on results: `results { mvp[3], callouts[], top10[], everyone[] }` (80 rows
  of `{id, name, sprite, points, rank, delta}` is still a tiny payload). Client → server:
  `join`, `hello` (resume), `answer`, `ping`, and host-only commands with the host token.
- **Auth.** Host PIN is a Worker secret (`HOST_PIN`, set with `wrangler secret put`,
  never committed). The host page exchanges the PIN for a signed host token stored in
  localStorage. Players get a random id on first join, kept in localStorage; `hello
  {playerId}` resumes the same player after a refresh, a lock-screen, or a network drop.
  Rate-limit joins and answers per socket; cap names at 16 chars; strip markup.
- Late joiners can join at any phase with 0 points and play from the next round.
- Cost: with the hibernation API and this traffic the evening stays inside the plan's
  included allowance. Confirm the estimate in the README.

## The three pages (all in `public/`)

- `index.html` (**player**): what the QR opens. Join, play, results, leaderboard. This
  is where the hype engine lives in full.
- `host.html` (**host**): PIN-gated remote. A giant "NEXT" button that always does the
  obvious next thing, plus "+15 s", "END ROUND NOW", "SKIP ROUND", "SKIP GAME",
  "REPLAY REVEAL", "PAUSE", "KICK PLAYER", "ADD/REMOVE BOTS", and a long-press
  "RESET GAME" with confirmation (clears answers and scores, keeps players). It mirrors
  the current phase, round, timer and answer count so the host never needs another
  screen. It has a **STAGE toggle** that turns the host phone into a big-text version of
  the TV view for passing around or plugging into a speaker (this view carries the
  audio). The host can also play from a second phone; the host page itself does not play.
- `tv.html` (**stage, optional**): the same components scaled for 1080p, with the QR and
  the join URL in the lobby, audio on, and a wake lock. Works whenever it is open; nothing
  depends on it.

## Character select (player avatars)

Players pick from a **roster of 40 or more popular video game characters**, not just the
ten on the invite, so 80 guests rarely double up. Rules:

- Never draw, generate or recreate characters. Source each one as a PNG sprite file from
  sprite archives (The Spriters Resource, the character's fandom wiki, and similar; these
  are fetchable from the build environment). Put them in `public/assets/avatars/`,
  normalised to the same height, transparent background, crisp pixels. The ten existing
  sprites in `assets/sprites/` are part of the roster.
- Roster to aim for (skip any you can't source cleanly): Mario, Luigi, Peach, Toad,
  Yoshi, Bowser, Donkey Kong, Diddy Kong, Wario, Link, Zelda, Samus, Kirby, Meta Knight,
  Pikachu, Charmander, Squirtle, Bulbasaur, Eevee, Jigglypuff, Snorlax, Sonic, Tails,
  Knuckles, Shadow, Pac-Man, the four Pac-Man ghosts (Blinky, Pinky, Inky, Clyde), Mega
  Man, Ryu, Chun-Li, Cloud, Chocobo, Crash Bandicoot, Spyro, Frogger, Q*bert, Space
  Invader, Tetris blocks, Minecraft Steve, Creeper, Among Us crewmate (several colours),
  Fall Guy, Master Chief, Lara Croft, Kratos, Sackboy, Isabelle, Tom Nook, Pikmin, Slime
  (Dragon Quest), Cuphead, Shovel Knight, Hollow Knight.
- `data/avatars.js` is the data source: slug, display name, franchise, file, and which
  signature move to play (one of the four coded moves or the generic jump + sparkle).
- **Every avatar is unique: no two players share the same character in the same
  colour.** Give each character four palette variants (P1 is the original, P2–P4 are
  "alternate costume" colours like a fighting game's colour select), so the roster
  offers 160+ unique picks for 80 guests. Generate the variants offline with a script
  (`scripts/make-avatar-palettes.mjs`, Node + pngjs) that hue-shifts the saturated
  colours of each sprite while preserving black outlines, whites, greys and skin tones;
  write the results as `mario-p2.png` etc. and review every variant by eye, replacing
  any that looks wrong with a hand-picked palette in the script's overrides table. Do
  this at build time, not in the browser, so every phone shows identical pixels.
- Pick screen: a scrollable "CHARACTER SELECT" grid grouped by franchise with a search
  box and a random button; big tap targets; tapping a character cycles its colours
  (P1 → P2 → P3 → P4) and the sprite does its move on confirm. The server owns the
  taken list: a taken character+colour is greyed with "TAKEN" and the next free colour
  is offered automatically. Bots take real slots too so rehearsals reflect a full room.
  A player can change avatar from the lobby until the host presses START.

## Join flow and lobby

1. Scan QR (or type the short URL) → "PLAYER SELECT": display name (max 16, uniqueness
   enforced with a friendly nudge), character select, "READY".
2. Phone shows "WAITING FOR PLAYER 1 TO PRESS START" with the sprite idling and a live
   "42 PLAYERS JOINED" counter.
3. Host page lobby: player list with sprites, kick buttons, player count, "START GAME".
4. TV lobby (if open): QR huge, join URL, and the brick stage filling with every joined
   sprite bouncing in with its name, like the invite. Theme music plays.
5. "Player 3", the baby, is a phantom on the stage with "LOADING.." over its head. It
   does not score.
6. Generate `print/qr-game.png` and a printable one-pager (`print/join-card.pdf`, A6
   cards, four per page) with the QR and "SCAN TO JOIN" so cards can sit on every table.

## Round flow and timing

Every round follows the same beat (phases: `lobby → intro(game) → howto(round) →
playing → locked → reveal → results → leaderboard → …→ final → predictions → credits`):

1. **How-to (auto):** game name, one-line instructions, an animated demo loop of the
   mechanic, and the point value. 8 s for round 1 of a game, 4 s after.
2. **Playing (timed, per game):** phones show the input and a pixel countdown bar
   (green → red in the last 5 s). Submitting early locks the phone with "LOCKED IN ✓".
3. **Locked (1 s, server):** "TIME!" stamp slams on.
4. **Reveal:** the correct answer with a game-specific animation.
5. **Results (host presses NEXT):** see *Hype engine*.
6. **Leaderboard (host presses NEXT):** see *Hype engine*.

Timing rule: anything a guest could Google gets **10–15 s**. Anything hands-on
(finding, sorting, swiping, catching) gets **30–45 s**.

## Hype engine (after every round, on every phone)

This is the heart of the build; spend real effort here. Phones carry the whole show
because there may be no TV. The TV and the host's STAGE view show the same sequence
larger, with sound.

**Round results (every phone, same timing, driven by one server message)**
- "ROUND MVP" podium: the top three for *this round* enter 3 → 2 → 1 with sprite, name
  and round points counting up. The #1 sprite plays its signature move. Coin tick per
  100 points.
- Callouts, one at a time with a slam-in, only when true: "PERFECT ROUND", "SPEED DEMON"
  (fastest correct), "PHOTO FINISH" (top two within 50 points), "FIRST BLOOD" (first
  points ever for a player).

**Personal card (each phone)**
- Your round points count up: "YOU PLACED 4TH THIS ROUND".
- Then "YOU'RE #7 OF 80" in big type with "▲ UP 3 SPOTS" / "▼ DOWN 1" / "HOLDING
  STEADY". Haptic buzz on Android.
- Then the gap, phrased to motivate: "120 PTS BEHIND #6 · 40 PTS AHEAD OF #8"; for #1
  "YOU'RE WINNING BY 210 PTS"; for last "NOWHERE TO GO BUT UP".
- Your sprite celebrates on climbing, sulks with a "..." bubble on falling.

**Leaderboard (each phone)**
- Top 10 rows animate from old to new positions (FLIP animation, rows sliding past each
  other, 600 ms), green "▲3" / red "▼2" badges, totals counting up with a slot-machine
  tick. Then your own row with the three above and below you, highlighted. Then a
  "FIND ME" button that scrolls the full 80-row list to you.
- "NEW HIGH SCORE" banner with hearts and sparkles when #1 changes hands. "BIGGEST
  CLIMB" for the largest jump of the round (≥3 places). "COMEBACK" when someone from
  the bottom half enters the top five.
- Respect `prefers-reduced-motion`: keep the information, drop the motion.

## Scoring (`src/scoring.js`, pure functions, unit-tested with `node --test`)

Every round is worth **up to 1000 points**; the boss round up to 2000.
- Closeness (slider): `1000 × clamp(1 − |guess − answer| / answer, 0, 1)^2`, +150 if
  within ±10%.
- Correct with speed: `600 + 400 × (timeLeft / roundTime)`, else 0.
- Per-item (find, swipe): item value × count + a completion speed bonus.
- Relative (reflex): `1000 × yours / best`.
- Ordering: `1000 × (concordant pairs / total pairs)`, +200 for perfect.
Ties share a rank (1, 1, 3). Ranks recompute from totals after every round.

## The games (6 games × 3 rounds + a 3-question boss = 21 rounds; any round can be skipped from the host page)

All content lives in `public/data/*.js` as plain objects I can edit without touching
code. Write all copy in the playful game voice already used on the site.

### 1. PRICE IS RIGHT: BABY EDITION  (slider · 15 s · Googleable, so short)
Guess the Canadian retail price of a real baby item. Phone: a big pixel slider with the
value in a price tag above the thumb; range and step per item. Round 1: one everyday
item that is surprisingly pricey. Round 2: a "STARTER BUNDLE" of three mid-priced items
shown together; guess the total. Round 3: one big-ticket item. Reveal: a price line with
every player's guess as a tiny sprite marker, then the real price tag drops in and the
closest three markers light up; the phone shows your guess vs the real price.

**You do the price research; it is part of this build.** Rules:
- Prices are current **Canadian** sticker prices in CAD, verified on a live retailer page
  (well.ca, indigo.ca, snugglebugz.ca, westcoastkids.ca, toysrus.ca, bestbuy.ca,
  canadiantire.ca, walmart.ca, amazon.ca, costco.ca, or the brand's Canadian store).
  Record for each item: exact product name and variant, retailer, price, regular vs sale
  price, URL, and the date checked, in `public/data/prices.js`. No prices from memory or
  from search snippets.
- Candidates (do not use anything on my registry; I will strike those from this list):
  Sophie la Girafe teether · Frida Baby NoseFrida · Pampers Swaddlers Size 1, largest
  box (and price per diaper) · Enfamil A+ 942 g · Dr. Brown's Options+ newborn gift set ·
  Diaper Genie Complete or Munchkin Step pail · Boppy Original · Hatch Rest 2nd Gen ·
  Owlet Dream Sock · Nanit Pro · BabyBjörn Bouncer Bliss · Ergobaby Omni Breeze · Stokke
  Tripp Trapp · Baby Brezza Formula Pro Advanced · Skip Hop 3-Stage Activity Center ·
  4moms MamaRoo Multi-Motion · SNOO Smart Sleeper (buy and monthly rental) · Doona Car
  Seat & Stroller · UPPAbaby Vista V3 · Bugaboo Fox 5 · Nuna PIPA rx · Elvie Stride ·
  IKEA SNIGLAR crib · Keekaroo Peanut changer · Graco 4Ever DLX.
- Pick the three rounds for maximum surprise (a cheap thing that costs more than people
  think, a bundle whose total is hard to eyeball, a big-ticket item with a wide range)
  and keep four spares in the data file so I can swap. Add an optional bonus reveal line
  for round 3: "that's N boxes of diapers" using the per-diaper price.
- Present the final list to me for confirmation before the party, and note in the README
  that prices should be re-checked the week of the party.

### 2. WHERE'S THE BINKY?  (tap to find · 45 s · hands-on, so long)
A busy pixel scene with five hidden baby items. Phones show it full-screen with pinch
zoom disabled and a generous tap hit radius; found items get a pixel ring and a coin
sound; a "3/5" counter sits on top. Build scenes procedurally so every phone gets the
identical layout: a seeded scatter of a few hundred small pixel glyphs (toys, blocks,
clouds, fruit, emoji rendered as images at the site's pixel scale) with the targets
(pacifier, bottle, rattle, sock, rubber duck) placed by the seed. Round 1: nursery
clutter. Round 2: "DIAPER BAG EXPLOSION", denser, targets partly overlapped. Round 3:
"NIGHT FEED": the scene is dark and your finger is a flashlight. 200 points per item
plus a speed bonus for all five. Reveal: zoom to each hidden item in turn; the host
STAGE view and TV show the live found tally streaming in during play.

### 3. MOM OR DAD?  (swipe left/right · 6 s per card, 5 cards per round · not Googleable)
Cards swipe Tinder-style: left = Mom, right = Dad. Round 1: "WHO IS THIS BABY?" using my
baby photos from `public/assets/babyphotos/` (I will supply them; build a template
folder with `mom-1.jpg … dad-5.jpg` naming and a README line). Show photos inside a
pixel frame; do not pixelate the photos themselves. Round 2: "WHO WAS THIS BABY?"
childhood facts. Round 3: "WHO WILL…?" predictions the parents answered in advance.
Ship `public/data/momordad.js` with 15 draft questions and `answer: ""` for me to fill;
skip any card left blank. 200 points per correct card, +100 for a five-card streak.
Reveal: each card flips with the photo or the parent's sprite (assign each parent a
sprite in config) and the room's split percentage.

### 4. DIAPER DASH  (reflex arcade · 20 s · hands-on)
Things fall from the top of the phone; tap the good stuff, avoid the bad. Round 1:
catch pacifiers, avoid dirty diapers (−1 each). Round 2: faster, with golden bottles
worth 3. Round 3: "TWINS": the screen splits and two streams fall at once. Pure
pointer events, 60 fps, no device-motion permissions. Relative scoring (best = 1000).
Reveal: top five catch counts as a bar race; the host STAGE view and TV show the race
live during play.

### 5. PUT IT IN ORDER  (drag to sort · 30 s · semi-Googleable)
Five tiles, drag into order. Round 1: diaper change steps. Round 2: milestones by
typical age (first smile, rolls over, sits up, crawls, first word, walks: pick five).
Round 3: baby gear cheapest to priciest (reuse the researched prices). Touch drag with
page scroll disabled and a ghost tile; a "LOCK IN" button. Reveal: tiles snap into the
right order one by one with a check or cross per position.

### 6. FIT THE DIAPER BAG  (grid packing · 45 s · hands-on)
Pack as much as you can into the diaper bag before time runs out. **My own design for
this game is in `game/docs/diaper-bag-design/`; follow it for look and item list, and
apply the mechanics below so it stays crisp on every phone.**
- Mechanics: the bag's interior is a grid (about 8 × 10 cells) in a bag-shaped
  silhouette, drawn at the site's pixel scale. Items are Tetris-like shapes drawn from
  the item list (pacifier 1×1, bottle 1×3, wipes 2×2, diaper pack 3×3, onesie L-shape,
  blanket 4×2, teddy T-shape, snack pouch 1×2, and so on), each with a pixel icon.
  Items sit in a tray below the bag; drag one into the bag, it snaps to the grid, tap it
  to rotate 90°, drag it back out to remove. Invalid placement (overlap or outside the
  silhouette) shakes red and bounces back. Use pointer events with `touch-action:
  none`, a ghost preview under the finger, and a pixel "thunk" sound on snap. Snapping
  to a grid is what keeps this from looking sloppy: never free-form or physics-based
  placement.
- Scoring: cells covered, plus item values (essentials like diapers, wipes and a bottle
  are worth more; forgetting any essential costs 100). Relative scoring: best packer
  gets 1000.
- Round 1: the everyday bag. Round 2: "DAY TRIP", a bigger, oddly shaped bag with more
  items than can fit, so choices matter. Round 3: "TWINS": two of every essential and a
  30 s timer.
- Reveal: the winner's packed bag is shown with its items dropping in one by one; then a
  fill-percentage bar race for the top five. The host STAGE view and TV show live fill
  percentages during play.

### 7. BOSS BATTLE  (4-option quiz · 10 s per question · 3 questions · double points)
The classic format, saved for last and framed as a boss fight: each correct answer deals
damage to a pixel boss built from the deco assets (a giant pacifier or crying-baby boss;
no new characters). Write ten baby-trivia questions with surprising answers in
`public/data/trivia.js`; the host picks three at runtime. Up to 2000 points per question
with speed. The boss falls when the room's total damage crosses a threshold scaled to
player count, triggering a big victory animation on every phone.

### Finale
- "PREDICTIONS" (not scored): due date, weight, who the baby looks like, first word.
  Stored in the DO and downloadable as CSV from the host page; also POST them to the
  existing Apps Script endpoint with `kind: "prediction"` (add a branch to `doPost` and a
  "Predictions" tab) so they land in the RSVP Sheet.
- "FINAL RANKINGS": drum roll, then 3rd, 2nd, 1st revealed with rising suspense, the
  winner's sprite doing its move under falling blocks and hearts, the full leaderboard
  on every phone with "FIND ME", and a "THANKS FOR PLAYING" screen with the site's
  victory stage.

## Rehearsal mode

Bots live in the server: the host page has "ADD 80 BOTS" and "REMOVE BOTS". Bots join
with random roster sprites and names and answer every round with plausible randomness
and timing, so I can rehearse the whole evening alone from one phone and see every
animation at full player count. Bots are labelled and never win ties against humans.
Also `host.html?demo=1` auto-advances every phase on a timer.

## Robustness checklist (test every item, write the results in the README)

- iOS Safari and Android Chrome at phone width; no horizontal scroll; `100dvh`;
  `touch-action: none` on game surfaces; pull-to-refresh and double-tap zoom disabled
  during play; inputs at 16px+ so iOS doesn't zoom.
- Screen lock → unlock → correct phase within 1 s. Airplane mode for 20 s → reconnect →
  correct phase, submitted answer preserved. Host phone dies mid-round → round still
  ends and scores on time.
- 80 bots answering in the same second → scored once, correctly, in under 1 s.
- Deploy mid-evening → players reconnect automatically with no lost state.
- Wake lock on host and TV pages. Next round's images preload during the leaderboard.
- Reduced motion honoured everywhere; every screen readable without colour.

## Deliverables

- `game/` Worker project: `wrangler.jsonc`, `src/` (Worker, Durable Object, scoring,
  bots), `public/` (three pages, `game.css`, `engine/` for sync/hype/audio, `games/` one
  module per game, `data/`, `assets/avatars/`, `assets/babyphotos/` template), tests,
  and `game/README.md`: how to run the night step by step, what to edit, how to
  rehearse, what to do if the wifi dies, how to redeploy, cost estimate.
- Deployed to the subdomain with a custom domain binding; `HOST_PIN` set as a secret
  (tell me how to change it).
- `print/qr-game.png` and `print/join-card.pdf`.
- Unit tests for scoring runnable with `node --test`; a rehearsal run with 80 bots
  through every phase; screenshots at phone width of every player screen and at 1080p
  of every TV screen in `game/docs/screens/`.
- Finish with: the live game URL, the host URL and where the PIN lives, the Price Is
  Right list for my confirmation, the list of data files I must fill in (baby photos,
  Mom or Dad answers), and anything I need to do manually.

## Phasing

1. **Engine:** Worker + Durable Object, join flow, character select with the full
   roster, lobby, host remote with STAGE view, TV page, state machine, scoring, hype
   engine, bots, and one game (Price Is Right, including the price research).
   Rehearse end to end with 80 bots.
   Write `game/README.md#game-module-contract` (below) and ship Price Is Right as the
   reference implementation of it, so the game sessions in phase 2 can run in parallel.
2. **Games, in parallel:** one session per game, each on its own branch from the
   phase 1 branch, using the *Game session prompt* below: Where's the Binky?, Mom or
   Dad?, Diaper Dash, Put It In Order, Fit the Diaper Bag, Boss Battle.
3. **Integration:** one session merges the six branches, resolves conflicts, runs the
   80-bot rehearsal through all 21 rounds, fixes what breaks, deploys.
4. **Polish:** predictions, finale, audio pass, robustness checklist, printables,
   README, final rehearsal.

## Game module contract (phase 1 writes this; every game follows it)

A game is three files plus tests, and touches nothing else:
- `public/games/<id>.js` exports `{ id, title, tagline, rounds, howto(round),
  mount(el, content, api), unmount(), reveal(el, revealData, api) }`. `api` gives
  `submit(answer)`, `timeLeft()`, `sfx(name)`, `me()`, and `players()`. Mount renders
  the round's input; reveal renders the answer animation. No game talks to the socket
  directly.
- `src/games/<id>.js` exports `{ id, content(round, data), score(answersById, round,
  data) → pointsById, revealData(answersById, round, data), botAnswer(round, data,
  bot) }`. Pure functions, no I/O, unit-tested.
- `public/data/<id>.js`: the editable content.
- The engine registers games from `src/games/index.js` and `public/games/index.js` in
  play order. Live-tally hooks (`liveStat(answersById)`) are optional and feed the host
  STAGE view and TV during play.

## Game session prompt (paste one per game, in parallel sessions)

> You are implementing the game **<NAME>** for the party game in this repo. Start from
> branch `<phase-1 branch>` and work on branch `game/<id>`. Read `game/README.md`,
> especially the game module contract, and read `src/games/price.js` and
> `public/games/price.js` as the reference implementation. Then read the spec for
> <NAME> in `GAME-PROMPT.md`. Build the three files, bot answers, unit tests for
> scoring, and the how-to demo loop. Do not edit engine files; if the contract is
> missing something you need, add the smallest possible extension and document it in
> the README under "contract changes" so the integration session can reconcile it.
> Test on a local `wrangler dev` with 30 bots at phone width, save screenshots of every
> screen of this game to `game/docs/screens/<id>/`, commit and push the branch. Do not
> deploy.

## Expected timeline (wall-clock, assuming you answer questions within the hour)

These are estimates for autonomous Claude Code sessions. Sessions vary; the real risks
are the first Cloudflare deploy and iOS quirks that only show up on real phones.

| Step | Sessions | Agent time | Your time |
|---|---|---|---|
| Your prep: Cloudflare token, subdomain choice, baby photos, Mom or Dad answers, registry strike-through | – | – | 1–1.5 h |
| Phase 1: engine + Price Is Right + research + first deploy | 1 | 4–6 h | 30 min (plan approval, deploy hiccups) |
| Phase 2: six game sessions in parallel | 6 | longest one 3–4 h (Diaper Bag and Binky are the big ones; Boss Battle is about 1.5 h) | 30 min |
| Phase 3: integration + 80-bot rehearsal | 1 | 2–3 h | 15 min |
| Phase 4: polish, finale, printables, README | 1 | 3–4 h | 15 min |
| Real-phone rehearsal with 5–10 friends, then one fix session | 1 | 1–2 h | 1.5 h |

Total agent time about 15–20 hours; **wall-clock about 3 working days** with the game
sessions in parallel (about 5 days if run one at a time). With the party on October 17,
aim for: engine by day 1, games and integration by day 2, polish by day 3, real-phone
rehearsal by October 13, and code freeze on October 15.
