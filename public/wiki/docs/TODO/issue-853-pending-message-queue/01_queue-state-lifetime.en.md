---
fork: https://github.com/AAswordman/Operit.git
issue: https://github.com/AAswordman/Operit/issues/853
---

# Queue State Ownership

## Old Implementation

The input screen's `pendingQueueMessages` uses the current session ID as the `remember` key. When switching sessions, the old list leaves the composition tree and no ViewModel or storage layer holds its contents. The queue send coroutine also reads the ID from the currently selected session, so switching sessions while the coroutine is waiting may send the message to the wrong session.

## Fix

A new standalone queue state store is added, held by `ChatViewModel`, saving messages, expansion state, and auto-dequeue control state by session ID. The input screen only subscribes to the current session's state and calls ViewModel operations. When sending, the session ID that owns the queue is captured and submitted through the existing background send interface with that ID.

## Expected Result

When switching to another session and returning, the queue panel keeps its original messages. After the original session finishes output, queued messages are still sent to the original session, rather than depending on whatever other session the UI is currently displaying.

## Verification

- `PendingMessageQueueStoreTest` has been added, covering cross-session retention and auto-dequeue control after cancellation
- `git diff --check` has been run
- Gradle tests were not run, following the repository's default execution constraints

[DONE]
