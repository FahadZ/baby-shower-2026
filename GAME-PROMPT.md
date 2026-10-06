# Build brief for Claude Code: "Baby Loading.. Party Games" (DRAFT v0)

> **Status: draft, not final.** Open decisions are listed at the top. Once we settle
> them I'll trim this to the final paste-ready prompt (the same way `PROMPT.md` works).

## How to run it

| | Recommendation |
|---|---|
| Model | **Claude Opus 5.5** (use Fable 5.1 if your plan has it; it is the stronger model for the real-time state machine and the animation work) |
| Effort | **high** for the whole build. Switch to **max** only if a session gets stuck on sync bugs or timing drift. Low/medium will cut corners on the leaderboard animations and the reconnect handling, which are the two things that make or break this on the day. |
| Mode | Start in **plan mode**, approve the plan, then let it run. Budget three sessions, one per phase (see *Phasing* at the end). Each phase ends with a pushed, working site. |
| Prereqs you do yourself | Create a free Firebase project (5 minutes, no credit card, same Google account as the RSVP Sheet). The prompt tells Claude to walk you through it step by step and to use the `firebase` CLI if you log in. |

## Open decisions (answer these and I'll finalise)

1. **Screen setup at the venue.** Is there a TV or projector for a big "stage" screen, or is this phones only? The design below assumes **TV + host phone as remote**. Phones-only still works: the host phone shows the leaderboard and people crowd around.
2. **Game line-up.** Six games + a boss round are specced below (18 scored rounds + 3 boss questions). Which do you want to keep, cut, or swap?
3. **Mom or Dad? content.** Needs your answers to about 15 questions, and optionally baby photos of you both. If you'd rather not share photos, the game runs on questions alone.
4. **Prices in CAD.** The Price Is Right items are generic (no registry items). Claude will propose Canadian prices; you confirm them in a data file before the party.
5. **Doodle Duel** needs a voting phase, so it's the slowest game (about 90 seconds per round). Keep it, or swap it for a third Where's the Binky scene?
6. **Guest count.** Roughly how many phones? (Affects nothing technical under 100, but changes how many names fit on the TV leaderboard at once.)

---

# The prompt (paste everything below this line)

You are my game designer, pixel-art director, front-end developer and QA. Build a
live, host-controlled party game into this repo (FahadZ/baby-shower-2026) that guests
play on their phones after scanning a QR code. Make routine creative and technical
decisions yourself. Only stop to ask me if an account login or permission blocks you,
or if an action would cost money. Do not buy or sign up for anything paid.

## Context: what already exists

- Read `README.md`, `index.html`, `styles.css`, `app.js`, `config.js` first. This is a
  plain HTML/CSS/JS site, no framework, no build step, hosted on GitHub Pages at
  https://fahadz.github.io/baby-shower-2026/. Keep it that way.
- Do not change the RSVP flow. The game lives in a new `game/` folder with its own
  pages and is linked from nowhere on the RSVP site (guests reach it by QR only).
- Reuse the visual system exactly: the CSS variables in `styles.css`, the Press Start 2P
  font, cream panels with pixel borders, the brick stage, clouds, falling blocks,
  sparkles and hearts from `assets/deco/` and `assets/scene/`.
- The ten character sprites in `assets/sprites/` (cloud, ghost, kirby, link, mario,
  mushroom, pacman, peach, pikachu, sonic) are the player avatars. Do not draw or
  recreate characters. The signature moves already coded in `app.js` (Pikachu
  Thunderbolt, Cloud Cross Slash, Link Spin Attack, Kirby copy ability) should be
  factored into a shared module so the game can play them as celebrations.
- The 8-bit sound effects and the chiptune theme in `app.js` / `assets/audio/` are
  reusable. Phones stay silent by default; the TV screen carries the audio.
- `scripts/bump-version.sh` stamps a build number for cache busting. Extend it to cover
  the `game/` pages and run it before every deploy.

## Architecture

**Real-time backend: Firebase Realtime Database (free Spark plan) with anonymous auth.**
GitHub Pages is static and the Apps Script backend cannot push updates, so the game
needs a pub/sub store that phones can subscribe to.

