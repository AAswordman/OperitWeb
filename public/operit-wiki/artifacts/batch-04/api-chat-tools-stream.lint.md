# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0


## 修错后复跑记录（2026-10-01 14:01 CST）

- idx39 ref `StructuredToolCallBridge.kt:417` → `:416`（复检发现 :417 窗口盖不住 411 行的 `emitQueuedToolCallsIfNeeded` 调用）
- 单页隔离重跑 `scripts/lint.py`：硬失败 0 / 警告 0
