# Coordinating Session Deletion and Cancellation

## Old Implementation

When the Web interface finds the target session still producing output, it asynchronously requests cancellation and immediately deletes the database session. Once interruption finalization starts writing a partial message, these two operations may interleave, causing the message to be written into an already-deleted session.

## Fix

The Web delete interface waits for summarization and message processing to finish a discarding cancellation, then performs the session deletion. A discarding cancellation does not persist the partial reply.

## Acceptance

- When deleting an active session, the cancellation task finishes first, and the chat history is deleted afterwards.
- The normal save path of interrupted-turn statistics does not participate in destructive deletion.

[DONE]
