# Parallel Collection and Global Deadline

## Old Implementation

`buildExtraInfoAttachmentTags` waited for each enabled collection function one by one. The wait times for weather, location, OCR, notifications, and memory retrieval accumulated on top of each other.

## Change Intent

Build each enabled item into an independent task and run them within the same 8-second absolute deadline. Each task independently handles completion, failure, and timeout, and the results are finally aggregated with `Promise.all` preserving configuration order.

## Expected Results

The injection flow waits at most 8 seconds. Tasks that hit the deadline only produce a `timeout` status marker for the corresponding item, write no unfinished data, and generate no error attachment; tasks that have already completed are still injected.

The timeout value is now configured in seconds on the settings page, defaulting to 8 seconds, with a configurable range of 1 to 120 seconds.
