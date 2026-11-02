# Unify Token Statistics Types

## Old Implementation

Token statistics mixed `Int` and `Long`. Some services converted to `Long` before returning to cumulative statistics, but response parsing, single-turn state, messages, and session persistence still carried `Int`, so 64-bit precision could not be guaranteed across the full statistics chain.

## Fix

1. Define input, output, cached-input, and current-window Token counts as `Long`.
2. Use JSON's `optLong` to read provider usage, and make ToolPkg numeric reads return `Long`.
3. Synchronize the fields and callback signatures of messages, sessions, archives, preferences, and bridges.
4. Remove overloads and truncating conversions kept only to accept `Int` statistics values.

## Acceptance

- No global Token statistics field is declared as `Int`.
- Usage parsing does not read Token statistics as `Int`.
- Upstream providers, persistence, and UI use the same `Long` type.

[DONE]
