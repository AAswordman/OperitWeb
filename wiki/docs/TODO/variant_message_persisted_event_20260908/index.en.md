---
fork: local workspace
branch: fix/variant-message-persisted-event
status: in-progress
---

# Variant Message Persisted Event Fix

## Original Situation

PR #1122 re-emitted the `message_persisted` event for regenerated message variants, but the event payload was constructed from the message object during generation. When message variants reload, they inherit the base message's display state, so the payload may be inconsistent with the final message in the database. The PR's tests only called the bridge directly and did not cover the variant persistence path.

## Intent of the Change

Merge PR #1122, and make variant persistence events use the final persisted message attributes. Add regression tests covering `addMessageVariant`, verifying the event's message identifier, variant index, favorite state, and display state.

## Expected Results

- Each successful variant addition dispatches `message_persisted` exactly once
- The event payload matches the selected variant after reloading
- External sync can pinpoint the message accurately using timestamp and variant index

## Scope

- PR #1122
- `ChatHistoryDelegate.addMessageVariant`
- ToolPkg message persisted event tests

## Progress

- [DONE] PR review and defect localization
- [DONE] Merge PR #1122
- [DONE] Construct variant events from the persisted message
- [DONE] Add variant persistence path tests
- [DONE] Static checks and merge back to `dev`

## Verification Record

- Checked that all `addMessageVariant` callers adapt to the persisted result type
- Covered variant entity conversion and event dispatch: the base message's timestamp, display state, and favorite state must be preserved, while the generated message's content and variant index must be updated
- Per repository working constraints, no build or test commands were executed this time