- The Firebase web config (apiKey, databaseURL, etc.) is public by design and goes in
  `game/firebase-config.js`. Security lives in the database rules, which you write and
  commit as `game/database.rules.json`.
- Rules: anyone signed in anonymously may create/update only their own
  `players/{uid}` and `answers/{roundId}/{uid}`; the `game/` state node, `scores/`,
  `totals/` and `ranks/` are writable only by a client whose uid matches
  `/hostUid`. `/hostUid` is claimed by writing a PIN that the rules compare to
  `/hostPin` (readable by nobody; set once by me in the console). Rules may read
  values clients cannot.
- Use `.info/serverTimeOffset` so every phone computes the countdown from the same
  server clock. Never trust a phone's local clock for timers or scoring.
- Use `onDisconnect()` presence so the lobby shows who is connected.
- Three views, three pages in `game/`:
  - `index.html` (**player**): what the QR opens. Join, play, see results.
  - `tv.html` (**stage**): the big screen. Shows the QR in the lobby, the round
    content, timers, reveals, leaderboards. This page is the **scoring authority**: when
    a round closes it reads all answers, computes scores with the shared
    `game/engine/scoring.js`, and writes `scores/`, `totals/`, `ranks/` in one update.
  - `host.html` (**remote**): the host's phone. PIN-protected. Buttons that advance the
    state machine; the TV executes. If no TV is open, the host page runs the authority
    itself (it must detect this and say so).
- Game state is one node, `game/state`, with `{ phase, gameId, round, roundId,
  endsAt, revealStep, updatedAt }`. Phases: `lobby → intro(game) → howto(round) →
  playing → locked → reveal → results → leaderboard → (next round | next game) →
  final → predictions → credits`. Every page is a pure function of this node plus its own
  uid, so a phone that was locked, refreshed, or lost signal renders the right screen
  the moment it reconnects. Answers are keyed by uid and idempotent; a resubmit before
  `endsAt` overwrites, after it is ignored by the authority.
- Late joiners can join at any phase with 0 points and play from the next round.
- Identity persists in localStorage (Firebase anon uid plus chosen name and sprite) so
  a refresh does not create a new player.

**Alternative, only if I ask for it:** Cloudflare Workers + Durable Objects with
WebSockets. Server-authoritative and tamper-proof but more code. Default to Firebase.

## Join flow and lobby

1. Scan QR → `game/` → "PLAYER SELECT": enter a display name (max 16 chars, uniqueness
   enforced with a friendly nudge), pick one of the ten sprites (duplicates allowed; the
   sprite gets a small numbered badge when shared). Big tap targets, no zoom on input
   focus (16px+ font on inputs).
2. Phone shows "WAITING FOR PLAYER 1 TO PRESS START" with the player's sprite idling.
3. TV lobby: the QR code huge on the left (generate the PNG into `print/qr-game.png`
   and also render it inline with a small QR library inlined into the page, no CDN
   dependency), player count, and the brick stage filling up with each joined sprite
   bouncing in with their name, the same way the invite's stage looks. Theme music plays.
4. The baby, "Player 3", is a phantom player on the stage with "LOADING.." over its head.
   It does not score.

## Host controls (`host.html`)

- Enter PIN once; remembered on that phone.
- Lobby: player list with a kick button, "START GAME".
- During play: a big "NEXT" button that always does the obvious next thing, plus
  "+15s", "END ROUND NOW", "SKIP ROUND", "SKIP GAME", "REPLAY REVEAL", "PAUSE",
  "SHOW LEADERBOARD", "MUTE TV". Current phase, round and timer are mirrored on the
  host screen so the host never has to look at the TV to know what's happening.
- A "RESET GAME" under a long-press with confirmation that clears answers and scores
  but keeps players.
- The host can also be a player from a second phone; the host page itself does not
  play.

## Round flow and timing

Every round follows the same beat:

1. **How-to (5 s, auto):** TV and phones show the game name, one-line instructions, an
   animated demo loop of the mechanic, and the point value. Round 1 of each game shows
   it for 8 s; later rounds 4 s.
