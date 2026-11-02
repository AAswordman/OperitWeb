---
fork: local
status: active
---

# Publish Timing Log

The market publish API originally only wrote scheduled-task records to R2. After a publish request timed out, it was impossible to distinguish from historical logs the time spent on GitHub validation, D1 mutation, and publisher shard materialization.

This change records per-phase timing in the `market-v2` publish API, with logs written asynchronously to the R2 debug directory. Then deploy the Worker, verify with one real publish using temporary resources, and finally withdraw the test entry and delete the temporary GitHub Release.

Scope:

- `assistance_web/workers/market/src/entry.ts`
- `assistance_web/workers/market/src/index.ts`
- `assistance_web/docs/MARKET_API_ENDPOINTS.md`

Step records are in [01-publish-timing.md](01-publish-timing.en.md).
