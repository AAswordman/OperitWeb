# Explicit Repair and Original Preservation

## Old Implementation

The SQL executor allowed arbitrary modifications, but there was no preservation and repair flow targeted at database problems.

## Intent of the Change

- Generate a deterministic repair plan from the most recent health report
- Only handle explicit operations such as resetting undecodable Preferences files, rebuilding SQLite indexes, and Room migrations already validated against an isolated copy
- Before repair begins, write the original configuration files and DB, WAL, SHM, and journal files into separate ZIPs
- After repair completes, rerun the full health check
- Data corruption whose handling cannot be determined is left unchanged in its original files, with the reason shown to the user

## Expected Results

Every repair has a traceable copy of the originals and a post-repair report, so automated operations cannot overwrite the only source for data recovery.

[DONE]