2. **Playing (timed, per game below):** TV shows the shared content and a big pixel
   countdown bar (green → red in the last 5 s with a ticking sound). Phones show the
   input. Submitting early locks the phone with "LOCKED IN ✓" and a "waiting" idle.
3. **Locked (1 s):** input disabled, "TIME!" stamp slams on, TV plays a buzzer.
4. **Reveal:** the correct answer with an animation specific to the game (below).
5. **Results (host presses NEXT):** see *Hype engine*.
6. **Leaderboard (host presses NEXT):** see *Hype engine*.

Timing rule: anything a guest could Google gets **10–15 s**. Anything that is hands-on
(finding, sorting, swiping, catching, drawing) gets **30–45 s**.

## Hype engine (after every round)

This is the heart of the build; spend real effort here. All numbers are driven by
the ranks the authority writes, with each phone comparing its previous rank to its new
rank.

**TV: round results**
- "ROUND MVP" podium: the top three for *this round* appear in order 3 → 2 → 1 with
  their sprite, name, and round points counting up. The #1 sprite plays its signature
  move (Thunderbolt, Cross Slash, Spin Attack, Kirby transform; the other six sprites
  get a jump + sparkle burst). Coin sound per 100 points.
- Callouts, shown one at a time with a slam-in animation, only when true:
  "PERFECT ROUND" (max points), "SPEED DEMON" (fastest correct), "PHOTO FINISH" (top two
  within 50 points), "FIRST BLOOD" (first ever points for a player).

**TV: leaderboard**
- The top ten rows animate from their old positions to their new ones (FLIP animation,
  rows sliding past each other, 600 ms). Rows that climbed get a green "▲3" badge,
  rows that fell a red "▼2". The list then scrolls once through 11..N at reading speed
  so everyone sees their name on the big screen.
- "NEW HIGH SCORE" banner with hearts and sparkles when #1 changes hands. "BIGGEST
  CLIMB" callout for the largest rank jump of the round (≥3 places). "COMEBACK" when
  someone from the bottom half enters the top five.
- Point totals count up with a slot-machine tick.

**Phone: personal results**
- First: your round points count up, with "YOU PLACED 4TH THIS ROUND".
- Then: "YOU'RE #7 OF 42" in big type, with an arrow and "▲ UP 3 SPOTS" or "▼ DOWN 1"
  or "HOLDING STEADY". Haptic buzz on Android (`navigator.vibrate`); iOS ignores it.
- Then: the gap, phrased to motivate: "120 PTS BEHIND #6 · 40 PTS AHEAD OF #8". For #1:
  "YOU'RE WINNING BY 210 PTS". For last place: "NOWHERE TO GO BUT UP".
- Then a compact leaderboard: top five plus the three rows around you, with your row
  highlighted and your old → new position animated.
- The player's own sprite reacts: celebration on climbing, a sad "..." bubble on falling.
- Respect `prefers-reduced-motion`: keep the information, drop the motion.

## Scoring (shared `scoring.js`, deterministic, unit-tested)

Every round is worth **up to 1000 points** so games are comparable; the boss round is
worth up to 2000. Formulas:

- Closeness (slider/number): `1000 × clamp(1 − |guess − answer| / answer, 0, 1)^2`,
  plus 150 bonus inside ±10%.
- Correct/incorrect with speed: `600 + 400 × (timeLeft / roundTime)` if correct, 0
  otherwise.
- Per-item games (find, swipe): item value × count + a speed bonus on completion.
- Relative games (reflex, doodle votes): `1000 × yours / best` so the best player
  always gets 1000.
- Ordering: `1000 × (concordant pairs / total pairs)`, +200 for a perfect order.

Ties keep the same rank (1, 1, 3). Ranks are recomputed from totals after every round.

## The games

Each game has 3 rounds unless noted. All content lives in `game/data/*.js` as plain
objects I can edit without touching code. Write the copy in the playful game voice
already used on the site.

