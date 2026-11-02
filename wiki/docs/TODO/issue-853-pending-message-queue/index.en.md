---
fork: https://github.com/AAswordman/Operit.git
issue: https://github.com/AAswordman/Operit/issues/853
---

# Issue 853 Pending Message Queue

## Current State

The pending message list, the list expansion state, and the auto-send control state are all saved by `AIChatScreen` with `remember(currentChatId)`. Selecting another session destroys the composition state corresponding to the original session, so on returning, the UI can only obtain a new empty queue, and text the user already submitted to the queue is lost as a result.

Long-session switching no longer uses full history loading. `ChatHistoryDelegate` reads the most recent display pages in reverse chronological order on the IO scheduler, keeping at most two pages; `ChatArea` uses a lazy list to render the current display window. This path does not need a separate replacement loading strategy for this issue.

## Goal

- Pending messages belong to `ChatViewModel` by session ID; switching sessions and UI recomposition must not clear them
- Auto-send and user manual send always use the session ID that owns the queue
- Keep the existing queue editing, deletion, cancel-current-reply-then-send, and auto-send behavior

## Scope

- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/`
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt`
- `app/src/test/java/com/ai/assistance/operit/ui/features/chat/viewmodel/`
- The implementation notes in this directory

## PR

To be created

## Completion Status

- Queue state ownership and delivery to the original session are complete
- The long-session switching path has been audited; the existing pagination strategy was not modified
