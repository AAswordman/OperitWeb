---
fork_repository: local
---

# Session Reclamation After Abnormal Terminal Exit

## Background

After a visible terminal's PTY process exits abnormally, the exit notice is written to the screen, but the old session remains in the session state table. A same-named `terminal.create` keeps reusing that session, and subsequent commands cannot be written to the closed PTY.

## Goal

- End the current command's wait when the terminal exits
- Immediately release the dead session and its PTY resources
- Keep existing tool and AIDL contracts unchanged
- The next same-named terminal call automatically creates a new session

## Scope

- `terminal/src/main/java/com/ai/assistance/operit/terminal/TerminalManager.kt`
- `docs/TODO/terminal_session_auto_recovery_20260808/`

## Steps

1. [Done] Remove the dead session after abnormal exit handling completes the current command
2. [Done] Record the behavior of recreating on the next call under the same session name
3. [Done] Check workspace changes; no build or test executed

[DONE]
