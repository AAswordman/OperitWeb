# Announcement Feed

This directory hosts static announcement payloads for the mobile app.

## Files

- `latest.json`: pointer to the active announcement payload.
- `history/*.json`: immutable announcement payloads.

## Publish Process

1. Add a new file to `history/` (do not edit older files).
2. Increase `latestVersion` in `latest.json`.
3. Point `latestFile` to the new history file.
4. Deploy site changes to GitHub Pages.

## Client Fetch Recommendation

- Fetch `latest.json` with cache-busting query parameters, e.g. `latest.json?t=20260213T1200`.
- Then fetch `latestFile` and compare `version` with local acknowledged version.
- Keep local fallback behavior if network is unavailable.
