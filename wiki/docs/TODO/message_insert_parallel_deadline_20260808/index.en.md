---
fork_repository: local
---

# Parallel Deadline for Extra Information Injection

## Background

In extra information injection, weather, location, OCR, notifications, and memory retrieval run in sequence. When multiple asynchronous collection items start at the same time, the pre-send wait time accumulates.

## Goals

- Start all enabled asynchronous collection items at the same time
- Return the whole round of injection within the configured deadline
- Collection items that do not finish before the deadline do not write incomplete data; only a `timeout` status marker is kept
- Keep the existing order of information items in the attachment

## Scope

- `examples/message_insert/src/shared.ts`
- `examples/message_insert/dist/shared.js`
- `examples/message_insert/src/ui/index.ui.ts`
- `examples/message_insert/dist/ui/index.ui.js`

## Steps

1. [Done] Declare the enabled items as independent collection tasks and aggregate them with `Promise.all` under a single deadline
2. [Done] Record diagnostics for timed-out tasks and write a `timeout` status marker in the attachment
3. [Done] Check consistency between source files and published scripts, and record that builds and tests were not run
4. [Done] Expose the injection timeout to the settings UI as a second-level configuration item

[DONE]
