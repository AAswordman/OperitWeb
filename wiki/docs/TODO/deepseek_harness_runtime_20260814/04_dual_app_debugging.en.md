---
title: ADB Dual applicationId Debugging Support
status: completed
---

# ADB Dual applicationId Debugging Support

## Current State

The ADB JS executor, the ToolPkg debug installer, and the example package hot-update script hardcode the Release applicationId `com.ai.assistance.operit`, along with its corresponding action, receiver, and external directories. When using the Debug APK `com.ai.assistance.operit.debug`, the scripts push files to the wrong directory, and broadcasts are not received by the Debug APK.

## Changes

- All ADB JS executors (single file, directory, sandbox) and Compose DSL debug exports support both applicationIds.
- `tools/toolpkg/debug_toolpkg.py` gains `--app-package` and reads `OPERIT_APP_PACKAGE`.
- Hot update in `tools/example_packages/sync_example_packages.py` gains `--app-package` and reads `OPERIT_APP_PACKAGE`.
- When not explicitly specified, query the device's installed packages, selecting in the order Debug, then Release.
- The action, receiver, `js_temp`, and `files/packages` are all generated dynamically from the finally selected applicationId.
- Example package hot-update signatures are isolated by "device serial number + applicationId"; switching between Debug/Release syncs them separately.
- Before each debugging session, print the applicationId actually in use, to avoid a mismatch between the debugging tools and the APK on the phone.

## Acceptance Criteria

- When only the Debug APK is installed, all scripts use `com.ai.assistance.operit.debug`.
- When only the Release APK is installed, all scripts use `com.ai.assistance.operit`.
- When both APKs are installed, the unspecified configuration uses Debug; after setting `OPERIT_APP_PACKAGE` or passing `--app-package`, the specified version is used.
- When the specified applicationId is not installed or is not one of the two supported values, the script reports an error directly and stops.
- The old Release debugging path remains unchanged, except that the fixed value is replaced by the resolved result.

[DONE]
