---
topic: Update OpenCode Zen and Go provider requirements
status: done
---

# OpenCode provider current requirements

## Official changes

OpenCode currently places the public APIs of Zen and Go under versioned `/v1` paths. Model IDs use `opencode/<model-id>` and `opencode-go/<model-id>` respectively, and the model protocol is decided by the official catalog; it can no longer be judged only by a rough prefix of the model name.

OpenCode Go also requires clients to use their own `User-Agent` and to send a stable `x-opencode-session` request header for each session.

References:

- [OpenCode Zen](https://opencode.ai/docs/zen)
- [OpenCode Go](https://opencode.ai/docs/go)
- [OpenCode provider source](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/provider/provider.ts)

## Repository status

- Request routing is already isolated in `OpenCodeProvider.kt`, but the model list address lacks `/v1`.
- MiniMax uses different protocols in Zen and Go, and the old routing did not distinguish endpoints.
- Qwen, Muse Spark, and the current Go model set are not fully covered.
- Go requests do not declare Operit's client identity and session header.

## Scope of changes

- Fix the Zen/Go model list endpoints.
- Update the Responses, Anthropic, Gemini, and Chat Completions routes according to the official Zen/Go endpoint table.
- Add Operit's `User-Agent` and a stable configured session identifier to Go requests.
- Keep public providers unaware of OpenCode-specific protocols.
