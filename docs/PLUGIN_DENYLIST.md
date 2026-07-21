# Plugin Denylist Feed

The plugin denylist is a static JSON security feed for the Android client. It does not use or require a Worker.

## Endpoints

- Current pointer: `https://operit.aaswordsman.org/plugin-denylist/latest.json`
- Versioned payloads: `https://operit.aaswordsman.org/plugin-denylist/history/*.json`

The client fetches this feed whenever it fetches remote announcements. It appends a cache-busting query parameter, writes a valid payload to app-private storage, and continues using the last valid cached payload when the network request fails. If no valid cache exists, the denylist is empty.

## File format

`latest.json` is a pointer:

```json
{
  "schemaVersion": 1,
  "latestVersion": 1,
  "latestFile": "/plugin-denylist/history/2026-07-20-plugin-denylist-v1.json",
  "updatedAt": "2026-07-20T00:00:00+08:00"
}
```

The referenced payload defines the reject list:

```json
{
  "schemaVersion": 1,
  "version": 1,
  "updatedAt": "2026-07-20T00:00:00+08:00",
  "hashAlgorithm": "sha256",
  "match": "raw_file_bytes",
  "action": "reject_import",
  "entries": [
    {
      "sha256": "64 lowercase hexadecimal characters",
      "note": "optional internal review note"
    }
  ]
}
```

The hash is SHA-256 over the original imported file bytes. Do not hash extracted ToolPkg entries, decoded text, filenames, or metadata. The client rejects imports whose raw file hash appears in `entries`.

## Publishing a change

1. Compute the SHA-256 for the original plugin file bytes and complete review.
2. Add a new file under `public/plugin-denylist/history/`; do not alter a published history file.
3. Add only approved lowercase SHA-256 values to `entries` and increment `version`.
4. Update `public/plugin-denylist/latest.json` to point to the new history file and version.
5. Run `pnpm validate:plugin-denylist` and publish the static site.

The bootstrap payload remains empty until there is an explicitly approved entry.
