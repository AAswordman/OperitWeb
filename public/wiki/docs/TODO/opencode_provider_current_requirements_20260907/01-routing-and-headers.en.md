# Routing and Request Headers

## [DONE] Model List Endpoint

Zen uses `https://opencode.ai/zen/v1/models`, and Go uses `https://opencode.ai/zen/go/v1/models`. The endpoint is uniformly completed with the version segment by the existing `OpenCodeRouting.normalizedBase`.

## [DONE] Protocol Routing

- GPT, Grok, and Muse Spark use OpenAI Responses.
- Claude and Qwen use Anthropic Messages.
- Gemini uses Google Generative Language.
- DeepSeek, GLM, Kimi, MiMo, MiniMax Zen, and Go's other open models use OpenAI-compatible Chat Completions.
- MiniMax Go uses Anthropic Messages; MiniMax Zen's free compatible models are still handled under the Anthropic protocol as listed in the catalog.

## [DONE] Go Client Identity

- `User-Agent` uses `Operit/<version>`.
- `x-opencode-session` uses the model configuration ID to generate a stable value, so requests created from the same configuration stay consistent.

The current `AIService` interface does not pass the session ID owning the chat history to the provider, so a stable model configuration identifier is used here; if the public chat interface later exposes a session ID, this value should be replaced with the real chat session identifier.

