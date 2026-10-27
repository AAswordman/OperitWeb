# Lint 报告 — ui-chat-workspace（Issue #95）

- 日期：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 检查脚本：`scripts/lint.py --src ~/workspace/Operit`（/tmp 隔离复制后运行）

## 结果

- 硬失败：0
- 警告：0
- 禁用词：全文 4 个交付文件均未出现该三词

## 检查项

1. facts.json 引用有效性：211 条 facts，每条 ref 均指向真实文件真实行号；±5 行窗口内含 fact 所断言的代码标识（逐条语义校验无误）。
2. 行锚漂移修复：首轮自查修正 9 处；独立 critic 打回后又修正 36 处行锚漂移（全部 grep/sed 实地定位）、重写 1 条虚假断言（F74：仅 web 模板默认启用导出）、拆分 4 条复合断言（F104/F148/F156/F175，各 1→2）、补 6 条正文缺 facts 支撑的新断言。
3. quality.json：21 条（high 2 / warn 12 / suggestion 7），severity 仅使用允许的三档；每条 evidence 均为源码逐字原文（含原始缩进），逐条 verbatim 校验无误，行锚 ±5 行窗口对齐。
4. md 正文无死链：引用符号均为 facts 已覆盖的英文原名。

## 走查摘要

- 高危 2：LocalWebServer /api/proxy 开放代理（全网卡监听 + 自动附 Cookie）；WebViewHandler 预览 WebView JS/混合内容/文件访问全开。
- 警告 12：权限直接 grant、SSL 错误可点继续、CORS `*`+credentials 并存、二进制文件静默不备份、gitignore 否定规则不支持、SAF 工作区无变更追踪、保存后立即关标签的竞态、makeRelativePath 前缀误判、跨聊天停服、配置损坏静默回退到开服默认、删除无二次确认、Eruda 走公网 CDN。
- 建议 7：整文件进内存、runBlocking 阻塞工具线程、hashCode 缓存碰撞、Coil 缓存禁用、加载失败静默、子目录规则忽略、下载无大小限制。
