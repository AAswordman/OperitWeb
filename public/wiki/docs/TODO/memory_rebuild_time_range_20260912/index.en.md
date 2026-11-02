---
fork_repository: https://github.com/AAswordman/Operit.git
---

# Building Chat Memory by Time Range

## Original State

The batch operations on chat history in Settings can only first select whole sessions, then choose a window size and rebuild memory. Once a long session is selected, all of that session's original user and assistant messages are sent to the memory model, with no way to summarize only a particular span of days within it.

## Intent

When confirming a memory library build, let the user explicitly choose between two scopes: all messages, or a closed date interval. After a time range is specified, only messages within that interval are handed to the existing window planner; window size, summary exclusions, sequential rebuild, and progress cancellation semantics stay unchanged.

## Scope

- Add a unit-testable memory time range type that converts the date picker's UTC midnight milliseconds into a half-open interval in the device time zone
- The window planner filters messages by that range before splitting them into windows
- The confirmation dialog offers two entries, all messages and a specified time range, popping up a date range picker when a range is specified
- Provide default language resources for the new copy and the language of the existing memory rebuild copy

## Acceptance

- The user can choose all messages, behaving the same as before the change
- The user can choose start and end dates, processing only messages within that closed interval
- Choosing the same day for start and end is valid, and all messages on the end date are included
- When a time range is specified but no start/end dates have been selected yet, the build cannot start
- When there are no extractable user messages within the selected time range, the task fails with a corresponding explanation
- Cancellation, window-failure continuation, and memory space binding rules do not change with the time range

Steps:

- [01 Time Range and Window Planning](01_time_scope_and_planner.en.md)
- [02 Confirm Dialog Date Selection](02_confirm_dialog_date_range.en.md)
