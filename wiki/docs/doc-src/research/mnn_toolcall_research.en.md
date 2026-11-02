# MNN Tool Call Research Notes

Updated: 2026-03-17

## Background

The current goal is not to bolt on another prompt protocol at the app layer, but to confirm:

1. Whether MNN official sources already give the key design ideas.
2. Whether a non-degrading integration exists.
3. If `tool call` is to be integrated, where the correct integration layer should be.

---

## Public Sources Checked

### Official Public Sources

- MNN main README
  https://github.com/alibaba/MNN
- MNN-LLM overview
  https://github.com/alibaba/MNN/blob/master/transformers/README.md
- LLM page in MNN docs
  https://github.com/alibaba/MNN/blob/master/docs/transformers/llm.md
- `llm` page of the MNN official Wiki
  https://github.com/alibaba/MNN/wiki/llm
- MNN official Android Chat App README
  https://github.com/alibaba/MNN/blob/master/apps/Android/MnnLlmChat/README.md

### Related Upstream Components

- Minja project
  https://github.com/google/minja

### External Verification Results

- The official Wiki's `llm` page currently explicitly says `This document is a placeholder.`, and cannot be used as tool call wiring documentation.
- The `minja` README explicitly states that its `chat_template` normalizes message history, and handles different templates' differing expectations for `tool_calls.function.arguments`.
- No official public article or README was found that directly covers `MNN tool call + Android/JNI` integration details.

---

## Local Source Check Scope

### MNN Upstream Source

- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/prompt.cpp`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/prompt.hpp`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/include/llm/llm.hpp`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/minja/chat_template.cpp`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/minja/chat_template.hpp`

### Official Android Chat App

- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/app/src/main/java/com/alibaba/mnnllm/android/llm/LlmSession.kt`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/app/src/main/cpp/llm_mnn_jni.cpp`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/README.md`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/README_CN.md`

---

## Conclusions

### 1. Official public documentation does not directly explain the `tool call + JNI + Android` integration

Public documentation mainly covers:

- Model export
- Engine compilation
- Runtime inference
- Android Chat App usage and release notes

But no single document directly explains:

- How `tool_calls` in assistant history are passed
- How tool results with `role="tool"` are passed
- How the Android/JNI layer hands structured messages to MNN's internal templates

Also, the official Wiki's `llm` page is still a placeholder page, not integration documentation that can be copied directly.

---

### 2. The official key ideas are in the source, not in the documentation text

The key point is not in the README, but in `minja` and MNN's wrapping of `minja`.

From `chat_template.hpp/.cpp` it can be confirmed that MNN's internal template pipeline itself already understands:

- `inputs.tools`
- `tool_calls` on assistant messages
- Tool responses with `role == "tool"`
- `tool_call_id`
- Polyfills for differences across templates

This shows:

- MNN internally is not without tool capability.
- The real problem is that the public entry points do not expose the complete structure.

---

### 3. The key idea from the official Android Chat App is "submit full history", not hand-assembled prompts

`MnnLlmChat`'s `LlmSession.kt` contains `submitFullHistory(...)`, and the JNI entry point directly receives the full history list.

This at least shows the official thinking is:

- Don't pass only one assembled long string.
- The chat side should keep history-level structure, then hand it to the lower layer for processing.

These are two different ideas from "appending a tool protocol description to the system prompt at the app layer".

The former is structured-history-driven; the latter is a pure-text hack.

---

### 4. The current MNN public `Prompt/Llm` entry points are too thin — that is the root cause of the degradation here

In the current local checkout:

- `ChatMessage = pair<string, string>`
- `Prompt::applyTemplate(...)` only takes `role/content`
- `Llm::response(...)` also only takes simple history

This means that even though the underlying `minja` supports `tools/tool_calls/tool responses`, if the upper layer keeps going through this API, structural information will be lost.

Conclusion:

- The degradation is not because MNN internal tools don't exist.
- The degradation is because the current public entry points flatten messages, losing their structure.

---

## Direct Implications for Our Implementation

### Wrong Direction

The following approach should not continue to be used:

- Hand-assembling tool descriptions in the system prompt at the app layer
- Requiring the model to output according to a newly defined text protocol

Reasons:

- This is not integrating MNN internal tools.
- This degrades the problem back into prompt engineering.

### Right Direction

The right direction must preserve structured messages, including at least:

- `messages`
- `tools`
- `tool_calls` in assistant history
- `tool_call_id` / `content` in tool history

---

## Feasible Plans

### Plan A: Without changing upstream MNN source, connect directly to MNN's internal templates in our own JNI

Idea:

- The provider first converts internal XML history into structured `messages_json + tools_json`
- JNI directly calls MNN's internal chat template capability to generate the prompt
- Then the prompt is handed to the existing tokenizer / generate flow

Advantages:

- No changes to upstream MNN source
- Still connects to the MNN internal tools idea
- Does not degrade into a prompt-assembly protocol

Cost:

- Our own native layer has to take on part of the "structured messages -> internal template" bridging logic

### Plan B: Change upstream MNN source, adding structured message entry points to `Prompt/Llm`

Idea:

- Add `messages_json + tools_json` entry points to `Prompt` / `Llm`
- Let JNI directly call the new public API

Advantages:

- Cleanest structure
- Thinner JNI
- Closest to the natural exposure of internal capability

Cost:

- Upstream MNN source must be modified

---

## Current Judgment

As of 2026-03-17, the most critical ideas public sources can give are:

1. The overall direction officially recommended is chat-template-driven, not an app-layer prompt-assembly protocol.
2. `minja` is the core of this capability chain.
3. The official Android Chat App also embodies the "submit full history" idea.
4. What is truly missing is not capability, but the structured-message bridge between our current integration point and `minja`.

Therefore, if the goal is "no degradation", structured `messages/tools/tool_calls/tool responses` must at least be kept intact at the native layer.

---

## Appendix: Key Files Directly Viewable Locally

- `<MNN_SOURCE_DIR>/README.md`
- `<MNN_SOURCE_DIR>/transformers/README.md`
- `<MNN_SOURCE_DIR>/docs/transformers/llm.md`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/minja/chat_template.cpp`
- `<MNN_SOURCE_DIR>/transformers/llm/engine/src/prompt.cpp`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/README.md`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/app/src/main/java/com/alibaba/mnnllm/android/llm/LlmSession.kt`
- `<MNN_SOURCE_DIR>/apps/Android/MnnLlmChat/app/src/main/cpp/llm_mnn_jni.cpp`
