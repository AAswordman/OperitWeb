# 项目结构与目录演进

这一章要建立的认知很重要：  
目录结构不是越复杂越高级，而是应该随着需求升级逐步演进。  
你不需要一开始就做成 ToolPkg 工程，但你要知道什么时候该升级结构。

## 学完这一章，你应该能做到

- 分清单文件脚本、多文件 TS 工程、ToolPkg 工程三种目录结构。
- 知道 `src/`、`dist/`、`types/`、`resources/`、`packages/` 各自服务什么目的。
- 知道在独立项目里，`types/` 应该怎样和 `examples/types` 对接。

## 建议先具备

- 已经看过 `tsconfig` 两章。
- 已经知道 ToolPkg 和普通脚本包不是一个量级。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `examples/github/src/index.ts`
- `examples/github/tsconfig.json`
- `examples/windows_control`
- `examples/linux_ssh`

## 先看 3 种目录结构

### 1. 单文件脚本包

```text
my-script-project/
├── types/
├── hello_tool.ts
├── tsconfig.json
└── package.json
```

### 2. 多文件 TypeScript 工程

```text
my-ts-package/
├── src/
│   ├── index.ts
│   ├── tools/
│   └── utils/
├── dist/
├── types/
├── tsconfig.json
└── package.json
```

### 3. ToolPkg 工程

```text
my-toolpkg/
├── manifest.json
├── src/
│   ├── main.ts
│   ├── packages/
│   └── ui/
├── dist/
├── resources/
├── types/
└── tsconfig.json
```

## 把这些结构拆开理解

### 单文件脚本包适合什么时候

适合你现在只想解决一个非常具体的问题，比如：

- 先写一个文件读取工具
- 先写一个网络请求工具
- 先验证某个宿主 API 能不能跑通

这时候最重要的是：

- 宿主类型接得进来
- 编译能成功
- 调试路径简单

### 多文件 TypeScript 工程适合什么时候

当你开始出现这些信号时，就说明单文件快撑不住了：

- 工具不止一个
- 公共逻辑开始复用
- 需要单独拆 `utils`
- `index.ts` 想做导出聚合

这时：

- `src/` 负责放源码
- `dist/` 负责放编译产物
- `types/` 负责放宿主声明

`examples/github/src/index.ts` 就很适合作为这种结构的参考。

### ToolPkg 工程适合什么时候

当你开始需要这些能力时，就不建议继续只用普通脚本包了：

- `manifest.json`
- 多个 subpackage
- resources
- UI 模块
- hook / plugin 注册

这时 `src/main.ts` 不再只是一个普通入口文件，而是整个 ToolPkg 的注册中心。

## `types/` 目录在独立项目里应该怎么放

这一点必须说清楚。  
如果你是在自己的独立脚本项目里开发，最常见的做法是：

1. 把 `examples/types` 整个复制到自己项目里
2. 命名为 `types/`
3. 用 `tsconfig.json` 的 `typeRoots` 接进去
4. 在脚本文件里通过三斜线引用 `./types/index.d.ts`

也就是说，独立项目里的 `types/` 往往不是你自己从零发明的，而是宿主类型目录的镜像入口。

## 回到源码仓库，它为什么这样写

你去看两个真实 ToolPkg 示例：

- `examples/windows_control`
- `examples/linux_ssh`

它们都会呈现出同一类结构信号：

- 有 `manifest.json`
- 有 `src/`
- 有 `dist/`
- 有 `resources/`

这说明 ToolPkg 的目录结构已经不是为了“写起来顺手”，而是为了同时满足：

- 编译输出
- 包结构
- 资源装配
- 主入口注册

## 本章最容易踩的坑

### 坑 1：一开始就照 ToolPkg 结构搭项目

如果你还没跑通最小脚本，这会让学习曲线变得非常陡。

### 坑 2：明明项目已经多文件化了，却还拒绝引入 `src/` / `dist/`

这样后面只会让编译产物、导出入口、调试路径越来越混乱。

### 坑 3：独立项目里忘了把宿主 `types/` 接进来

结构看起来很完整，但最关键的宿主契约没有接入，开发体验会非常差。

## 本章自查

- 我是否知道当前项目到底适合哪一种结构？
- 我是否知道 `types/` 在独立项目里通常来自哪里？
- 我是否知道什么时候该从单文件升级到多文件，再升级到 ToolPkg？

## 下一章

建议继续看《[ToolPkg 基础与 manifest](/#/plugin-tutorial/toolpkg-basics)》。
