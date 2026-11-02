# Data Recovery Configuration and Database Health Checks

The data recovery UI runs in a standalone `:repair` process. Configuration and database checks are user-initiated recovery features; they do not participate in app startup, and they never automatically modify configuration or databases in the background.

## Published Interface Compatibility

The following capabilities published in v1.12.1 remain unchanged:

- Raw snapshot export and import
- SQL input, preset queries, and execution results
- File management hints
- Launching the main app after recovery completes
- The `com.ai.assistance.operit.action.OPEN_DATA_RECOVERY` intent action

The configuration and database check section is appended after the SQL executor, without changing existing entry points, data paths, or operation semantics.

By default, the UI only shows the number of checks passed and issues that need the user's attention; the full list of checks, database paths, and technical details are revealed by clicking to expand the report.

## Check Contents

### Preferences Configuration Files

The checker enumerates existing Preferences DataStore files, copies each file to an isolated cache directory, and then verifies through a separate DataStore owner whether the copy can be decoded. Detection does not replace the project's existing DataStore declarations, nor does it modify live configuration files.

Only ordinary configuration files that explicitly throw `CorruptionException` enter a repairable state. Directory or path type anomalies, copy failures, and other errors of undetermined cause are only reported; the original files are not modified. Configuration copy checks can be completed while the main app is running; an actual repair still requires the main app process to be stopped.

### Room Databases

`RoomDatabaseHealthManager` closes the Room singleton inside the `:repair` process before running checks, then opens `app_database` directly in read-only mode. The custom `DatabaseErrorHandler` only records SQLite corruption signals and does not delete database files.

The check report includes:

- `app_database` file and WAL, SHM, and journal path types and sizes
- `PRAGMA quick_check`
- `PRAGMA user_version`
- `PRAGMA foreign_key_check`
- Main app process status
- Full Room schema and migration chain validation on an isolated copy

Once the main app process is confirmed stopped and the basic SQLite checks pass, the checker copies the DB, WAL, SHM, and journal, and removes `room_master_table` from the copy, forcing Room to validate the actual tables, fields, foreign keys, and indexes. Older databases first run the full published migration chain on that copy; only when both the copy migration and schema validation pass is the corresponding repair action made available for the live database.

Reports fall into three states: checks passed, a definite repair action exists, and manual rescue is needed. Repair buttons are not offered when the database is missing, a path type is abnormal, pages are corrupted, foreign keys are violated, the database is a newer version, the main process state is unsafe, the Room schema does not match, or the migration chain cannot complete.

## Repair Rules

Currently only three operations whose results can be definitively verified are supported:

- When a Preferences file is definitively undecodable, after preserving the original, delete the corrupted file, so that the existing DataStore creates a clean configuration on its next normal access
- When `quick_check` only reports missing or miscounted index entries, execute `REINDEX`
- When the database version is below the current Room version and all other checks pass, execute the published migration

A repair button requires the most recent report to confirm a supported operation exists, the isolated copy to pass Room validation, and a second confirmation from the user. Before execution and before every write operation, it is confirmed that the main app process is not running.

## Original Preservation

Before write operations begin, unreadable configuration files are written to `backup/preferences/preferences_repair_source_<time>_<id>.zip`; the currently existing DB, WAL, SHM, and journal are written to `backup/room_db/room_db_repair_source_<time>_<id>.zip`. The preservation process does not require the source content to open successfully.

If a repair action fails, the UI still displays the path of that ZIP. After repair completes, all checks are run again; if re-checking fails, the report and the originals are retained, and no further modifications are performed.

## Future Scope

ObjectBox, Preferences business field normalization, backup format upgrades, and business configuration reference fixes are out of scope for the current implementation. Future storage types should each be submitted as a separate PR, and continue to follow the boundary of user-initiated action, check first, preserve first, and then execute only definite operations.