### 1. PRICE IS RIGHT: BABY EDITION  (slider · 15 s per round · Googleable, so short)
Guess the Canadian retail price of a baby item. Phone: a big pixel slider with the
value in a price tag above the thumb; the range and step are per item (e.g. $0–$600
step $5). Round 1: one item (e.g. a convertible car seat). Round 2: a "starter bundle"
of three items shown together (e.g. bottle set + bath tub + baby monitor); guess the
total. Round 3: "A YEAR OF DIAPERS" (quantity + price estimate, wide range, big swings).
Do not use items from my registry; pick common generic items and propose realistic
Canadian prices in `data/prices.js` for me to confirm. Reveal: the TV shows a price
line with every player's guess as a tiny sprite marker, then the real price tag drops
in and the closest three markers light up. Phone shows your guess vs the real price.

### 2. WHERE'S THE BINKY?  (tap to find · 45 s · hands-on, so long)
A busy pixel scene with hidden baby items. Phones show the scene full-screen with
pinch-zoom disabled and a tap-to-find hit test (generous radius). Found items get a
pixel ring and a coin sound; a found counter "3/5" sits at the top. The TV shows the
same scene with no answers, plus a live "found" tally per player streaming in.
Build scenes procedurally so every phone gets the identical layout: a seeded scatter of
a few hundred small pixel glyphs (toys, blocks, clouds, fruit, emoji rendered as
images at the site's pixel scale) with the five targets (pacifier, bottle, rattle, sock,
rubber duck) placed by the seed. Round 1: nursery clutter. Round 2: "diaper bag
explosion", denser, targets partly overlapped. Round 3: "NIGHT FEED": the scene is
dark and your finger is a flashlight; only a circle around your touch is visible.
200 points per item, +speed bonus for finding all five. Reveal: the TV zooms to each
hidden item in turn.

### 3. MOM OR DAD?  (swipe left/right · 6 s per card, 5 cards per round · not Googleable)
Cards swipe Tinder-style: left = Mom, right = Dad. Round 1: baby photos (if I provide
them in `game/assets/babyphotos/`; otherwise skip this round): "WHO IS THIS BABY?".
Round 2: "WHO WAS THIS BABY?" statements like "Cried every night until age two",
"Walked at 9 months", with the answers I supply in `data/momordad.js`. Round 3:
"WHO WILL…?" predictions the parents answered in advance: "…be the softie?", "…do the
3 AM feed?", "…cry first at daycare drop-off?". 200 points per correct card, +100 for a
five-card streak. Reveal: each card flips on the TV with a photo or the parent's sprite
(let me assign a sprite to each parent in config) and the room's split percentage.

### 4. DIAPER DASH  (reflex arcade · 20 s · hands-on)
Things fall from the top of the phone screen; tap the good stuff, avoid the bad. Round
1: catch pacifiers, avoid dirty diapers (−1 each). Round 2: faster, with golden bottles
worth 3. Round 3: "TWINS": the screen splits and two streams fall at once. Pure pointer
events, 60 fps, no device-motion permissions. The TV shows a live bar race of
everyone's catch counts. Relative scoring (best = 1000). Reveal: the TV replays the
top player's final seconds as a highlight.

### 5. PUT IT IN ORDER  (drag to sort · 30 s · semi-Googleable)
Five tiles, drag into the correct order. Round 1: diaper change steps. Round 2: baby
milestones by typical age (first smile, rolls over, sits up, crawls, first word, walks:
pick five). Round 3: baby gear by price, cheapest to priciest. Touch drag with
auto-scroll disabled and a ghost tile; a "LOCK IN" button. Reveal: tiles snap into the
right order on the TV one by one, with a check or cross per player position on the
phone.

