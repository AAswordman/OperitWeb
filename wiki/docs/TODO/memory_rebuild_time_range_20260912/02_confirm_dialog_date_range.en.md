# Confirmation Dialog Date Selection

Old implementation:

- The confirmation dialog for building the memory library only offered a window size
- Once building started, it processed all raw messages of the selected sessions

Intended fix:

- Offer two explicit options in the confirmation dialog: all messages and a specified time range
- When a time range is specified, first collapse the confirmation dialog, then open a standalone calendar dialog and pick the start and end dates on a month grid
- After confirming in the calendar dialog, return to the confirmation dialog and display the selected dates; cancelling returns to the confirmation dialog without changing the dates
- Disable starting the build until a complete start and end date has been selected
- When there are no extractable user messages within the selected time range, the failure message should explain that the time range is empty, rather than a generic "no messages"

Expected result:

- Users can summarize memory for only a specific time range
- All messages remain the current selection when entering the dialog, with behavior unchanged from before the change
- Progress, cancellation, and window failure keep their original semantics

[DONE]
