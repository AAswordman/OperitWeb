---
Repository: https://github.com/AAswordman/Operit
Branch: feat/data-recovery-database-health
Status: completed
---

# Data rescue configuration and database checks

## Previous state

The published data rescue interface provided raw snapshot import/export and a SQL executor, but ordinary users could not tell whether configuration files and Room databases were intact, nor distinguish problems that can be handled deterministically from data corruption that requires manual rescue.

PR #1006 attempted to uniformly restore Preferences, Room, and ObjectBox during app startup, while also mixing in backup formats, business configuration fixes, and voice configuration changes. That scope could not be merged safely, so it has now been changed to extracting, from the current `dev`, the user-manually-triggered Preferences file and Room detection and repair capabilities.

## Intent

- Keep the existing data rescue entry point and the SQL and raw snapshot interfaces compatible
- Below the SQL executor, add user-actively-triggered configuration and database checks
- At the same entry point, check whether Preferences configuration files can be read normally
- Check database files, SQLite integrity, versions, and foreign key status
- Offer repair operations only for problems that can be handled deterministically
- Before modifying, preserve the original configuration file as well as the DB, WAL, SHM, and journal files separately
- Do not hook into the app startup flow, and do not modify the Preferences or ObjectBox lifecycle

## Scope

- `DataRecoveryActivity` and `DataRecoveryViewModel`
- A new Room health check and repair manager
- A new Preferences configuration file health check and repair manager
- Chinese, English, and Japanese UI text
- Development documentation directly related to this feature

## Non-goals

- Actively scanning or restoring databases at startup
- Raw Snapshot format upgrades
- Automatic fixes to Preferences business fields, ObjectBox, or business configuration references
- Automatically replacing database content that cannot be verified

## Steps

1. [Room health check](./1_RoomHealthCheck.en.md)
2. [Deterministic repairs and original preservation](./2_RepairAndPreservation.en.md)
3. [Compatibility and verification](./3_CompatibilityAndVerification.en.md)
4. [Preferences configuration file detection and repair](./4_PreferencesHealth.en.md)

[DONE]
