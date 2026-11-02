---
title: DeepSeek Harness Explicit Runtime Lifecycle
status: in_progress
---

# DeepSeek Harness Explicit Runtime Lifecycle

## Current State

Entering the sidebar executes version checking, pnpm installation, and Web startup as one combined step. As long as the local DSH process is not running, `pnpm add @latest` is executed automatically, and the user cannot decide whether to update before downloading or compiling.

During installation, the status area only shows the last terminal fragment; terminal echo and real pnpm output are mixed together, making it impossible to tell the current phase and actual progress.

## Changes

- After entering the sidebar, first read the local DSH version, then explicitly query the upstream `latest` version.
- When uninitialized, show only the initialization action; when a new version is detected, show two actions: install the update, and continue using the current version.
- When the local version is already the latest, start the existing DSH directly without running pnpm install commands.
- Split the runtime API into check, install/update, and start, removing the automatic-install semantics.
- The install script emits structured phase and output events; the UI shows the current install phase above and the pnpm and compilation output below.
- Rearrange the waiting screen into a header, status summary, version information, action area, and an install output area that appears on demand.
- Static states such as uninitialized, update found, and error do not show a progress bar; progress is shown only during check, install, start, and page loading.
- Action buttons use icons, a stable height, and 8px rounded corners; install output is displayed in a read-only terminal style.
- On install failure, keep the exact failing command, exit code, timeout status, and raw terminal output; a missing structured result must not overwrite the real error.
- The installed version is read through the Linux file API using an absolute path list, without depending on the working directory of a new terminal session.

## Acceptance Criteria

- An installed DSH with the same version only checks the version and starts the Web, without running `pnpm add` or `pnpm install`.
- When an update is detected, the install command can only be triggered by the user clicking the update action.
- On first use, the install command can only be triggered by the user clicking the initialization action.
- The install screen shows the current step, the progress bar, and continuously appended structured install output at the same time, without showing PTY input echo.
- Static action pages do not show a 0% progress bar, and the version and primary actions keep a clear hierarchy even on narrow screens.
- When prerequisite checks such as Node.js fail, still return native shell structured events, and show the copyable command result in the UI.
- When re-entering the sidebar, the installed version can be read from absolute paths; when the check fails, the UI shows specific diagnostic information.
