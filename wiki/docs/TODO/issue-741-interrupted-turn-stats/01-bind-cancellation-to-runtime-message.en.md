# Binding the Interruption Snapshot to the Runtime Message

## Old Implementation

Cancellation finalization reloaded the chat history from Room and required the target AI message's `contentStream` to be non-empty. `contentStream` is marked as a transient field and does not belong to the database entity, so after reloading, no message satisfies that condition.

## Fix

1. `ChatRuntime` saves the current streaming AI message and the Waifu segment list.
2. Before the cancellation task, read that object and the statistics snapshot; after the task stops, hand both to the finalization logic together.
3. Finalization logic only reads the matching user message from the database and no longer uses database objects to identify the streaming AI message.
4. The turn number and cancellation mutex ensure an old cancellation request does not clean up a new turn.
5. Normally completed and cancelled turns clean up the runtime message reference after completion.

## Acceptance

- The interrupted message is written with partial content, `completedAt`, tokens, and elapsed time.
- The user message already written before the interruption gets the same turn statistics.
- Segment messages already persisted in Waifu mode get the same statistics.
- Streaming message identity does not depend on a field that does not exist in Room.

[DONE]
