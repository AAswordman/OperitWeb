---
fork: https://github.com/tuxKOH/Operit
branch: token-statistics-long
---

# Token Statistics Long Migration

## Original State

The usage in model responses, turn snapshots, message and session persistence, archiving, and statistics display did not uniformly use the same numeric type. Cumulative statistics already partially used `Long`, but per-turn counts, provider parsing, and persistence fields still used `Int`, so large values could be truncated or overflow before entering cumulative statistics.

## Intent of the Change

Make all token statistics counts use `Long` uniformly, from provider response parsing through to UI display. The statistics cover input, output, cached input, and current context window counts, and do not include auth credentials, tokenizer internal indices, or model parameter configuration.

## Expected Results

- Provider usage can read input, output, and cached tokens as `Long`.
- Runtime per-turn and cumulative token statistics stay `Long`.
- Room entities, chat archives, preference statistics, and HTTP bridge models no longer represent token statistics as `Int`.
- Existing database values and JSON numeric payloads remain readable, and the statistics page displays large values correctly.

## Scope

- AI provider usage parsing and token counting interfaces
- Turn statistics, message processing, and session history saving
- Room entities, archive models, preference accumulations, and HTTP/ToolPkg bridging
- Chat and settings page statistics state and display

## Verification Record

- A static search covered 37 Kotlin source and test files. No `Int` declarations exist for input, output, cached input, current window, or per-call statistics fields.
- Provider usage already uses `optLong`. The remaining 4 token-related `optInt` calls are only for model `max_tokens` or local model capacity configuration, not usage statistics.
- `Int.MAX_VALUE` truncation of token statistics has been removed from runtime, save callbacks, and ToolPkg parsing.
- Per the repository's local working constraints, no build or test commands were run for this change.
