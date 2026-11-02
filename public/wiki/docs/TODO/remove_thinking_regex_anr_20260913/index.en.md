---
fork_repository: https://github.com/AAswordman/Operit.git
---

# Precompiled Thinking-Removal Regex

## Original State

`ChatUtils.removeThinkingContent` and `extractThinkingContent` called `toRegex()` on every invocation. Sending, regenerating, and window estimation each walk every AI message once. In long sessions the main thread repeatedly runs ICU `Pattern.compile`, and the logs show ANRs from thinking removal.

## Intent

Promote regexes with identical rules to object-level precompiled instances. Messages with no think or search markers first get a string-containment check, and only then decide whether to run the regex. The match results of thinking removal are unchanged.

## Scope

- `ChatUtils.kt`
- Behavior covered by the existing `ChatUtilsTest`, `ChatUtilsThinkingTest`, and `ChatUtilsThinkingEdgeTest` stays as-is

## Acceptance

- Closed and unclosed think, thinking, and search blocks are still removed
- Regexes are no longer compiled on every call

[DONE]
