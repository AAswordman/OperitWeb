---
title: Claude tool result pairing repair
status: complete
---

# Claude Tool Result Pairing Repair

## Cause

Commit `2454f4bf` changed tool results in Claude history to strict name-based pairing, but Claude's
`package_proxy` tool call is named `package_proxy`, while the execution result is named after the actual proxied tool.
This left already-successfully-executed results unmatched, after which they were serialized as `User cancelled`.

## Goals

- Keep strict pairing, with no fallback to position or old result order
- Use the same real tool name resolution for package proxy calls across Claude, Gemini, and OpenAI
- When thinking is disabled, do not expose thinking blocks mistakenly returned by the server to the user

## Scope

- `StructuredToolCallBridge.toolCallName` supports Claude `input`
- Claude history serialization uses the resolved match name
- Claude non-streaming and streaming responses filter thinking blocks according to `enableThinking`
- Add package proxy pairing regression coverage

## Progress

- Detailed steps: [1_claude_history_and_thinking.md](1_claude_history_and_thinking.en.md)
- [DONE] Root cause and regression commit confirmed
- [DONE] Strict match key fix
- [DONE] Thinking block request-level filtering
- [DONE] Regression test additions
