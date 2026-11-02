# Claude History and Response Boundaries

The old implementation put all of Claude's tool call names directly into the pending-pairing queue. The execution result of `package_proxy` is rewritten by the tool execution layer to a concrete package tool name, so strict name matching would leave unfinished calls behind.

After the fix, the queue stores the actual execution name returned by `StructuredToolCallBridge.toolCallName`. That parsing also covers OpenAI `arguments`, Gemini `args`, and Claude `input`, and tool results must still hit the corresponding call exactly.

Claude's streaming and non-streaming parsing also only forward thinking blocks when thinking is enabled for the current request; when thinking is disabled, thinking blocks erroneously returned by the server are ignored directly, preventing internal reasoning from entering user messages.

Changes completed: [DONE]
