# Build brief for Claude Code

Paste everything below the line into Claude Code, run from a clone of this repo.
Fill in the [BRACKETS] in your pasted copy, not in this file. The repo is public,
so personal details like your email should stay out of committed files.

---

You are my creative director, copywriter, designer and developer. Build and deploy a
retro video-game–themed RSVP website for a baby shower in this repo
(FahadZ/baby-shower-2026). Make routine creative and technical decisions yourself.
Only stop to ask me if an account login/permission blocks you or an action would cost
money. Do not buy or sign up for anything paid.

## Event details (from the printed invitation)
- Title: "Baby Loading.." — tagline "Player 3 has entered the game!"
- Top line: "Achievement Unlocked: Parenthood"; menu showing 1 Player / 2 Players / ▶ 3 Players
- Date/time: Saturday, October 17, 2026, 2:00 PM (America/Toronto)
- Location: 36 Park Lawn Rd, Etobicoke, ON M8V 0E5
- Hosts / parents-to-be: [NAMES]
- RSVP deadline: Saturday, October 10, 2026
- Side quest: "Choose your character!" — guests are invited to dress as any character
  they love from games, movies, TV, anime, cartoons & beyond.
- Registry link: [URL or leave blank — hide the section if blank]
- My email for notifications: [YOUR_EMAIL] — use it only inside the Apps Script
  project, never in files committed to this public repo.

## Look and feel
- Match my invitation exactly: assets/invite-page1.png is the design reference AND the
  source of the character artwork. 16-bit pixel style: dark stone/brick background,
  cream panels with pixel borders, warm orange-cream headline, green loading bar,
  red pixel hearts, clouds, falling blocks, vines.
- Characters: use ONLY the character images I supply, and do not draw or recreate any
  characters yourself. If assets/sprites/ has individual PNGs, use those. Otherwise
  crop each character out of assets/invite-page1.png into transparent PNGs, keeping
  the pixels crisp (image-rendering: pixelated). Place them around the screens the way
  the invite does, e.g. a character peeking in on the title screen and a victory pose
  on the "Thanks for playing" screen.
- Font: "Press Start 2P" (Google Fonts) for headings/buttons; "VT323" for body text.
- Animations: loading bar filling on the title screen, blinking "PRESS START", floating
  clouds, a small bounce on the characters. Respect prefers-reduced-motion.
- Optional 8-bit sound effects with a toggle, OFF by default.
- Mobile-first (most guests open it from a text message), accessible (labels, contrast,
  keyboard nav, focus states, alt text on images).

## Page flow (single page, screen-to-screen transitions)
1. Title screen: headline, "Loading.." bar, event details card, countdown to the party,
   "PRESS START TO RSVP" button.
2. "Select mode": ▶ "I'm in! (Continue)" or "Can't make it (Game Over)".
3. RSVP form:
   - Full name (required)
   - Email (required — used for confirmation and to update an existing RSVP)
   - Number of guests incl. themselves, styled as "1 Player / 2 Players / ..." up to 5
     (attending only)
   - "Choose your character" — costume plan, optional (attending only)
   - Message for the parents-to-be, optional (both paths)
   - Hidden honeypot field for spam
4. End screens:
   - Attending: "THANKS FOR PLAYING!" + "See you on Level 17 (Oct 17)", Add to Google
     Calendar button, download .ics, map link, share button.
   - Not attending: "GAME OVER… but thanks for the love ♥", "Your message has been
     saved to the high score board."
   - Both: "Need to change your answer? Just submit again with the same email."
- After the deadline, show a friendly "RSVPs are closed — contact the hosts" screen.
- Write all copy yourself in the playful game voice; keep it warm and clear.

## Backend: Google Apps Script + Google Sheet (free)
- Create a Google Sheet "Baby Shower 2026 RSVPs" with columns: Timestamp, Name, Email,
  Attending, Guests, Character, Message, Last Updated.
- Add a "Summary" tab: total RSVPs, total attending guests, declines.
- Apps Script web app (doPost):
  - Validate input, reject if honeypot is filled.
  - If the email already exists, update that row; otherwise append.
  - Email me at [YOUR_EMAIL] for every new or updated RSVP (subject like
    "🎮 New RSVP: Name — 3 players" / "Name can't make it").
  - Send the guest a short confirmation email with date, time, address and a map link.
  - Return JSON { ok: true } or an error.
- Front end posts with fetch using Content-Type text/plain to avoid CORS preflight;
  show a pixel "Saving…" state, and a friendly retry message on failure.
- Use `clasp` to create and deploy the script if possible (npm i -g @google/clasp,
  clasp login). If Google authorization needs me, pause and tell me exactly what to click.
  Deploy as: Execute as me, access: Anyone.
- Keep the Apps Script source in /apps-script in the repo but with no email address or
  Sheet ID hard-coded — read them from Script Properties.
- The web-app URL goes in a config.js file.

## Hosting
- Plain HTML/CSS/JS, no framework or build step.
- Push to the existing public repo FahadZ/baby-shower-2026 (branch main) and enable
  GitHub Pages from the main branch root with `gh`. Report the live URL
  (https://fahadz.github.io/baby-shower-2026/).
- Add Open Graph/Twitter meta tags with a 1200x630 preview image made from my invite
  (crop/pad assets/invite-page1.png) so the link looks good in WhatsApp/iMessage.
  Add a pixel favicon (a heart).
- Generate a QR code PNG of the live URL in /print for optional printing.

## Deliverables and checks
- README with: live URL, how to edit event details, how the Sheet/Apps Script works,
  how to redeploy.
- Test end to end before finishing: submit an attending RSVP, a decline, and a
  resubmission with the same email. Confirm the Sheet updates correctly, both emails
  arrive, and the page works at phone width. Then delete the test rows.
- Finish with a short summary: live link, Sheet link, and anything I need to do manually.
