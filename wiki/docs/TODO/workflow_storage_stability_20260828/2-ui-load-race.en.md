# UI Load Ordering

## Old Implementation

Workflow update events would call the public load method again and start a new coroutine. When a user quickly entered the detail view, returned to the list, or performed consecutive operations, an earlier request could finish later than a newer request and thereby overwrite the current UI state.

## Fix Intent

Both list loading and detail loading are assigned incrementing request numbers, and only the latest request may write the list, the current workflow, the recent execution records, or the error state.

Error display is changed to a bottom-right snackbar consistent with the package management UI, to avoid format error prompts being silently swallowed.

## Impact Scope

- `WorkflowViewModel` list and detail load entry points
- Workflow list page error display
- Workflow detail page error display

[DONE]
