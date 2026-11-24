# Bastionmaker

A Bastion builder and turn tracker for D&D (2024 rules) groups. Each campaign gets one private link;
everyone with the link can build, save and run the party's Bastions.

## What it does

- **Campaigns**: create a campaign, share its link, see every Bastion at a glance.
- **Builder**: character level and prerequisites, special facilities from the Dungeon Master's Guide,
  Forgotten Realms, Eberron, Ravenloft and Arcana Unleashed (slot limits and prerequisites checked),
  basic facilities, enlargements, defensive walls, hirelings, defenders and creatures.
- **Bastion turns**: issue orders per facility or Maintain. Costs are deducted, work takes the right
  number of days, and results land in the Bastion's stores. Bastion events, attacks, gambling,
  recruit rolls and (optionally) Ravenloft hauntings are rolled and applied automatically; events
  that need a decision wait for you.
- **Map**: paint each facility onto a 5-foot grid, across several floors, within its space limit.
- **Log**: a turn-by-turn history, plus your own notes.

Rules text is summarised; keep your books handy for the full wording.

## How it's built

| Path | Purpose |
| --- | --- |
| `public/` | The app: plain HTML, CSS and ES modules, no build step |
| `public/js/data.js` | Facilities, orders and tables |
| `public/js/engine.js` | Rules engine (pure functions, injectable dice) |
| `public/js/app.js` | UI |
| `src/worker.js` | Cloudflare Worker API (`/api/*`), stores campaigns and Bastions in D1 |
| `test/` | Engine tests (`npm test`) |

Saves use a version number per Bastion, so two people editing the same Bastion at once can't silently
overwrite each other: the second one is asked to reload.

There are no accounts. The campaign link is the key: anyone who has it can edit that campaign.

## Develop

```sh
npm install
npm run dev     # http://localhost:8787 with a local D1 database
npm test
```

## Deploy

Live at https://bastions.nextfic.com (Worker `bastionmaker`, D1 database `bastionmaker`).

The live Worker was uploaded through the Cloudflare API without an assets bundle, so it serves
the files in `public/` from this repository's `ccr-56610837-l4upwy` branch on GitHub (the
`ASSETS_ORIGIN` variable), cached for two minutes. Pushing to that branch updates the site; changes
to `src/worker.js` need a redeploy. Keep the repository public and the branch in place, or switch
to a self-contained deploy:

```sh
npm run deploy    # wrangler bundles public/ into the Worker; ASSETS_ORIGIN is no longer used
```

The tables are created automatically on first request.
