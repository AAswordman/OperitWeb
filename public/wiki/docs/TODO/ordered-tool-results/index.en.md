---
repository: https://github.com/AAswordman/Operit
status: implemented
---

# Tool Results Emitted in Call Order

Related Issue: #1159; as the source fix replacing #1206, that PR is not merged for now.

Current state: during tool execution, XML is streamed out segment by segment, and after execution finishes, results are aggregated separately and sorted for model use. The save path uses the live stream, so the order, count, and content of results differ from the history inside the loop; rejected results are also placed at the front of the returned list by category.

Plan:

- Assign each original call a position within the current round; rejected, failed, and successful results are all written to their corresponding positions
- Keep parallel execution; each call emits only one aggregated result; publish by the positions of consecutively completed calls
- Generate the XML only once; the live stream and the in-loop history reuse the same text
- Add regression coverage for out-of-order completion, duplicate calls, rejections, multi-segment results, and history round-trips; update the protocol description

Scope: tool execution and result formatting, EnhancedAIService's result intake, the corresponding unit tests, and documentation. No change to Provider IDs or the saved XML format.

Verification: per repository conventions, no build or test is run proactively this time. The existing Android JVM CI can cover the new unit tests.

Implementation and verification scope: see [01 Implementation Notes](01-implementation.en.md).
