# Tool Calls and the XML Internal Protocol (Current Project State)

This document clarifies the project's actual behavior under two configurations: **Tool Call enabled** and **Tool Call disabled**.

> Bottom line first:
> - The project's internal tool calls and tool results are uniformly expressed and processed in **XML form**.
> - `enableToolCall` is essentially an **external protocol conversion switch** (XML ↔ provider-native Tool Call JSON), not a replacement for the internal execution model.

---

## 1. Core Concepts

### 1.1 Internal Canonical Form

The main channel for internal tool calls/results in the project is XML:

- Tool call (assistant output):

```xml
<tool name="read_file">
<param name="path">README.md</param>
</tool>
```

- Tool result (written back into history by the tool role):

```xml
<tool_result name="read_file" status="success"><content>...</content></tool_result>
```

The upper-level tool execution chain (such as `EnhancedAIService` + `ToolExecutionManager`) parses and executes according to this XML specification.

### 1.2 What the Tool Call Switch Means

When `enableToolCall=true`, the upper layer is not changed to JSON processing. Instead:

1. Before the request, the internal XML is mapped to the provider's native `tool_calls` format.
2. After the response, `tool_calls` are mapped back to internal XML.

So the upper layer always sees XML, preserving compatibility with the existing logic.

The default value for newly created model configurations is `true`, and the default DeepSeek configuration created on first initialization also enables Tool Call. Explicit switch values in already-saved configurations are not changed by adjustments to the default.

---

## 2. Tool Call Disabled (enableToolCall = false)

### 2.1 Request Phase

- The request body does not inject `tools` / `tool_choice`.
- History messages are sent as ordinary `role + content`.
- The system prompt retains the XML tool description and the list of available tools (controlled by the `useToolCallApi=false` branch).

### 2.2 Response Phase

- Mainly handles ordinary `content` (and thinking-content fields).
- Does not go through the `tool_calls` streaming/non-streaming conversion branches.
- If the model directly outputs XML tool tags, the upper layer parses and executes them normally.

---

## 3. Tool Call Enabled (enableToolCall = true)

### 3.1 Prerequisites for Taking Effect

It is not the case that "flipping the switch on guarantees it takes effect"; usable tools must also exist:

- `availableTools != null`
- `availableTools.isNotEmpty()`

In `OpenAIProvider`, `effectiveEnableToolCall` determines whether Tool Call mode is ultimately entered.

### 3.2 Request Phase (XML -> Tool Call JSON)

### A. Injecting Tool Definitions

The request body automatically gains:

- `tools`: JSON Schema built from `ToolPrompt` + structured parameters
- `tool_choice`: `"auto"`

In the tool parameter schema, `required` is always output as an array; when there are no required parameters, an empty array is output, so that it is not recognized as null by OpenAI-style validators.

### B. History Message Conversion

In `buildMessagesAndCountTokens(..., useToolCall=true)`:

- XML `<tool ...>` in assistant history is converted into a `tool_calls` array.
- XML `<tool_result ...>` in user/tool history is converted into `role="tool"` messages.
- Internal tool_call_id tracking and matching logic is still retained.

This step is "external compatibility", not a change to the internal storage structure.

### 3.3 Response Phase (Tool Call JSON -> XML)

### A. Streaming

When `delta.tool_calls` (or the Responses API's function_call events) are received:

- Incremental parameters are gradually converted into XML parameter fragments via `StreamingJsonXmlConverter`.
- The output form is still `<tool ...><param ...>...</param></tool>`.
- When switching tools or finishing up, closing tags are automatically completed.

### B. Non-Streaming

When `message.tool_calls` exists:

- `convertToolCallsToXml` is used to convert back to XML.
- The upper layer continues processing the tool call along the XML path.

---

## 4. Unified Execution Chain (Shared by Both Modes)

Regardless of whether Tool Call is enabled, the upper layer ends up consistent:

1. The model output (or the converted output) is an XML tool call.
2. `ToolExecutionManager.extractToolInvocations` parses the XML.
3. The tool execution result is formatted as `<tool_result ...>` and written back into the conversation history.
4. In the next round, the configuration again decides whether to perform protocol conversion.

### Result Order and Save Consistency

Each round's tool calls are assigned internal positions in their original order of appearance. Parallel tools still execute in parallel, and serial tools still execute in their original order; exposure limits, role permissions, Hook interception, permission denials, and execution results are each written to their own positions, not rearranged by result category.

A single call's streaming results are aggregated into one final result after execution finishes. Only results that complete consecutively starting from the first call of the round are output in order. So a later call that finishes earlier waits for the earlier results, and a single tool's intermediate results are no longer written into the chat body piece by piece.

The final result is formatted as XML only once: the response stream used for saving and the model history within the loop reuse these same result blocks, ensuring that tool names, content, block count, and order are consistent. Empty results produce an explicit failure result; cancellation propagates, and unfinished segmented content is not declared to be the final result. Ordered results already published before cancellation remain in the response stream.

This fix does not change the XML format or provider tool IDs, nor does it migrate old chat records. Previously misordered results for same-named tools cannot be reliably restored to their owners by name alone.

So "enabling Tool Call" is only a change at the I/O protocol layer; the execution layer is unchanged.

---

## 5. Relationship with the System Prompt

`useToolCallApi` affects the prompt presentation strategy:

- `true`: Uses a more simplified tool description, usually no longer embedding the complete tool list (because `tools` have already been passed in the request body).
- `false`: Retains the XML tool description and the list of available tools.

This is also why, for some providers that have not yet been connected to the complete conversion chain, it is not enough to simply "open up the switch" without completing the corresponding logic.

---

## 6. Provider Adaptation Status (Current Code Semantics)

- `OpenAIProvider` and its compatible derived providers: fairly complete two-way conversion (XML ↔ Tool Call JSON) is implemented.
- `LLAMA_CPP`:
  - **Non-ToolCall mode**: Still the prompt-constrained XML path.
  - **ToolCall mode**: In addition to prompts, a new JNI-native grammar constraint (`llama_sampler_init_grammar_lazy_patterns`) has been added; output is constrained to the `tool_calls` structure at the native sampling stage, then converted back to the project's internal XML.
  - The upper-level execution chain still keeps the XML specification; the executor protocol is not changed.
- `MNN`: Still not connected to an equivalent native ToolCall capability.

---

## 7. One-Sentence Summary

The project's Tool Call design is:

- **Internally, XML is always the core protocol**;
- **Externally, Tool Call protocol conversion is done according to provider capabilities**;
- **Enabling Tool Call = a transport-layer upgrade, not an execution-layer rewrite**.
