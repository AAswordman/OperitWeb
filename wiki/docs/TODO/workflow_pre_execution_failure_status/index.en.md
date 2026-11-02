---
fork_repository: https://github.com/AAswordman/Operit.git
status: completed
---

# Pre-Execution Failure Status for Workflows

## Original State

Scheduled workflows were written as `RUNNING` by the repository layer, then handed to the executor to generate run records and final results.

If an exception occurred before the executor had created a run record, the repository layer still wrote the workflow status as `FAILED`. This left the workflow status, execution count, and the records in `_execution_logs` inconsistent with each other.

## Intent and Result

Every failure must persist a run record containing the `runId`, the failure stage, and the original exception text, then synchronize the final status and statistics.

Runtime environment initialization failures are retried with a backoff strategy by the scheduling side after a delay. Node and workflow logic failures are still handled as the final failure of that run.

## Scope

- `WorkflowRepository` startup, status, and statistics update boundaries
- `WorkflowWorker` and `WorkflowScheduler` handling of retryable startup exceptions
- Failure stage display in the workflow log model and log view
- The fix notes in this directory

## PR

Not created

[DONE]
