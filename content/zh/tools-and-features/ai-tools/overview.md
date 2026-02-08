# AI 工具总览：内置工具 + 动态工具

如果你只想记住一句话：

**Operit 的 AI 工具有两层：内置默认工具 + 动态工具包。**

- 内置默认工具：开箱可用（如文件、网络、系统、设备信息等）
- 动态工具包：按需启用，统一通过 `use_package` 激活

## 为什么会有两层

从用户角度看，这样设计更实用：

- 日常任务不需要配置，直接可做（内置工具）
- 专项能力按需加装，不把默认工具列表堆得过长（动态工具）
- 不管动态工具来自哪里，激活入口统一（`use_package`）

## 调用模型（重点）

### 1) 内置工具

直接调用即可，不需要先激活包。

### 2) 动态工具

统一流程是：

1. 先激活：`use_package(package_name)`
2. 再调用该包里的工具（如果该包提供可执行工具）

可执行工具通常使用：

- `包名:工具名`

例如（示意）：

- `daily_life:get_current_date`
- `playwright:navigate`

> 备注：当模型已经输出了 `包名:工具名`，系统也会尝试自动激活该包；但从心智模型上，仍建议理解为“先 use_package，再调用”。

## 动态工具三大类（统一入口，不同来源）

动态工具按来源可分三类：

1. **沙盒包（Package）**
   - 以脚本包形式提供能力（常见为 `.js`）
   - 支持内置包 + 用户导入包
2. **Skill**
   - 基于 `SKILL.md` 的能力包
   - 适合规则、流程、角色化能力组织
3. **MCP**
   - 来自 MCP Server 的工具集合
   - 适合接入外部生态或远程能力

三类都能通过 `use_package(package_name)` 作为统一激活入口。

## 你在界面里如何理解

在 `包管理` 页面里可以看到三块：

- `Packages`（这里文档称为“沙盒包”）
- `Skills`
- `MCP`

用户只需要关心：

- 我要的是“开箱能力”还是“扩展能力”
- 扩展能力属于哪一类（沙盒包 / Skill / MCP）

## 继续阅读（按类型）

- [沙盒包（Package）](/#/guide/tools-and-features/ai-tools/sandbox-package)
- [Skill](/#/guide/tools-and-features/ai-tools/skill)
- [MCP](/#/guide/tools-and-features/ai-tools/mcp)
