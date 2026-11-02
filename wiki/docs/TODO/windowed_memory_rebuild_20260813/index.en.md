---
fork_repository: https://github.com/AAswordman/Operit.git
---

# Windowed Rebuilding of Chat Memories

## Current State

Long-term memory auto-saving is enqueued after a reply completes, and when processing it only reads the most recent 48 messages before the triggering message. Manual memory saving in chat settings reads the current runtime window; for very long sessions that already have multiple chat summaries, it cannot reliably rebuild previously lost memories.

## Intent

In "Settings - Chat History Management", select one or more sessions, specify the message window size for each AI extraction task, and rebuild long-term memories in order. Each window reuses the existing knowledge-graph extraction, retrieval-based deduplication, merging, and material-update logic, without submitting the entire session to the model at once.

`summary` messages in chats do not participate in long-term memory extraction. The page shows session, window, and message progress, supports cancellation, and after a single window fails, continues processing the remaining windows and accumulates the failure count.

## Scope

- New unit-testable window planner and rebuild coordinator
- Unify memory-graph model output into a named-object protocol; protocol errors count toward window failures
- Provide window size and build entry, progress, and cancellation operations in the multi-select area of chat history management
- Provide default language resources for new copy
- New JVM unit tests for the window planner

## Acceptance

- The user can select one or more chat records, choose a window size, and start rebuilding
- Each model request receives only the raw user/assistant messages of one limited window; summaries are not mixed into memory analysis
- Progress shows the current session, window count, processed message count, and failure count
- After cancellation, no new window is started; memories from completed windows are retained
- Rebuilding reuses the existing memory-graph storage logic and memory-space binding rules
- Valid `new`, `update`, `merge`, and `links` do not depend on the existence of a `main` node

Steps:

- [01 Window Planning and Rebuild Coordinator](01_window_planning_and_rebuild_coordinator.en.md)
- [02 Chat History Management Entry and Progress](02_chat_history_management_ui.en.md)
- [03 Testing and Device Validation](03_test_build_and_device_validation.en.md)