### 6. DOODLE DUEL  (draw, then vote · 40 s draw + 25 s vote · 2 rounds)
Everyone draws the prompt on a small pixel canvas (fixed 48×48 grid, 8 colours, pencil
and eraser, undo). Round 1: "DRAW THE BABY". Round 2: "DRAW FAHAD & OYSHE AS A VIDEO
GAME BOSS". Drawings upload as a compact string (run-length encoded) to
`answers/{roundId}/{uid}`. Vote phase: the TV shows a gallery, phones show the same
gallery and each player picks one that isn't their own. Points: `1000 × votes /
maxVotes`. Reveal: the top three drawings enlarge on the TV with the artist's name.
Keep the two rounds; if the state machine makes the vote phase hard, it is one extra
phase (`voting`) between `locked` and `reveal`.

### 7. BOSS BATTLE  (4-option quiz · 10 s per question · 3 questions · double points)
The classic format, saved for last and framed as a boss fight: each correct answer
deals damage to a pixel boss on the TV (a giant pacifier or a crying-baby boss drawn
from the deco assets, no new characters). Questions are baby trivia with surprising
answers; write ten in `data/trivia.js` and the host picks three at runtime. Up to 2000
points per question with speed. The boss is defeated when the room's total damage
crosses a threshold scaled to player count, triggering a big victory animation.

### Finale
- "PREDICTIONS" (not scored): due date guess, weight, who the baby looks like, first
  word. Saved to the RSVP Google Sheet through the existing Apps Script endpoint
  (add a `kind: "prediction"` branch to `doPost` and a "Predictions" tab) so we can
  look at them after the birth.
- "FINAL RANKINGS": drum roll, then 3rd, 2nd, 1st revealed with increasing suspense,
  the winner's sprite doing its move under a confetti of falling blocks and hearts,
  the full leaderboard scrollable on every phone, and a "THANKS FOR PLAYING" screen
  with the site's victory stage.

## Rehearsal mode

`tv.html?bots=25` spawns 25 fake players (random sprites and names) that answer every
round with plausible randomness, so I can rehearse the whole evening alone and see
every animation. Bots are clearly labelled and can be removed with one button on the
host page. Also add `host.html?demo=1` that cycles every phase with bots on a timer.

## Robustness checklist (test every item)

- iOS Safari and Android Chrome at phone width; no horizontal scroll; `100dvh`;
  `touch-action: none` on game surfaces; pull-to-refresh and double-tap zoom disabled
  during play; inputs at 16px+ so iOS doesn't zoom.
- Screen lock → unlock → correct phase shows within 1 s. Airplane mode for 20 s →
  reconnect → correct phase, answer preserved if submitted.
- Forty phones submitting in the same second: answers are individual writes, the
  authority reads once on `locked`.
- The TV requests a screen wake lock; the host page too.
- Images for the next round preload during the leaderboard phase.
- Reduced motion honoured everywhere; every screen readable without colour.
- The whole `game/` folder works offline-first for assets (no CDN scripts; the Firebase
  SDK is vendored into `game/vendor/`).

## Firebase setup (do as much as you can, tell me exactly what to click for the rest)

1. If `firebase` CLI auth works, create the project, enable Realtime Database and
   anonymous auth, deploy `database.rules.json`, and write the web config into
   `game/firebase-config.js`. Otherwise give me numbered browser steps, one screen at a
   time, and wait for the config.
2. Tell me where to set `/hostPin` in the console and recommend restricting the API key
   to the GitHub Pages domain.

## Deliverables and checks

- `game/` with `index.html`, `tv.html`, `host.html`, `game.css`, `engine/` (state,
  sync, scoring, hype, audio), `games/` (one module per game), `data/` (editable
  content), `vendor/`, `database.rules.json`, `README.md` (how to run the night, what
  to edit, how to rehearse, what to do if the wifi dies).
- `print/qr-game.png` plus a printable one-pager with the QR and "SCAN TO JOIN".
- Unit tests for `scoring.js` runnable with `node --test`.
- A rehearsal run with 25 bots through every phase, screenshots at phone width of every
  player screen and at 1080p of every TV screen, saved to `game/docs/screens/`.
- Bump the version, push to `main`, confirm the live URL
  https://fahadz.github.io/baby-shower-2026/game/ works from a real phone.
- Finish with: the live game URL, the host URL and PIN location, the list of data files
  I must fill in before the party, and anything I need to do manually.

## Phasing (one session each; each ends with a pushed, working site)

1. **Engine:** Firebase, join flow, lobby, host remote, TV, state machine, scoring,
   hype engine, rehearsal bots, and one game (Price Is Right). Rehearse end to end.
2. **Games:** Where's the Binky?, Mom or Dad?, Diaper Dash, Put It In Order, Boss Battle.
3. **Polish:** Doodle Duel, predictions, finale, audio pass, robustness checklist,
   printable QR, README.
