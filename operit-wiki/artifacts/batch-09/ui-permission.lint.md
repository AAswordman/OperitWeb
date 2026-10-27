---
title: ui-permission 自检报告
module: UI / 权限与 Token
sources: 0
date: 2026-10-01
---

# ui-permission 自检报告

- 检查文件：1（ui-permission.md）
- 硬失败：0
- 警告：0
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 种子文件：5 个（`ui/features/permission/` 目录 2 个 + `ToolPermissionSettingsScreen.kt` + `AppPermissionsScreen.kt` + `TokenConfigWebViewScreen.kt`）

## 检查项

- frontmatter 齐全：title / module / sources / date / issue。
- 正文六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源。
- facts 124 条：每条 ref 经脚本校验，文件存在、行号在源文件行数范围内；关键符号经 grep/sed 实地核对，非推测。
- 全文无模糊表述用词。
- quality.json 8 条（警告 5 / 建议 3），每条有 file:line 与 ±5 行代码证据；只报实质问题，无凑数。

## 路径偏差说明

- 任务给定的 `settings/screens/PermissionScreen.kt` 与 `settings/screens/TokenConfigScreen.kt` 在源码仓库中不存在（find 全仓库无同名文件）。
- 已按任务要求定位同职能文件：`ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt`（应用权限管理界面）、`ui/features/token/TokenConfigWebViewScreen.kt`（Token 配置界面），100% 读完并纳入 facts。

## 来源

- 本报告为 writer 自检记录，对应条目 `ui-permission.md` 及其配套 `ui-permission.facts.json`、`ui-permission.quality.json`、`ui-permission.status.json`。
