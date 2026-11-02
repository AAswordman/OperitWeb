# ToolPkg Probe Timing Breakdown

Sample log: 2026-03-10 00:17:18
Scenario: `deepsearching_message_plugin` missed, `probeOnly=true`, message length `2`

## Notes

- `sendMessage.total`, `delegate.prepareResponseStream`, and `toolpkg.messageProcessing.matchTotal` are all parent-level spans that already include their respective internal sub-stages.
- When looking at total time, prioritize the parent-level spans; when drilling into bottlenecks, look at the sub-stages.
- This document only organizes the local pre-first-packet time before the first packet; it does not include the model's ongoing streaming output time.

## Main Chain Timing

| Stage | Time |
| --- | ---: |
| `delegate.loadModelConfig` | 4ms |
| `delegate.buildUserMessageContent` | 11ms |
| `delegate.addUserMessageToChat` | 10ms |
| `delegate.acquireService` | 0ms |
| `delegate.loadRoleInfo` | 1ms |
| `delegate.loadChatHistory` | 0ms |
| `sendMessage.buildMemory` | 2ms |
| `sendMessage.limitHistory` | 1ms |
| `sendMessage.matchPlugin` | 117ms |
| `sendMessage.readStreamSetting` | 1ms |
| `sendMessage.prepareRequest` | 4ms |
| `sendMessage.total` | 142ms |
| `delegate.prepareResponseStream` | 145ms |
| `delegate.shareResponseStream` | 1ms |
| `delegate.loadProviderModel` | 18ms |
| `delegate.firstResponseChunk` | 1895ms |

## ToolPkg Probe Internal Breakdown

| Stage | Time |
| --- | ---: |
| `toolpkg.messageProcessing.loadHooks` | 9ms |
| `toolpkg.messageProcessing.buildPayload` | 0ms |
| `toolpkg.getMainScript.readBytes` | 2ms |
| `toolpkg.getMainScript.total` | 13ms |
| `toolpkg.runMainHook.getMainScript` | 16ms |
| `toolpkg.runMainHook.resolveFunctionSource` | 1ms |
| `toolpkg.runMainHook.getExecutionEngine` | 0ms |
| `toolpkg.jsEngine.initQuickJs` | 0ms |
| `toolpkg.jsEngine.buildExecutionScript` | 7ms |
| `deepsearching_probe.onMessageProcessing` | 28ms |
| `toolpkg.jsEngine.waitResult` | 41ms |
| `toolpkg.jsEngine.total` | 58ms |
| `toolpkg.runMainHook.executeScriptFunction` | 60ms |
| `toolpkg.runMainHook.total` | 86ms |
| `toolpkg.messageProcessing.runMainHook` | 88ms |
| `toolpkg.messageProcessing.decodeHookResult` | 1ms |
| `toolpkg.messageProcessing.hookTotal` | 92ms |
| `toolpkg.messageProcessing.parseProbeResult` | 1ms |
| `toolpkg.messageProcessing.probeHook` | 97ms |
| `toolpkg.messageProcessing.matchTotal` | 114ms |

## Summary

| Metric | Time |
| --- | ---: |
| Local pre-work up to `delegate.prepareResponseStream` | 145ms |
| Local pre-work up to request sent, stream shared, and model info read | 164ms |
| Total plugin probe time | 114ms |
| From send start to first packet | 1895ms |
| Estimated model/network first-packet wait | 1731ms |

## Comparison Conclusion

| Sampling stage | Time |
| --- | ---: |
| Early probe | ~498ms |
| After decompression caching | ~385ms |
| After module context reuse | ~114ms |
