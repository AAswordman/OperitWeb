# Network Failure Message Finalization

## Old Implementation

The Provider's exception branch first rolls back the current request's savepoint. The savepoint sits at the start of this round's request, so a network error empties this round's text. After the final error is caught by EnhancedAIService and no longer thrown downstream, MessageProcessingDelegate continues with normal completion logic and persists the empty content.

## Fix Intent

Move the rollback to after it is confirmed that another request will be executed. A final network failure carries the interrupted state to the message processing layer, where the in-flight message object completes and saves the content already received, and normal completion logic is forbidden from overwriting that content.

## Expected New Implementation

- Exceptions that will not start a new request do not send a rollback event
- A stream whose retries are exhausted ends with an identifiable failure state
- The message processing layer saves the current text and turn statistics through the existing interrupted-message finalization
- Regression tests cover final failure, already-output content, and final message persistence

Implementation is complete. [DONE]
