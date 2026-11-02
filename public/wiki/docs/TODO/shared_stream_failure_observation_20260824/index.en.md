---
For_Agent: Shared stream failure closing contract
---

# Shared Stream Failure Closing Contract

## Original State

OpenAI, Claude, Gemini, and their protocol proxies all throw the terminal exception upward after retries are exhausted. Once a chat message is converted into a shared stream, that exception is re-thrown to all subscribers; message-processing subscribers can close it out, but render-only subscribers escalate the network failure into a global uncaught exception.

## Intent of the Change

Keep the provider's terminal exception log and interruption message content, while letting both the message-processing subscription and the UI subscription of the chat shared stream end normally. The chat send chain ends the current stream at the provider streaming collection stage, and no longer converts that exception into a user-facing error.

## Scope

- `HotStream`'s shared stream end reasons and optional exception propagation
- `shareRevisable`'s chat stream configuration
- The provider failure closing relationship between `EnhancedAIService` and `MessageProcessingDelegate`
- Error text output of `LlamaProvider` and `MNNProvider`
- Shared stream API documentation and regression tests

## Expected Results

- Retry, usage, and terminal exception behavior of each remote provider stays unchanged
- Bystander subscribers such as the chat UI do not trigger a global crash from a provider network exception
- The message-processing layer saves the interrupted content already received, and no longer pops up the provider's terminal error
- Local provider failures no longer write error text into the AI reply
