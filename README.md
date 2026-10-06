# Baby Loading.. 🎮👶

A retro 16-bit RSVP site for Fahad & Oyshe's baby shower. Player 3 has entered the game!

**Live:** https://fahadz.github.io/baby-shower-2026/ (once GitHub Pages is enabled, see [Hosting](#hosting))

- Saturday, October 17, 2026 · 2:00 PM (Toronto)
- 36 Park Lawn Rd, Etobicoke, ON M8V 0E5
- RSVPs close Wednesday, October 7, 2026

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
| `assets/deco/` | Clouds, falling blocks, hearts and sparkles, also cropped from the invite |
| `assets/og-image.png` | 1200×630 link preview for WhatsApp / iMessage |
| `apps-script/` | Google Apps Script backend (Sheet + emails) |
| `print/qr-code.png` | QR code for the live URL |

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
| `RSVP_DEADLINE` | `setup()` (defaults to Oct 7, 11:59 PM Toronto) | Cut-off for submissions |

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
