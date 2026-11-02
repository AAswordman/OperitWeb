---
fork: https://github.com/AAswordman/Operit.git
issue: https://github.com/AAswordman/Operit/issues/853
---

# Long Session Loading Audit

## Findings

Session selection calls `ChatHistoryDelegate.loadChatMessages`. That method reads the database in batches in reverse chronological order via `collectNewestDisplayPages`, and places only the most recent one to two pages into the UI state. Each page is divided by five user or summary messages, and the UI message list uses lazy rendering.

## Conclusion

The second phenomenon in the issue shares no common state root cause with the queue loss, and there is no full-history loading on this path.
This round does not replace the existing pagination strategy with unreproduced speculation. If lag persists later, it should be located separately using the specific session's message sizes,
database query times, and rendering traces.

[DONE]
