---
For_Agent: Plugin runtime monitoring feature plan
---

# Plugin Runtime Monitoring

## Current State
- ToolPkg execution uniformly goes through `PackageManagerToolPkgFacade.runToolPkgMainHook` and `JsEngine.executeScriptFunction`
- JS `console.log/info/warn/error` already enters Native logs, but the plugin detail dialog does not show them per package
- The host already has QuickJS instances reused per container, but monitoring previously incorrectly read the Android process's JVM, Native Heap, and PSS

## Intent
- Add a "performance monitoring" entry to the plugin detail dialog
- Aggregate call count, elapsed time, failure count, and in-flight call count by ToolPkg container package name
- Record the QuickJS actual allocated amount, the maximum instantaneous allocated amount during each call, and recent console/error logs

## Scope
- Add a new ToolPkg runtime monitoring state object
- Record metrics and logs at the JS execution entry and console/error callbacks
- Read the runtime allocated amount at the QuickJS JNI layer, and reset the peak counter at the start of each plugin call
- Display runtime metrics and plugin logs in the plugin detail dialog
- Add Chinese and English string resources

[DONE]
