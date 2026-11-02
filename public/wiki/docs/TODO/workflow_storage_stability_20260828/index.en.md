---
fork_repository: https://github.com/AAswordman/Operit.git
status: completed
---

# Workflow Storage Stability

## Original State

Workflow JSON was written directly to files under the public Downloads directory. Multiple `WorkflowRepository` instances could read and write the same set of files concurrently, so when the app exited abnormally or concurrent refreshes happened, the workflow list could read half-written content or be overwritten by a stale load result.

Storage problems such as malformed workflow files or directory anomalies only went into logs or were uniformly collapsed into a load failure, leaving users without visible prompts on the list and detail pages.

## Intent and Result

Workflow file writes must complete as single-file atomic commits, and the repository layer must serialize workflow JSON reads and writes with a shared mutex.

List refreshes and detail refreshes only allow the latest request to update UI state; workflow storage warnings need to be displayed in the style of the error prompt at the bottom-right corner of the package management UI.

## Scope

- `WorkflowRepository` workflow JSON read/write, deletion, and format error prompts
- `WorkflowViewModel` list/detail load request ordering control
- Error snackbars on the workflow list page and detail page
- Chinese and English workflow storage error copy

## PR

Not created

[DONE]
