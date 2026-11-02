# Tool Stream Reconcile Plan

## Plan Progress

- [x] Define the minimal side-event channel protocol: `SAVEPOINT / ROLLBACK + id`
- [x] Design and start wiring in a revisable text stream wrapper
- [x] Let `EnhancedAIService` and the two intermediate `share()` calls keep passing the side channel through
- [x] In the OpenAI-compatible path, switch "abnormal close-off" to "abnormal rollback to savepoint"
- [x] Let the main chat UI rebuild the currently displayed stream on rollback
- [x] Do another round of code self-review and edge-case analysis
- [x] Add consistency handling for the remaining consumers as needed
- [ ] Final documentation wrap-up

This document discusses only one minimal, landable plan.

Prerequisites:

- The current version is already released.
- The existing `tool_xxxx` random XML tag scheme must be kept and remain backward compatible.
- No big rewrite such as "turning the whole `Stream<String>` into a unified event stream".
- The goal is to fix the "half old tool + new tool" pollution produced in the OpenAI-compatible path when a tool streaming output is interrupted mid-way by a network drop and then retried.

Typical bad shape:

```xml
<tool_ABC name="read_file">
<param name="path">/a/b

<tool_bcd name="read_file">
<param name="path">/a/b/c.txt</param>
</tool_bcd>
```

The problem here is not "tool id mismatch", but:

- The truncated old tool has already entered the current display.
- The truncated old tool may also enter the subsequent retry context.
- After the retry, the model regenerates a new random `tool_xxxx`.
- So the old fragment and the new complete package coexist.

## 1. Goal

There is only one goal:

- Allow streaming display to continue to exist.
- But once this round's assistant output is found to be "uncommitted content", it can be rolled back to some safe point.

What is wanted here is not "ignore subsequent text", but "truly retract the dirty half that has already been displayed".
The commit boundary is now placed not at the `tool` level, but at the "this round's assistant attempt" level.

## 2. Minimal Protocol

The main text stream stays unchanged:

- Still `Stream<String>`
- Still normal `emit(chunk)`
- Still keep the existing `tool_xxxx` protocol

An additional side event channel is added:

```kotlin
interface RevisableTextStream : Stream<String> {
    val eventChannel: Stream<TextStreamEvent>
}

data class TextStreamEvent(
    val eventType: TextStreamEventType,
    val id: String
)

enum class TextStreamEventType {
    SAVEPOINT,
    ROLLBACK
}
```

Only two events are kept:

- `SAVEPOINT(id)`: record the current full-text snapshot
- `ROLLBACK(id)`: return to this snapshot

Events carry only two items:

- `eventType`
- `id`

No text, no offset, no character count.

## 3. Why Only These Two Events

The following are not recommended:

- `RollbackChars(n)`
- `DeleteLastChunk`
- Text terminators
- Complex state-machine events

The reason is simple:

- Character-level rollback is too fragile; it breaks as soon as chunking changes.
- Terminators pollute the body text and history.
- Complex events would make the plan heavy.
- What is really missing now is the ability to "return to a safe snapshot", nothing else.

So the first version keeps only:

- `SAVEPOINT`
- `ROLLBACK`

## 4. Provider-Side Behavior

The provider side only takes minimal actions.

Before this round's assistant request starts:

- Emit one `SAVEPOINT(id)`

If this round completes normally:

- No extra event is needed

If this round is interrupted mid-way by a network drop, abort, or retry:

- Emit one `ROLLBACK(id)`

In other words:

- A normally completed round needs no "commit event"
- Only an abnormally ended round needs a rollback

The meaning of this is:

- All already-displayed text of the old attempt is voided as a whole
- On retry, the original `message + history` is resent
- No longer rely on the LLM's "continue from interruption" continuation prompt

## 5. Actual Chain

The current chain is not provider directly to UI, but:

1. `provider`
2. `EnhancedAIService`
3. `AIMessageManager`
4. `MessageProcessingDelegate`
5. `ChatMessage.contentStream`
6. UI renderer

There is a key reality here:

- In this chain, the text stream is `share()`d at least twice.

In other words, if `EnhancedAIService` merely returns a "custom stream with an event channel", but the later `share()` calls do not recognize this capability, then the side event channel will be lost midway.

So the plan cannot be written as:

- "`EnhancedAIService` wrapping it once is enough"

It must be written as:

