---
For_Agent: Plugin Runtime Monitoring Implementation Record
---

# Runtime Monitoring and Dialog Entry

## Old Implementation
- The plugin detail dialog only showed metadata, configuration entry, templates, and sub-package tools
- ToolPkg console logs went into the global log and the packageLogs file
- The JS execution entry had no per-plugin aggregation of call durations and memory snapshots

## New Implementation
- Added `ToolPkgRuntimeMonitor` to record plugin execution statistics by package name
- `JsEngine.executeScriptFunction` writes runtime statistics at call start, completion, exception, and cancellation
- `console.log/info/warn/error` and JS errors go into the current plugin's recent log list
- The plugin detail dialog adds a "Performance Monitoring" button, which shows the runtime overview, QuickJS memory snapshot, execution peaks, and plugin logs
- The monitoring dialog refreshes once per second; clearing logs only affects the current plugin's recent log list
- QuickJS JNI provides the runtime's current allocation and peak allocation during calls; the host App's JVM, Native Heap, and PSS are no longer shown as plugin memory

## Acceptance Criteria
- After opening the plugin detail dialog, "Performance Monitoring" can be clicked
- After executing a plugin, call count, durations, failure count, QuickJS current allocation, call peak, and memory delta are visible
- Plugin console output is shown in that plugin's log by info, warn, and error
- The old package details, sub-package toggles, and configuration entry keep their original interactions

[DONE]
