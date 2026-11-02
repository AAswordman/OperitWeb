---
fork: local workspace
branch: fix/preserve-interrupted-ai-output
status: implementation-complete
---

# Fix for preserving interrupted AI output on network loss

## Original state

When AI streaming output encounters a network error, the Provider first emits a rollback event, then decides whether there is still a retry opportunity. After retries are exhausted, EnhancedAIService only publishes an error state and ends the stream. The message processing layer treats this ending as normal completion, and finally writes the empty streaming snapshot back to the same AI message, overwriting the content that had already been persisted.

## Intent of the change

When network retries fail, preserve the already confirmed AI output, and complete the message as an interrupted turn. Send a rollback event only when a new attempt is actually about to start, avoiding clearing the message prematurely for non-retryable errors and for errors after retries are exhausted.

## Expected results

- After a network loss with retries exhausted, the already output content is still kept in the same AI message
- A network failure shows an error state, and is not treated as normal completion
- The existing behavior for actively cancelling interrupted messages is unchanged
- Streaming display for successful retries and tool call rollback still work

## Scope

- Retry decisions and rollback ordering in the OpenAI, Claude, and Gemini Providers
- Final failure propagation in EnhancedAIService
- Interrupted message finalization in MessageProcessingDelegate
- Streaming message finalization regression tests
- Markdown tail updates after rollback

## Verification record

- Provider regression tests have been added, verifying that a final failure preserves the already output text and does not send a rollback event
- Shared stream regression tests have been added, verifying that an upstream exception continues to be passed to the collecting end after replaying partial content
- In accordance with the repository's working constraints, no build or test commands were executed this time

Implementation is complete. [DONE]
