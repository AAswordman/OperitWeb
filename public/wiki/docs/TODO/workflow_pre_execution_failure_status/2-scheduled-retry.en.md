# Scheduled Retry and Runtime Environment Preparation

## Old Implementation

`WorkflowWorker` converted all failures returned by the repository and coroutine cancellations into `Result.failure()`. Work requests had no explicit backoff configured for retries.

The executor fetched tool handlers at construction time, so tool package initialization failures could occur before the run log was created, or be compressed inside a node into "tool does not exist".

## Correction Intent

Prepare the default tools and the runtime environment of the tool packages referenced by the workflow after the run log is created. Initialization exceptions are returned to the scheduled entry point as retryable failures.

## Expected Implementation

- Run records persist `failureStage` and `failureReason`
- `WorkflowWorker` returns `Result.retry()` only for retryable startup failures
- Cancellation continues to be handled by WorkManager's cancellation semantics
- Work requests use exponential backoff delay

[DONE]
