---
fork: local workspace
branch: fix/unmatched-tool-history
status: implementation-complete
---

# Unmatched Tool History Fix

## Original State

History serialization writes a placeholder `role=tool` message when a tool call has no corresponding execution result, to satisfy each provider's tool-call protocol. The old implementation marked that message as `User cancelled`, causing the model to misinterpret the missing history as a manual cancellation. PR #1131 changed the wording to "unmatched", but it had not yet been merged into `dev`.

## Intent of the Change

Merge the semantic fix from PR #1131, and unify the placeholder records of the current providers and the structured bridge layer. A placeholder record only expresses missing local history; it does not mean the tool has already executed or the conversation was cancelled.

## Expected Results

- Unpaired tool calls still satisfy providers' request protocols
- History placeholder content no longer contains `User cancelled`
- Real cancellation flows continue to use the actual cancellation reason
- OpenAI-compatible providers, Claude, Gemini, DeepSeek, and Kimi use the same semantics

## Scope

- Merging PR #1131
- Tool history serialization placeholder content and logs
- Related JVM regression tests

## Progress

- [DONE] Log and current-implementation review
- [DONE] Merge PR #1131 and resolve current `dev` differences
- [DONE] Unify unmatched tool call placeholder semantics
- [DONE] Static checks of changes
- [DONE] Merge back into `dev`

## Verification Records

- Verified that history serialization no longer uses `User cancelled` or the old static unmatched-result text
- Added regression assertions for placeholder content in partial batches and at the end of history
- Per the repository's working constraints, no build or test commands were executed this time