- "`EnhancedAIService` emits the side-channel capability, and the subsequent links keep passing this capability through, all the way to the UI"

## 6. Minimal Landing Points

### 6.1 EnhancedAIService

`EnhancedAIService` can reuse the old trick:

- Wrap the main text stream returned by the provider
- Hang the side event channel on the returned object as well

It can itself subscribe to that event channel, using its existing full-text overwrite capability to maintain its own runtime state:

- On `SAVEPOINT(id)`, locally save `streamBuffer.toString()`
- On `ROLLBACK(id)`, restore that snapshot
- Reset the current round's content with the restored full text

This step is so that:

- The current round's accumulated text
- The subsequent retry context

can both return to the safe point.

### 6.2 AIMessageManager / MessageProcessingDelegate

These two places must not only pass the main text stream through, but must also keep passing the event side channel through.

Reason:

- The text stream is `share()`d again here
- If only the main stream is shared and not the side channel, the event capability breaks

Therefore the requirement here is simple:

- However the main text stream is shared, the side event stream must be shared along with it
- What is distributed downstream remains "the same text stream object + the same event stream object"

In addition, `MessageProcessingDelegate` itself has local accumulated state such as `contentBuilder`.

So it also needs to respond to events:

- On `SAVEPOINT(id)`, save a copy of the current full text
- On `ROLLBACK(id)`, roll the locally accumulated content back to that snapshot

Otherwise this will happen:

- The UI looks rolled back
- But the content the delegate finally persists is still dirty

### 6.3 UI

The UI cannot rely only on the `content` field to fix this.

Reason:

- During the streaming phase, the UI directly consumes `contentStream`
- Half text that has already entered the streaming renderer will not automatically disappear just because the upper layer's `content` changed

So the UI side must also understand these two events:

- `SAVEPOINT(id)`: save the current display snapshot
- `ROLLBACK(id)`: restore to that snapshot

The UI's essential actions are only two:

1. Clear the dirty state already accumulated in the current streaming renderer
2. Re-establish the current display from the snapshot

Only then is what the user sees a true retraction, rather than "logically rolled back, but not rolled back on screen".

## 7. Why This Still Counts as a Minimal Change

This plan does not touch these fundamental premises:

- Does not change the existing `tool_xxxx` compatibility protocol
- Does not change the history storage format
- Does not turn the main text stream into a unified event protocol
- Does not change tool output into a one-shot whole return

The only additions are:

1. A side event channel
2. Two event types
3. Each consumer saving a snapshot on `SAVEPOINT` and restoring on `ROLLBACK`

This is the approach closest to "still a retraction", while not wrecking the whole streaming architecture.

## 8. Key Notes

### 8.1 `id` Is Not `tool_xxxx`

Here, `id` is recommended to be used only as a savepoint id.

Do not forcibly bind it to `tool_xxxx`.

Reasons:

- `tool_xxxx` is part of the already-released protocol
- The savepoint id is part of runtime retraction control
- The two have different responsibilities

The safer compatibility approach is:

- `tool_xxxx` continues to be generated with the current random strategy
- The savepoint id is generated separately

### 8.2 The Side Event Stream Must Also Be Replayable

If the event stream does not support replay, a bad case will occur:

- A downstream late subscriber receives `ROLLBACK(id)`
- But did not receive the earlier `SAVEPOINT(id)`
- So it cannot find the snapshot

Therefore the side event stream must also have the same distributable, replayable capability as the main stream.

### 8.3 Fixing Only Upstream Is Not Enough

If rollback is done only in `EnhancedAIService`, while downstream does not follow:

- The delegate's accumulated text may still be dirty
- The UI render state may still be dirty

If only the UI is fixed, while upstream does not follow:

- The retry context and the finally persisted content are still dirty

So this is not a "fix one point and be done" problem, but a "the same side channel is distributed all the way through" problem.

## 9. Final Recommendation

It is recommended to understand and land this as follows:

- The main channel continues to be `Stream<String>`
- A side event channel is added
- Events keep only `SAVEPOINT / ROLLBACK`
- Events carry only `eventType + id`
- When `EnhancedAIService` returns the stream, it also distributes that event channel downstream
- This side channel must pass through the subsequent two `share()` calls
- `MessageProcessingDelegate` uses it to correct locally accumulated content
- The UI uses it to correct the current streaming render state

This is, under the current constraints, the minimal, most direct plan that best matches the semantics of "retraction".
