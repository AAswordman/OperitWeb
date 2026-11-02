---
fork: https://github.com/AAswordman/Operit
date: 2026-09-17
source: User email feedback (floating window crash + re-roll switching stuck)
---

# Floating Window NaN Crash Fix

## Original Situation

User feedback (appearing from 1.12.1+3/+4, still present in +7):

- As soon as the floating window starts, the app immediately crashes and restarts infinitely, and the main UI cannot be entered at all; the app is only usable after turning off the "Display over other apps" permission.
- Crash stack: `IllegalArgumentException: Cannot round NaN value`, at `FloatingChatWindowScreen.kt:194` (the measure block of `FloatingChatWindowContent`, `viewModel.windowState.width/height.toPx().roundToInt()`).

## Confirmed Code Problems and Causes Pending Confirmation

1. Data path: window size/scale are persisted as floats in `floating_chat_prefs` (`FloatingWindowState.restoreState`). Currently no device preference file or reproduction evidence proves they contain NaN/Infinity. Kotlin's `Float.coerceIn` always returns false for both boundary comparisons against NaN, so NaN passes through unchanged and throws in Compose measure's `roundToInt`.
2. Amplification mechanism: `FloatingChatService` runs in the same process as the main UI (no android:process in the manifest), so an uncaught exception kills the entire process, and the main UI becomes unusable too. The `handleServiceCrash` protection of "auto-disable after 4 consecutive crashes" uses an in-memory counter; each crash kills the process and resets the counter to zero, so the threshold is never reached, resulting in an infinite crash-restart loop. The user can only save themselves by manually turning off the floating window permission.
3. If the state already contains NaN, the original `saveState` would write it back unchanged, and clearing the cache would not clear shared_prefs; this is a possible ongoing propagation path, but it cannot yet be used to determine the source of the first NaN.

## Changes in This Round (Scope)

1. `services/floating/FloatingWindowState.kt`
   - When `restoreState()` reads `window_width` / `window_height` / `window_scale` / `last_window_scale`, it validates `isFinite()`; illegal values produce an explicit error, which the service logs and then aborts startup. `saveState()` likewise refuses to write non-finite values. Existing illegal configurations are not automatically rewritten.
   - Reads and writes share a cap no smaller than the minimum window size, avoiding an inverted `coerceIn` range on small screens. [DONE]
2. `services/FloatingChatService.kt`
   - The crash count is changed to persistent storage (`crash_count` + `last_crash_time`), so the existing mechanism — disable the floating window service after 4 crashes within 60 seconds — takes effect across process restarts. The count, time, and disable flag are synchronously committed in one pass before calling the default exception handler, and write failures are logged.
   - After disable or initialization failure, the startup callback stops the service directly and returns `START_NOT_STICKY`, avoiding access to uninitialized objects; on destroy, cleanup is performed according to initialization state and the exception handler is unregistered. [DONE]
3. `ui/features/chat/viewmodel/FloatingWindowDelegate.kt`
   - When the user explicitly enters the floating window from the main UI (`toggleFloatingMode` / `launchInMode`), the disable flag, count, and timestamp are cleared, as the manual recovery entry for this protection: an explicit action means re-authorization, and if the same crash persists, the service will disable itself again after 4 consecutive crashes. [DONE]
   - The result of active binding is logged; on window display failure or an empty Binder, the binding is released and the floating window mode state is cleared, so a service that failed to initialize can finish stopping and subsequent user actions can restart it. [DONE]

## Not Handled / Follow-ups

- The first generation cause of NaN still needs device preference data or reproduction logs to confirm. This round cannot claim to have restored the floating window on all affected devices; existing illegal sizes will cause this round's floating window startup to fail explicitly.
- Re-roll switching stuck after switching AI answers (only recovers after switching pages away and back, and 2/3 replies show identical content): the `selectMessageVariant → reloadCurrentChatDisplayHistory → CurrentChatWindowController` chain and the variant numbering of `regenerateAiMessageVariant` have been investigated, and no inevitable cause was located in static code. Two suspects for follow-up:
  - `ChatHistoryManager.addMessageVariant` computes the next variantIndex as `variants.size + 1` and writes with REPLACE; if variants were deleted, the new index may overwrite an existing variant row, causing "two variants with identical content".
  - Whether display window pagination (`reloadCurrentChatDisplayHistory` anchored on displayEndTimestamp) refetched the new content after variant switching needs user-side logs to confirm.
  The user needs to provide exported data or more logs for that session before it can be located; blind changes are not appropriate.
