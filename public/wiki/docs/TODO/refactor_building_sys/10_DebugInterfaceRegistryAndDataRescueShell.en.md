---
title: Step 10: Debug Interface Registry and Data Rescue Shell
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 10
depends_on:
  - 9_VariantsSigningAndVersioning.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 10: Debug Interface Registry and Data Rescue Shell

[Previous step: Variants, Debug Boundaries, Signing, and Version Identity](./9_VariantsSigningAndVersioning.en.md) · [Back to master plan](./index.en.md) · [Next step: APK Audit and Patch Chain](./11_ApkAuditAndPatch.en.md)

## Previous Implementation

- `ScriptExecutionReceiver` accepts code text, script file paths, and function arguments, and external ADB can drive the app to execute generic scripts via broadcast
- ToolPkg installation, package refresh, and DSL dump each use a separate exported receiver, with no unified interface description or registry
- `tools/adb/execute_js.*`, `run_sandbox_script.*`, and the existing ADB documentation depend on the generic execution receiver
- The app already has `DebuggerShellExecutor`, Shell tools, and terminal execution capabilities internally
- The data rescue UI exports `files`, external files, `shared_prefs`, `datastore`, and `databases` via `RawSnapshotBackupManager`
- Data rescue paths, snapshot export, and UI state are coupled, so other internal debug entry points cannot reuse the same set of path definitions

## Expected New Implementation

- QA debug retains the generic code, script file, and debug command execution receiver, to support fully automated and exploratory debugging
- QA debug additionally provides a debug-only named debug gateway, for calling stable interfaces explicitly marked as QA debug in the registry
- QA release and prod release do not compile the generic execution receiver or the QA debug gateway, but do contain a restricted external support gateway
- Each debug or support interface declares a stable ID, version, typed parameters, output schema, applicable variants, execution permissions, side effects, and log fields
- The release support gateway accepts only ADB shell or root identity, not ordinary app UIDs, and does not open network listeners
- The in-app ADB/Shell mode continues to use the original Shell executor and app permissions, and is not restricted by the external ADB gateway
- Data rescue paths and snapshot export are extracted from the UI layer into a reusable service
- The in-app Shell and the release support gateway both provide data rescue path viewing and snapshot export
- The first release support batch provides log reading or following, data rescue paths, and data snapshot export, and does not open restore-overwrite, arbitrary SQL, arbitrary paths, or arbitrary commands

## Scope of Changes

Planned changes:

- `app/src/main/java/com/ai/assistance/operit/core/debug/`
- `app/src/debug/`
- `app/src/main/java/com/ai/assistance/operit/core/tools/system/shell/`
- `app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt`
- `app/src/main/java/com/ai/assistance/operit/data/backup/OperitBackupDirs.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/recovery/`
- `app/src/main/java/com/ai/assistance/operit/util/AppLogger.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/`
- `tools/adb/execute_js.*`, `tools/adb/run_sandbox_script.*`, and the corresponding scripts after migration
- Debug interface schema, registry manifest, and interface tests

This step does not change:

- The command execution semantics of the in-app Shell executor
- The data rescue UI's restore, SQL, and file management functions
- The raw snapshot file format

## Plan

1. Define `DebugCommand`, parameter schemas, result schemas, exposure scopes, and `DebugCommandRegistry`.
2. Exposure scopes must at least distinguish `INTERNAL_SHELL`, `EXTERNAL_QA_DEBUG`, and `EXTERNAL_RELEASE_SUPPORT`, and must be explicitly chosen at registration time.
3. Create a QA ADB debug gateway that exists only in the debug source set, looks up registry entries by command ID, and validates typed parameters.
4. Restrict `ScriptExecutionReceiver`, the generic `EXECUTE_JS` action, and the calling scripts to QA debug builds and their development tools, and remove them from all release source sets.
5. Convert ToolPkg debug installation, package refresh, DSL dump, and the three QA offline scenarios into separate, named, typed-parameter registered interfaces.
6. Create a release support gateway that limits callers to ADB shell or root via Manifest permissions and runtime caller identity checks, and dispatches only `EXTERNAL_RELEASE_SUPPORT` commands. The action name itself is not access control.
7. Keep `DebuggerShellExecutor`, the in-app Shell tools, and the terminal execution paths independent, so the external gateway does not change their capabilities.
8. Extract `DataRescuePaths` from the data rescue implementation, uniformly resolving `files`, external files, `shared_prefs`, `datastore`, `databases`, and the raw snapshot output directory.
9. Extract an export service from `RawSnapshotBackupManager` that can be called jointly by the UI, the internal Shell, and release support, keeping the existing snapshot manifest and ZIP structure.
10. Register `data_rescue_paths`, returning path IDs, canonical paths, existence, and access status to `INTERNAL_SHELL` and `EXTERNAL_RELEASE_SUPPORT`.
11. Register `data_rescue_export`, returning the output path, size, hash, and manifest information to `INTERNAL_SHELL` and `EXTERNAL_RELEASE_SUPPORT`.
12. Extract a read-only log source from `AppLogger.getLogFile()` and the existing logcat reading logic, and apply sensitive-information sanitization to release output.
13. Register `support_logs_read` and `support_logs_follow`, writing sanitized app logs to the caller's shell, with limits on filter fields, single-read volume, and follow duration.
14. Data restore-overwrite, arbitrary SQL, arbitrary file paths, and arbitrary shell commands are not registered as `EXTERNAL_RELEASE_SUPPORT`.
15. Generate a machine-readable interface manifest from the registry, for use by documentation, script parameter checks, and APK auditing.

## Acceptance Criteria

- The QA debug Manifest contains the generic `EXECUTE_JS` external entry point and the named ADB debug gateway
- The QA debug named gateway can only execute command IDs registered as `EXTERNAL_QA_DEBUG`; the generic entry point continues to handle free-form debugging
- Unregistered commands, parameter type errors, and exposure scope mismatches all terminate explicitly and are logged
- Release APKs contain no generic execution receiver or QA debug gateway, but do contain the external support gateway and approved support commands
- Ordinary app UIDs cannot call the release support gateway; ADB shell and root can call it
- The release support gateway passes both Manifest permission and runtime caller identity checks
- The in-app ADB/Shell mode's existing command execution capabilities remain unchanged
- The data rescue UI and the internal Shell use the same `DataRescuePaths` and snapshot export service
- `data_rescue_paths` and `data_rescue_export` can be called from the release external shell, but do not accept arbitrary paths, arbitrary SQL, or restore-overwrite requests
- `support_logs_read` and `support_logs_follow` write sanitized logs to the external shell, without establishing a network service
- The raw snapshot format and existing data rescue UI behavior remain consistent

## Completion Record

Status: Not started. Before completion, the verification results for QA debug generic execution, the named registry, release support caller restrictions, log output, internal Shell preservation, data rescue paths, and snapshot export must be recorded.
