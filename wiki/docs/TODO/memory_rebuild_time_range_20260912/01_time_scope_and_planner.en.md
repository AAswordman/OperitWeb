# Time Range and Window Planning

Old implementation:

- `ChatMemoryWindowPlanner.plan` received the entire session's messages and split them by window size
- `ChatMemoryRebuildManager.start` only received the chat id and window size

Intended fix:

- Express the build range with a sealed type: all messages, or a closed-interval date range in the device timezone
- Milliseconds given by the DatePicker are parsed into dates using the UTC calendar, then converted to a half-open interval from 00:00 local time on the start day to 00:00 on the day after the end day
- The planner first filters messages by range, then reuses the original windowing rules
- User or assistant messages outside the interval do not enter windows, nor are they restored as cross-window context

Expected results:

- Selecting a single day is valid, and all messages from the end day are included
- A western timezone does not parse UTC midnight as the previous day
- Existing summary exclusion, window boundary, and group-chat slicing behavior are unaffected by the time range

[DONE]
