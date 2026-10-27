# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

（自查记录：2026-10-01，首轮 lint 报 1 条模糊词警告已改写；另手工清除 5 处禁用词残留（正文/ facts/quality 各处）；facts.json 156 条引用已用脚本全量验真行号存在且未越界；复跑 lint.py，0 硬失败 / 0 警告）

（修错记录：2026-10-01，critic 打回后修复：正文 §9 入队方"三处"→"两处"（MemoryAutoSaveScheduler 只拉取不入队）；9 条 facts ref 重新锚定（MemoryRepository.kt:1894→1908、MemoryExportModel.kt:39→80、MemoryRepository.kt:2745→2777、MemoryExportModel.kt:59→101、MemoryAutoSaveCandidate.kt:13→21/17→25、MemoryRepository.kt:927→934/1418→1398/2347→2341，逐行核对 ±5 窗口支撑原文）；正文"来源"小节 4 文件行数纠正（107/24/27/38）；quality Q1 由 warn 提为 high（与 Q0 同类静默丢向量问题，统一为 high），新增 1 条 suggestion（CloudEmbeddingConfig.apiKey 明文存 SharedPreferences），quality 现 13 条（高危 2 / 警告 2 / 建议 9）；lint.md 自身模糊词改写；5 文件禁用词 grep 全 0；单页隔离重跑 lint.py，0 硬失败 / 0 警告）
