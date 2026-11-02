---
status: implementation-complete
---

# Per-Call Limit on Tool Results

## Original State

Although each tool result was length-limited, all tool results in a round were additionally capped at 64,000 characters in total. When multiple tools were called in parallel, the earlier results would fill the whole round budget and later results were discarded outright, leaving the history conversion layer to mark them as missing.

## Intent of the Change

Limit only the serialized length of an individual `tool_result`, keep all tool results in the round, and ensure every tool call has a corresponding result slot. Overall context length continues to be handled by token counting and the summarization flow.

## Scope

- Remove the whole-round tool result character cap
- Make the limit constant explicitly a per-tool-result cap
- Limit image-link appended content so a single result cannot exceed the cap again
- Add regression coverage for retaining multiple tool results

## Progress

- [DONE] Removed whole-round result truncation
- [DONE] Kept per-result truncation and XML integrity
- [DONE] Added regression tests
- [DONE] Did not run build or test commands per repository constraints
