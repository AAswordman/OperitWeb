---
For_Agent: Performance monitor screen implementation notes
---

# Performance Monitor Screen

## Old Implementation
- Settings had no performance-related screen; on the plugin side there was only `ToolPkgRuntimeMonitor` (call counts / elapsed time / QuickJS memory delta, shown in the plugin details dialog)
- QuickJS engine threads had no correspondence with kernel threads; `Pty` discarded the child process pid returned by JNI
- No CPU/network sampling infrastructure

## New Implementation
- New `core/performance/PerformanceMonitorManager`:
  - Samples on a 1s cycle, producing `PerformanceSnapshot` (timestamp, core count, entity list, whole-device CPU/memory/network)
  - CPU: `/proc/self/stat`, `/proc/self/task/<tid>/stat` (engines attributed by tid), and process-tree aggregation over `/proc/<pid>/stat` for terminal session pids (utime+stime+cutime+cstime, parent and child not double-counted); whole-device figures come from `/proc/stat`
  - Memory: app = `Debug.MemoryInfo.totalPss` (breakdown includes Dalvik/Native); plugins = QuickJS `memoryUsedBytes` aggregated per container; terminal = process-tree RSS sum; device = `ActivityManager.MemoryInfo`
  - Network: differential rates of UID traffic vs. whole-device traffic from `TrafficStats`; rates are computed from the true Δt, and the first sample after a pause/resume with a large interval does not produce a rate point
  - Rolling window of 180 samples, held by a singleton; sampling stops after the screen closes but history is kept
- quickjs: `OperitQuickJsEngine` records `Process.myTid()` when the execution thread starts, exposing `getRuntimeTid()`
- app: `JsEngine.getRuntimeThreadId()` → `ToolPkgManager.getToolPkgEngineRuntimeInfoInternal()` (aggregates engine tids and QuickJS memory per container) → `PackageManager.peekInstance()` + `getToolPkgEngineRuntimeInfo()` (with display-name resolution); when the package manager is not initialized, the plugin list is empty
- terminal: `Pty` gains a new `pid` constructor parameter (default -1, `Pty.start` passes the real value), and the performance screen reads session pids via `TerminalManager.terminalState`
- New `ui/features/performance/PerformanceMonitorScreen.kt` (TabRow: CPU/memory/network; header with current values; Canvas multi-curve history charts; entity detail list; pause/resume) and `PerformanceMonitorCharts.kt` (line/area charts, legends); the page uses the app-level unified AppBar and requests pause/resume buttons via `LocalTopBarActions`
- Navigation: `Screen.PerformanceMonitor` (`NavItem.Settings`, `screen_title_performance_monitor`); a new entry in the "Data and permissions" group on the settings page
- Strings: `values/strings.xml` + `values-en/strings.xml` gain perf_* / settings_performance_monitor* / screen_title_performance_monitor

## CPU Sampling Path Fix

- `readProcStat` takes a file path; the call sites for the main process, QuickJS threads, and terminal process trees previously passed relative `self`, tid, or PID values, so `/proc/*/stat` always failed to read and was converted to 0.0
- Call sites now uniformly pass `/proc/self/stat`, `/proc/self/task/<tid>/stat`, and `/proc/<pid>/stat`, restoring differential CPU sampling for the app, plugins, and terminal

## Acceptance Points
- Settings → Performance Monitor is visible, the three tabs switch and share the same rolling history
- After opening/running a plugin, the corresponding plugin row appears on the CPU and memory pages, with values changing as scripts execute
- After creating a terminal session, the corresponding session row appears on the CPU and memory pages; the curves rise when a CPU-heavy command runs inside the session
- The network page shows app and whole-device send/receive rates; plugin/terminal traffic attribution is explicitly explained
- After pausing, curves freeze; after resuming, they continue; leaving the screen stops sampling
