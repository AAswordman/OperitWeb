# Execution Boundary and Persisted State

## Old Implementation

`triggerWorkflow` wrote `RUNNING` before calling the executor. Its exception branch did not distinguish whether the executor had already returned a result, and directly updated the state to `FAILED`.

## Correction Intent

Bind the final state and statistics updates to an execution result containing a `WorkflowExecutionRecord`. Exceptions occurring before the executor is started should also generate a run record carrying the failure stage and the original exception.

## Expected Implementation

- Scheduled and manual entry points share the same execution result persistence path
- Every final `SUCCESS` or `FAILED` state has a corresponding run record
- Runtime environment initialization failures can be recognized by the scheduled entry point and retried with a delay

[DONE]
