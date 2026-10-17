# Baby Loading.. 🎮👶

A retro 16-bit RSVP site for Fahad & Oyshe's baby shower. Player 3 has entered the game!

**Live:** https://fahadz.github.io/baby-shower-2026/ (once GitHub Pages is enabled, see [Hosting](#hosting))

- Saturday, October 17, 2026 · 2:00 PM (Toronto)
- 36 Park Lawn Rd, Etobicoke, ON M8V 0E5
- RSVPs stay open until the party starts (Oct 17, 2:00 PM)

Plain HTML/CSS/JS. There's no framework and no build step.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | All screens: title → select mode → RSVP form → thanks / game over (plus a "closed" screen after the deadline) |
| `styles.css` | Pixel styling, animations (all disabled under `prefers-reduced-motion`) |
| `app.js` | Screen flow, countdown, loading bar, scene builder, living sprites (tap one!), original chiptune theme (`assets/audio/theme.wav`) offered in a "Sound on?" pop-up, plus 8-bit sound effects; saying no is remembered, form + submit, calendar/.ics/share |
| `config.js` | **Event details + backend URL. Edit this file to change anything.** |
| `assets/fonts/` | Press Start 2P, self-hosted so the pixel font always loads (SIL Open Font License) |
| `assets/sprites/` | Characters cropped from the invite (`assets/invite-page1.png`) as transparent PNGs |
| `assets/scene/` | The invite's own logo, brick-and-vine stage, ledges and brick tile (characters erased) |
| `assets/kirby/`, `assets/cloud/`, `assets/link/` | Animation frames from the real games (Kirby Super Star, Final Fantasy Brave Exvius, Cadence of Hyrule), via The Spriters Resource |
| `assets/deco/` | Clouds, falling blocks, hearts and sparkles, also cropped from the invite |
| `assets/og-image.png` | 1200×630 link preview for WhatsApp / iMessage |
| `apps-script/` | Google Apps Script backend (Sheet + emails) |
| `print/qr-code.png` | QR code for the live URL |
| `print/raffle-poster-A3.pdf`, `print/raffle-poster-A3-landscape.pdf`, `print/raffle-rules-letter.pdf` | Raffle booth posters (A3 portrait and landscape) and table rule sheet (Letter), ready to print; HTML sources beside them |
| `raffle/` | "Who's That Pokémon?" sticker raffle: the Raffle Pokédex (check-in) + TV draw screen (see [Raffle](#raffle-whos-that-pokémon)) |
| `assets/pokemon/` | Official artwork (`art/`) and cries (`cries/`) for #001–#151 via PokeAPI; the 1998 segment's audio (`voice/`); the painted speed lines and burst (`wtp-speed.webp`, `wtp-burst.webp`); the blocky "?" (`wtp-question.svg`); the Pokémon logo (`pokemon-logo.svg`, from Wikimedia Commons) |
| `assets/fonts/` (raffle) | Anton for the yellow-and-blue name lettering (SIL Open Font License); Luckiest Guy for the keypad and "Sticker #___ wins!" (Apache License 2.0) |

## Raffle: Who's That Pokémon?

Each guest picks a numbered sticker (#001–#151) from the sticker book. Throughout the party, the TV draws one of the checked-in stickers as the original 1998 "Who's That Pokémon?" segment.

- **Raffle Pokédex** (check-in, on the iPad at the booth): https://fahadz.github.io/baby-shower-2026/raffle/
- **Draw screen** (for the TV): https://fahadz.github.io/baby-shower-2026/raffle/draw.html

### Raffle Pokédex (check-in)

Type the number on the guest's sticker and tap **Add** (or press Enter on a keyboard). Before you add it, the screen shows that Pokémon's picture and name, so it's easy to compare with the sticker. It refuses numbers outside 001–151, numbers already checked in, and numbers missing from the sticker book. **Undo last** and the ✕ on each entry fix mistakes.

**Guest mode** (for leaving the iPad out so guests sign themselves up): open the section at the bottom and tap **Turn on guest mode**. It hides removing, sharing, reset and the draw-screen link. Right after adding, a guest can still tap **Oops, undo** for 30 seconds to take back their own entry. To turn it off, press and hold **🔒 Guest mode** at the top for 2 seconds. It stays on after a reload.

**Missing stickers:** list the Pokédex numbers your sticker book doesn't have in `missing` in `raffle/raffle-config.js`, e.g. `missing: [7, 25, 150]`.

### The draw

On the draw screen, press **Space** (or click **Draw!**). The order is:

1. A Poké Ball spins past the camera, cuts to the red speed lines and POKéMON logo, and flies off into the distance
2. The white-cyan burst, blue silhouette and yellow **?** zoom out of where it vanished
3. "Who's that Pokémon?" and the jingle, from the original broadcast

Let everyone guess, then press **Space** again to reveal:

1. A dip to black, like coming back from the commercial break, and the original reveal music
2. "It's Onix!" while the silhouette dissolves into colour and the name spins in where the **?** was
3. The Pokémon's cry
4. "Sticker #095 wins!"

The timings come from the broadcast, frame by frame.

Press **Space** once more to go back between draws.

- Winners leave the pool, so nobody wins twice.
- If the winner isn't there, press **R** (*Not here? Redraw*). That sticker is marked as a no-show and the next draw starts with its own Poké Ball opening.
- **Esc** before the reveal cancels the draw and puts the sticker back.
- **T** does a test run with any Pokémon. It isn't recorded, so it's safe for checking the TV and sound before guests arrive.
- **F** toggles full screen. A presentation clicker also works, because → and PageDown count as Space.
- The draw uses the browser's crypto random number generator, so every sticker in the pool has the same chance.
- In the Raffle Pokédex list, ↺ puts a winner or no-show back in the draw.

**Sound:**
- The opening (Poké Ball sound, music, "Who's that Pokémon?") is the original English broadcast audio.
- The reveal plays the broadcast's reveal music with the announcer taken out, so any Pokémon's name can go over it.
- "It's …!" uses the device's text-to-speech. Choose the voice under **🔊 Sound** on the draw screen, or turn it off and shout the name yourself. Charmander gets the original "It's Charmander!" and its anime "Char!".
- Cries are the full-quality versions from the recent games. Pikachu's is Ikue Ōtani's anime voice.
- To use a Pokémon's anime voice ("Char!") or a recorded "It's …!" line instead, drop the clip in `assets/pokemon/voice/`; see the README there.

### Posters

- `print/raffle-poster-A3.pdf` (portrait, 297 × 420 mm) and `print/raffle-poster-A3-landscape.pdf` (420 × 297 mm): the booth poster. Both also print on 11 × 17 in. with "fit to page".
- `print/raffle-rules-letter.pdf`: the how-to-enter sheet for the table next to the iPad, 8.5 × 11 in.

Print at 100% (actual size) with background graphics on. To change the wording, edit `print/raffle-poster.html`, `print/raffle-poster-landscape.html` or `print/raffle-rules.html`, then run `scripts/render-print.sh`, which needs Node and Playwright.

### One device or two

The list is saved in the browser of the device it was entered on.

- **One device** (a laptop or tablet at the door that later goes on the TV): nothing to do.
- **Two devices** (a phone at the door, a laptop on the TV): in the Raffle Pokédex, open **Move the list to another device**, tap **Share link**, and open that link on the TV laptop. It only adds stickers the TV doesn't have yet, so you can send it again after late arrivals. **Copy numbers** with **Add numbers from another device** does the same by copy and paste.

All art, cries and fonts are served with the site; nothing comes from a third-party service. The draw screen preloads the pictures and cries for everyone in the pool, so a Wi-Fi drop during the party won't interrupt a draw.

## Party games (`game/`)

The live, host-controlled party games guests play on their phones at the shower live
in [`game/`](game/README.md): a Cloudflare Worker + Durable Object at
https://baby.thenerdnextdoor.ca/ (players), `/host` (the remote) and `/tv` (optional big
screen). The build brief is `GAME-PROMPT.md`; the printable join cards are in
`print/join-card.pdf`.

## Editing event details

Open `config.js`:

- `start` / `end`: party time, with the Toronto offset (`-04:00` in October)
- `rsvpDeadline`: after this, the RSVP button shows a friendly "save point closed" screen
- `address`, `hosts`, `hostsShort`
- `registryUrl`: shown as an optional "secret bonus level". Set it to `""` to hide it everywhere
- `rsvpEndpoint`: the Apps Script web-app URL (see below)
- `maxPlayers`: max number in the players and kids pickers

The guest confirmation email text is in `apps-script/Code.gs` (the `EVENT` object at the top). If you change the date or address, update it there too and redeploy the script.

## Backend: Google Sheet + Apps Script

Each RSVP is a row in the **"Baby Shower 2026 RSVPs"** Google Sheet:

`Timestamp | Name | Email | Attending | Adults | Kids | Guest Names | Message | Last Updated`

A **Guest List** tab is rebuilt after every RSVP: one row per person attending (Adult or Kid), with who RSVP'd for them, plus totals. Attending guests must enter a name for every extra player and kid.

A **Summary** tab shows total RSVPs, attending RSVPs, adults attending, kids attending (for toys and food), total headcount, declines, and the last response time.

`doPost` does the following:

1. Rejects spam silently if the hidden honeypot field is filled.
2. Rejects submissions after `RSVP_DEADLINE`.
3. Validates the input and strips spreadsheet-formula characters.
4. **Upserts by email**: resubmitting with the same email updates that row, keeps the original timestamp and refreshes *Last Updated*.
5. Emails the host ("🎮 New RSVP: Name — 3 players + 1 kid" / "Name can't make it" / "🔁 Updated RSVP…").
6. Emails the guest a short confirmation with date, time, address and a map link.
7. Returns `{ ok: true, updated }` or `{ ok: false, error }`.

The front end posts JSON with `Content-Type: text/plain` so the browser doesn't send a CORS preflight.

No email address or Sheet ID is committed. They live in **Script Properties**:

| Property | Set by | Meaning |
|---|---|---|
| `SHEET_ID` | `setup()` | The RSVP spreadsheet |
| `NOTIFY_EMAIL` | `setup()` (defaults to the Google account running it) | Where host notifications go |
| `RSVP_DEADLINE` | `setup()` (defaults to Oct 17, 2:00 PM Toronto) | Cut-off for submissions |

### One-time setup (about 5 minutes, in the browser)

1. Go to <https://script.google.com> → **New project**. Name it "Baby Shower RSVP".
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this repo.
3. Click ⚙️ **Project Settings** → check **Show "appsscript.json" manifest file** → go back to the editor and replace `appsscript.json` with `apps-script/appsscript.json`.
4. In the function dropdown pick **`setup`** → **▶ Run** → **Review permissions** → choose your Google account → **Advanced** → **Go to Baby Shower RSVP (unsafe)** → **Allow**. (Google calls it "unsafe" only because you wrote it yourself.) The execution log prints the Sheet URL.
5. (Optional) **Project Settings → Script Properties** to check or change `NOTIFY_EMAIL`.
6. **Deploy → New deployment** → type **Web app** → *Execute as*: **Me**, *Who has access*: **Anyone** → **Deploy** → copy the **Web app URL** (ends in `/exec`).
7. Paste that URL into `rsvpEndpoint` in `config.js`, then commit and push.

### Testing

- In the editor, run **`testSubmit`**. It posts an attending RSVP (to your own email), a decline, and a resubmission with the same email. Check the Sheet: the first row should update in place. Check your inbox: you should get host notifications plus a guest confirmation.
- Run **`removeTestRows`** to delete every row whose name starts with "Test ".
- Then do one real submission from your phone on the live site and delete that row by hand.

### Redeploying after editing `Code.gs`

**Deploy → Manage deployments** → ✏️ edit the existing deployment → *Version*: **New version** → **Deploy**. The URL stays the same, so `config.js` doesn't change.

<details>
<summary>Prefer the command line? (clasp)</summary>

```sh
npm i -g @google/clasp
clasp login                       # opens a Google sign-in
cd apps-script
clasp create --type standalone --title "Baby Shower RSVP" --rootDir .
clasp push -f
clasp run setup                   # or run setup() once in the web editor
clasp deploy -d "v1"              # first deploy; then set access to Anyone in the web UI if needed
```

`.clasp.json` is git-ignored because it contains your script ID. See `.clasp.json.example`.
</details>

## Hosting

GitHub Pages serves the repo root directly:

**Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**

After a minute the site is live at https://fahadz.github.io/baby-shower-2026/. Every push to `main` redeploys it automatically.

Link previews (WhatsApp/iMessage) use `assets/og-image.png`. Some apps cache previews, so test with a fresh chat.

## Cache busting

GitHub Pages lets browsers cache files for about 10 minutes. To stop phones from mixing old and new files:

- `index.html` loads `styles.css`, `config.js` and `app.js` with a `?v=` build tag.
- A tiny script at the top of `index.html` compares its build number with `version.txt` (fetched uncached). If the page is stale, it reloads the latest one automatically.

**Before every deploy, run `scripts/bump-version.sh`**. It stamps a new build number into both places.

## Local preview

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
