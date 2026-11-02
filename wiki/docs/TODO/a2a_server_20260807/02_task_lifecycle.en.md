# 02 Task Lifecycle

## Changes

- Generate a server-side task ID for each A2A request, and save the context ID, internal chat ID, status, output, and activity-stream session.
- Each new A2A context creates a standalone Operit chat; subsequent new requests associated with the same context reuse the corresponding chat.
- `SendMessage` returns the task following the A2A 1.0 `returnImmediately` semantics, while in the background the streaming chat execution is mapped to working, completed, failed, or cancelled states.
- `SendStreamingMessage` and `SubscribeToTask` send A2A 1.0 Stream Responses with a JSON-RPC envelope over SSE.
- `GetTask`, `ListTasks`, and `CancelTask` provide a snapshot, paged queries, and cancellation respectively.

## Expected Result

A2A calls do not share or tamper with the user's ongoing regular chats, and clients can query and cancel tasks while the service is still alive.

[DONE]
