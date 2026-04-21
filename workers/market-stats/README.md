# market-stats Worker

This Worker tracks download and install counts for the Operit script, package, Skill, and MCP markets
with Analytics Engine, then periodically generates static JSON files into R2 so the app can fetch
precomputed market data without burning Workers KV reads.

## Public Base URLs

- Static JSON read endpoints: `https://static.operit.app/market-stats`
- Tracking endpoints: `https://api.operit.app/market-stats`

The Worker is deployed on the custom domain `api.operit.app`, with tracking and maintenance endpoints
mounted under the `/market-stats` path prefix. Static ranking JSON is written into R2 under the
`market-stats/` prefix and is intended to be exposed separately on `static.operit.app`.

## What It Does

- `GET /market-stats/download?type=script|package|skill|mcp&id=<artifact-id>&target=<url>`
  - Writes a download event into Analytics Engine
  - Redirects the user to the real asset URL
- `POST /market-stats/install`
  - Writes an install event into Analytics Engine
- `GET /market-stats/stats.json`
  - Returns all current counters
- `GET /market-stats/stats/<type>.json`
- `GET /market-stats/rank/<type>-<metric>-page-<n>.json`
  - Returns pre-generated ranking pages
  - Each item now includes counters, an embedded issue snapshot, and precomputed summary fields
- Scheduled task
  - Rebuilds static JSON snapshots every 6 hours
  - Pulls the latest market issues from GitHub
  - Aggregates download/install totals from Analytics Engine into fresh static JSON pages

## Setup

1. Ensure the repo root has `.env.local` with `CLOUDFLARE_API_TOKEN=...`.
2. Create the R2 bucket used for static market JSON if it does not already exist:

```bat
cd /d D:\Code\prog\assistance_web\workers\market-stats
npx wrangler r2 bucket create operit-market-stats-static
```

3. Configure the Worker secret used to query Analytics Engine SQL:

```bat
cd /d D:\Code\prog\assistance_web\workers\market-stats
npx wrangler secret put MARKET_ANALYTICS_API_TOKEN
```

The token should have access to the account's Analytics Engine SQL API. Reusing an existing Cloudflare
API token may work if it already has the required account-level permissions, but a dedicated read token
is safer.

4. Deploy:

```bat
cd /d D:\Code\prog\assistance_web
workers\worker_submit.bat market-stats
```

5. Configure GitHub access for the Worker.

- Reuse the same secrets already used by `operit-api` if you have them:
  - `OPERIT_GITHUB_TOKEN`
  - or `OPERIT_GITHUB_APP_ID`, `OPERIT_GITHUB_INSTALLATION_ID`, `OPERIT_GITHUB_PRIVATE_KEY`
- If no GitHub secret is provided, the Worker will still try unauthenticated GitHub requests, but rate limits are much lower.

## Expected Static JSON Objects

The Worker stores generated objects in the R2 bucket under the `market-stats/` prefix by default:

- `market-stats/stats.json`
- `market-stats/stats/script.json`
- `market-stats/stats/package.json`
- `market-stats/stats/skill.json`
- `market-stats/stats/mcp.json`
- `market-stats/rank/script-downloads-page-1.json`
- `market-stats/rank/script-installs-page-1.json`
- `market-stats/rank/script-updated-page-1.json`
- `market-stats/rank/package-downloads-page-1.json`
- `market-stats/rank/package-installs-page-1.json`
- `market-stats/rank/package-updated-page-1.json`
- `market-stats/rank/skill-downloads-page-1.json`
- `market-stats/rank/skill-installs-page-1.json`
- `market-stats/rank/skill-updated-page-1.json`
- `market-stats/rank/mcp-downloads-page-1.json`
- `market-stats/rank/mcp-installs-page-1.json`
- `market-stats/rank/mcp-updated-page-1.json`
- `market-stats/manifest.json`

## Notes

- This project is intentionally precomputed. The app should fetch static JSON and sort/page locally or read the pre-ranked pages directly.
- The rank JSON now carries enough issue snapshot data for market list pages to render without first fetching the full issue list from GitHub.
- Static JSON is now persisted in R2 instead of Workers KV. That removes the tiny KV free-read ceiling from the market browse path.
- Download/install events no longer use D1. They are written to Analytics Engine and rolled up into static JSON on the 6-hour schedule.
- The intended production split is: app reads from `static.operit.app`, while download/install reporting stays on `api.operit.app`.
- `MARKET_STATIC_OBJECT_PREFIX` controls the prefix inside the bucket. The default is `market-stats`, which makes it easy to expose later on a dedicated static domain.
- The Worker only allows redirect targets on approved hosts. Update `MARKET_ALLOWED_DOWNLOAD_HOSTS` if your asset host list changes.
- Update `MARKET_SUPPORTED_TYPES` if you want to add or remove market categories later.
- `wrangler.toml` now needs both the `MARKET_ANALYTICS` dataset binding and the `MARKET_ANALYTICS_API_TOKEN` secret because writing and querying Analytics Engine use different mechanisms.
- `wrangler.toml` uses a Cloudflare Worker custom domain on `api.operit.app`, which avoids exposing a `workers.dev` URL in the app.
