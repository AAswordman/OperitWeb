---
status: in-progress
---

# Publish Phase Logs

The old implementation only logged during cron execution. The publish endpoint synchronously materializes the private publisher shard after writing to D1, but did not record the time spent in each phase.

The new implementation records the total time of the publish request and the following phases:

- Market session validation
- Publisher write
- GitHub Release asset validation
- Project version query
- D1 mutation
- Publisher shard materialization

Logs are written to `market/v2/debug/publish/`, using the Worker's `waitUntil`, without blocking the publish response.
