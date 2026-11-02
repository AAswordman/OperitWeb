# Tail-Only Rollback Rendering

## Old Implementation

After the chat UI receives `ROLLBACK`, it creates a new display stream and writes the full post-rollback content into that stream again.

The Markdown renderer uses the stream instance as the reset basis, so it clears and re-parses the entire AI message.

## Intent of the Fix

Keep only the Markdown nodes consistent with the rollback prefix, removing only the changed tail nodes.

When restoring the parser, pre-warm the streaming Markdown session with that prefix; the replacement stream carries only the new tail after the rollback.

## Expected Results

- A rollback changes only the corresponding message tail
- Markdown nodes that were not withdrawn keep their rendering state
- Content after a retry continues to append, without replaying the prefix

## Scope

- UI adaptation for rollback-capable text streams
- Replay prefix markers in the character stream
- Initial content of the streaming Markdown parser

## Verification Record

- Statically checked the passing of the rollback prefix, the mutual-exclusion scope of stream switching, and the continuation parameters of the Markdown parser
- Executed `git diff --check`
- In accordance with the repository's work constraints, no build or test commands were executed this time

Implementation completed. [DONE]
