---
For_Agent: Performance Analysis UI Plan
---

# Performance Analysis UI (Settings)

## Current State
- Settings sub-screens are organized with the sealed class `Screen` + callback navigation (`OperitScreens.kt` / `SettingsScreen.kt`), with no NavHost
- Plugins run on QuickJS threads inside the main process (`OperitQuickJsRuntime`), and `ToolPkgManager` maintains a contextKey → engine mapping, but the correspondence between engines and kernel thread IDs is not exposed
- Terminal sessions fork independent PTY child processes via `Pty.start` in the `:terminal` module; JNI already returns the pid, but `Pty` does not save it
- The project has no CPU / network sampling code; for memory there is only `ActivityManager.MemoryInfo` (device-level) and QuickJS allocation (plugin-level)
- There is an existing Canvas chart precedent: `ui/features/tokenstats/TokenStatsCharts.kt`

## Intent
- Add a "Performance Analysis" screen in Settings, similar to the Windows Task Manager: three analysis items — CPU / Memory / Network — switchable
- Each analysis item is broken down by "Software (main process) / Plugins (aggregated by container) / Terminal (aggregated by session)", making it easy for users to compare side by side
- Line charts + a real-time detail list per entity, with sampling continuing while the screen is open

## Scope
- Add `core/performance/PerformanceMonitorManager`: a singleton sampler covering /proc CPU, Debug.MemoryInfo, QuickJS memory, and TrafficStats networking
- QuickJS engines expose the tid of their running thread (Java `Thread.id` is not a kernel tid; `Process.myTid()` must be taken inside the engine thread)
- `JsEngine` / `ToolPkgManager` / `PackageManager` expose, layer by layer, each plugin's engine thread ID and QuickJS memory
- `Pty` saves and exposes child process pids; terminal session pids are used for /proc process-tree (bash → proot → command) aggregation
- Add a `ui/features/performance` screen (TabRow with three pages + Canvas curves + entity details), wired into Settings navigation
- Add Chinese and English string resources (with the same coverage as existing features)

## Out of Scope
- Network attribution is not done at plugin/terminal granularity: they share the same UID as the main process, and Linux/Android has no per-process traffic metering; the UI explicitly states that their traffic counts toward "Software"
- The `:repair` / `:crash` helper processes are not counted under "Software" (they are idle and irrelevant to user perception)
- No persisted history; only an in-memory rolling window is kept
