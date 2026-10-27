# Critic 复核报告：api-chat-codex（Codex 供应商）

- 复核人：独立 critic（与 writer 无关）
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 日期：2026-10-01

## 结论：退回修正（引用行号错位，无事实性错误）

33 条 facts 的断言全部真实，无虚构、无复合事实、无符号笔误；但 **3 条引用行号与断言错位**——断言为真，但支撑代码落在所引行号 ±5 窗口之外。按对照表修正后即可通过，无需重走全文复核。

## 引用错位对照表（现引用 → 建议引用）

| # | 现引用 | 建议引用 | 问题说明 |
|---|--------|----------|----------|
| fact 13 | CodexProvider.kt:146 | **:159** | 断言"搜索展示 XML 根为 `<search provider=\"codex\">`，内含 action、status 属性与 query/source 子节点"。现窗口 141–151 只有函数签名；实际拼 XML 在 :153–164（`<search>` :153、provider :154、action :155、status :156、query :159、source :164）。:159 的窗口 154–164 全部覆盖 |
| fact 18 | CodexProvider.kt:183 | **:190** | 断言含 escapeXmlAttribute 与 escapeXmlText 两函数的转义顺序。现窗口 178–188 只覆盖前者（:185–189）；escapeXmlText 在 :192–196，窗外。:190 的窗口 185–195 同时覆盖两者 |
| fact 32 | CodexProvider.kt:276 | **:294** | 断言"有 experimental.modes 的模型会为每个 mode 生成 `$id-$mode` 的变体 ModelOption，展示名首字母大写"。现窗口 271–281 只有 modes 取值（:281）；变体生成在 :294–297（`id = \"$id-$mode\"` :295、首字母大写 :296），窗外。:294 的窗口 289–299 覆盖 |

## quality.json：3/3 通过

每条 evidence 均与源码逐字一致且落在标注行 ±5 窗口内；severity/confidence 合理：
- warning 1（模型目录请求无鉴权头 :242）
- suggestion 2（强制关并行工具调用 :78、强制 reasoning.encrypted_content :83）

## 正文：通过

- §9 双受众结构完整：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 / 关键符号 / 调用链三段式 / 来源。
- OAuth 鉴权、请求体定制、白名单、-fast 映射等人话解释到位，符号名保留英文原文，来源引用精确到行。
- 无评审过程用语残留，无走查内容进正文。

## status.json：正确

id=api-chat-codex，issue=36，status=review-pending，source_repo=Operit，source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb。

## lint / 已读：0/0；seed 单文件已登记 complete

## 待办

writer 按上表修正 3 处引用行号，逐条复验新窗口完全支撑断言，更新 lint 后即视为通过。
