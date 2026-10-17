# Working in this repo

## Ship every change: merge to main and deploy

The owner wants every finished change live, not left on a side branch. After committing:

1. Merge your work into `main` and push `main` (as well as your session branch).
   Before you start, check other `claude/*` branches for unmerged work and bring it along.
2. If anything under `game/` changed: `cd game && npm test`, then `npx wrangler deploy`.
   The session has `CLOUDFLARE_API_TOKEN` set, so deploy yourself; don't ask the owner to.
   The game is served at https://baby.thenerdnextdoor.ca.
3. The RSVP site (repo root) and `raffle/` are served by GitHub Pages from `main`,
   so pushing `main` deploys them. No extra step.
4. Edits to `apps-script/Code.gs` need a manual redeploy in the Apps Script editor
   (see README.md); say so when you change it.
