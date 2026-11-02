# Ordered Aggregated Results

The original implementation streamed real-time output segment by segment into the save stream, while return values were aggregated separately, and rejected results were placed before results by category.

Now OrderedToolResults keeps the position of each original call and publishes consecutively completed results using a mutex. Every completion path in ToolExecutionManager submits one aggregated result, and EnhancedAIService reuses the already-published XML to build the next round of history.

Parallel execution of tools is preserved. Result display waits for that call to complete, and for earlier calls' results to be published. Before cancellation, only already-published complete ordered results are kept; incomplete partial results are not published.

Regression cases:

- Same-named calls completing in reverse order are published by call position, and already-consecutive results are published before the last call completes
- Rejected results do not jump the queue; identical results still have independent positions
- Multi-segment tool results produce only one aggregated XML; empty results and failed results both have final output
- Cancellation propagation, empty batches
- Using the Claude production history serializer, compare the in-loop history with the request prefix reconstructed after splitting the response stream into history blocks

Check status: completed call sites and static diff checks; compilation, builds, or unit tests were not run. The Claude case does not access the database, native XML splitter, or official API, so it is not validation of a real-device cache hit.

The two new test classes can later be run via Android JVM CI: OrderedToolResultsTest, ClaudeOrderedToolHistoryTest. Real-device acceptance should cover appending a user message after same-named tools complete in reverse order, and comparing the content and order of the existing tool history.

[DONE]
