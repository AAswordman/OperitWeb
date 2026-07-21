# Plugin denylist feed

This directory is the static security denylist feed consumed by the Android client. It is deliberately separate from the plugin market Worker.

- `latest.json` is the current pointer.
- `history/*.json` are immutable, versioned denylist payloads.

The `entries` array in the current v1 payload is intentionally empty. Add entries only after the SHA-256 values have been reviewed and approved.

Run `pnpm validate:plugin-denylist` before publishing a feed update.
