# Shared Stream Termination Cause

## Old Implementation

`HotStream.share` sent the upstream exception as the cause of `Completion`, and every `collect` would rethrow that exception.

## New Implementation

The shared stream exposes a read-only `completionCause`. The default behavior still propagates the exception to collectors; the chat message shared stream disables propagation, and message-processing subscriptions and bystander subscribers only receive the already cached content and end normally. The chat sending chain records the terminal-state exception during the provider streaming collection phase and ends the stream, without converting that exception into a user-facing error.

## Verification

- `HotStreamTest` keeps the default exception propagation test
- A new test disabling propagation verifies that partial content and the termination cause are retained at the same time
- The chat sending chain no longer actively throws the shared stream termination cause

[DONE]
