# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错后复跑（2026-10-01）

- 按 `api-voice.critic.md` 对照表修正 90 处引用（69 条简单重锚 + 21 处拆分），facts 194 → 222 条
- 含 [51] 错文件修正（parseJsonPath → `HttpVoiceProvider.kt:921`）
- 118 条新/改条目全部复验：ref 一致、文件/行号有效、反引号符号全部落在 ±5 窗口
- 单页隔离重跑 `scripts/lint.py`：**0 硬失败 / 0 警告**

