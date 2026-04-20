# market-stats Worker

This Worker tracks download and install counts for the Operit script, package, Skill, and MCP markets,
then periodically generates static JSON files that the app can fetch cheaply.

## Public Base URL

- `https://api.operit.app/market-stats`

The Worker is deployed on the custom domain `api.operit.app`, with all market stats endpoints
mounted under the `/market-stats` path prefix.

## What It Does

- `GET /market-stats/download?type=script|package|skill|mcp&id=<artifact-id>&target=<url>`
  - Increments the download counter
  - Redirects the user to the real asset URL
- `POST /market-stats/install`
  - Increments the install counter
- `GET /market-stats/stats.json`
  - Returns all current counters
- `GET /market-stats/stats/<type>.json`
- `GET /market-stats/rank/<type>-<metric>-page-<n>.json`
  - Returns pre-generated ranking pages
- Scheduled task
  - Rebuilds static JSON snapshots every 15 minutes

## Setup

1. Ensure the repo root has `.env.local` with `CLOUDFLARE_API_TOKEN=...`.
2. Apply the schema:

```bat
cd /d D:\Code\prog\assistance_web\workers\market-stats
npx wrangler d1 execute operit-market-stats --remote --file=.\schema.sql
```

3. Deploy:

```bat
cd /d D:\Code\prog\assistance_web
workers\worker_submit.bat market-stats
```

## Expected Static JSON Keys

- `stats.json`
- `stats/script.json`
- `stats/package.json`
- `stats/skill.json`
- `stats/mcp.json`
- `rank/script-downloads-page-1.json`
- `rank/script-installs-page-1.json`
- `rank/script-updated-page-1.json`
- `rank/package-downloads-page-1.json`
- `rank/package-installs-page-1.json`
- `rank/package-updated-page-1.json`
- `rank/skill-downloads-page-1.json`
- `rank/skill-installs-page-1.json`
- `rank/skill-updated-page-1.json`
- `rank/mcp-downloads-page-1.json`
- `rank/mcp-installs-page-1.json`
- `rank/mcp-updated-page-1.json`
- `manifest.json`

## Notes

- This project is intentionally precomputed. The app should fetch static JSON and sort/page locally or read the pre-ranked pages directly.
- The Worker only allows redirect targets on approved hosts. Update `MARKET_ALLOWED_DOWNLOAD_HOSTS` if your asset host list changes.
- Update `MARKET_SUPPORTED_TYPES` if you want to add or remove market categories later.
- `wrangler.toml` uses a Cloudflare Worker custom domain on `api.operit.app`, which avoids exposing a `workers.dev` URL in the app.
