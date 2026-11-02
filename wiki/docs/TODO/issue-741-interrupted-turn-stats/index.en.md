---
fork: https://github.com/luojiaping/Operit
issue: https://github.com/AAswordman/Operit/issues/741
branch: fix/issue-741-interrupted-turn-stats
---

# Interrupted Turn Statistics Fix

## Original Situation

Before cancelling model output, the message processing layer had already read the current Token and elapsed-time snapshot. After the cancellation task ended, the finalization logic would reload the message from Room and look up the streaming message through `contentStream`, which exists only in memory. Room does not save that field, so the lookup could not hit, and partial replies, Tokens, elapsed time, and completion time would not be written back.

## Intent of the Change

Each session's runtime object holds the current persistable streaming AI message. The cancel operation obtains a reference to that message before terminating the task; after the task stops, it directly completes and persists that same message, instead of inferring runtime identity from the persisted model.

## Expected Results

- After the user interrupts normal chat output, the already generated content remains retained.
- The message info's input Tokens, output Tokens, wait elapsed time, and output elapsed time reflect the snapshot at the moment of interruption.
- Segmented messages already formed in Waifu mode receive the same turn statistics.
- Existing behavior for normal completion, non-persisted turns, and single-message regeneration is unchanged.

## Scope

- Per-session runtime message ownership in `MessageProcessingDelegate`
- Finalization and runtime cleanup of interrupted-turn messages
- Execution order of Web session deletion and discard-style cancellation
- Unit tests for message completion rules

## Verification Record

- Added `MessageProcessingDelegateTest`, covering partial content, Tokens, elapsed time, send time, completion time, and stream reference cleanup in the interrupted message payload.
- In accordance with the repository's local work constraints, no build or test commands were executed this time.
