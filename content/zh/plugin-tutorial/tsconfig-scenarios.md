# 场景化 tsconfig 与排错

上一章讲的是最基础模板，这一章专门处理更真实的问题：  
不同项目形态要怎么配？`Tools` 没提示怎么办？`dist` 路径不对怎么办？为什么编译能过但运行时导出不生效？

## 学完这一章，你应该能做到

- 按项目形态选择更合适的 `tsconfig.json`。
- 知道单文件脚本、多文件 TS 包、ToolPkg 三种场景最关键的差别。
- 遇到宿主类型失效、输出路径不对、模块系统不对时，知道先查哪几项。

## 建议先具备

- 已经看过《tsconfig 基础模板》。
- 已经理解 `typeRoots` 和 `examples/types` 的关系。

## 本章对应的真实文件

- `examples/tsconfig.json`
- `examples/github/tsconfig.json`
- `examples/windows_control/tsconfig.json`
- `examples/windows_control/manifest.json`

## 先看一个场景表

| 场景 | 推荐参考 | 关键配置点 |
|---|---|---|
| 单文件脚本包 | `examples/tsconfig.json` | `module: "commonjs"`、`lib: ["es2020"]`、`typeRoots: ["./types"]` |
| 多文件 TypeScript 包 | `examples/github/tsconfig.json` | `outDir: "./dist"`、`include` 覆盖 `src` 和共享类型 |
| ToolPkg 工程 | `examples/windows_control/tsconfig.json` | `outDir` 与 `manifest.main` / `subpackage.entry` 保持一致 |

## 把 3 种场景拆开理解

### 场景 1：单文件脚本包

这类项目的目标通常是：

- 先把一个脚本文件写出来
- 在原地编译成 `.js`
- 直接交给 `tools/execute_js.bat` 调试

所以配置重点是：

- `commonjs`
- `es2020`
- 正确接入 `types/`

这时你通常不急着上复杂目录结构，也不一定立刻需要 `outDir`。

### 场景 2：多文件 TypeScript 包

一旦开始拆：

- `src/`
- 多个业务文件
- 入口聚合文件

就应该认真考虑：

```json
"outDir": "./dist"
```

以及：

```json
"include": [
  "./**/*.ts",
  "./**/*.d.ts",
  "../types/**/*.d.ts"
]
```

`examples/github/tsconfig.json` 就是这种工程化配置的典型参考。

### 场景 3：ToolPkg 工程

到了 ToolPkg，你已经不只是“让 TS 编译通过”，而是要保证编译结果和包结构对齐。  
比如 `examples/windows_control/manifest.json` 写的是：

- `main: "dist/main.js"`
- `subpackages[].entry: "dist/packages/windows_control.js"`

那你的 `tsconfig.json` 里就必须有一个和这个路径协同的 `outDir`。  
否则 `manifest` 指向的文件可能根本不存在。

## 从症状反推配置问题

### 症状 1：`Tools` 没有类型提示

优先检查：

- 三斜线引用有没有接 `index.d.ts`
- `typeRoots` 有没有指到正确的 `types/`
- 独立项目里是不是只复制了部分 `.d.ts`，而不是整套 `examples/types`

### 症状 2：返回值没有精确类型

优先检查：

- 是否真的接入了 `index.d.ts`
- 是否走的是 `toolCall(...)` 的映射链路还是 `Tools.xxx` 的直接命名空间方法
- 对应的类型文件和 `results.d.ts` 有没有被项目纳入编译范围

### 症状 3：编译产物路径不在预期目录

优先检查：

- `outDir`
- `include`
- 你的实际源码位置和 `tsconfig` 写法是否一致

### 症状 4：编译能过，但运行时导出不生效

优先检查：

- `module` 是否还是 `commonjs`
- 你最终生成的文件里是否仍然按宿主预期暴露 `exports.xxx = xxx`
- ToolPkg 的 `manifest.main` 和 `subpackages.entry` 是否指向了正确的编译输出

## 回到源码仓库，它为什么这样写

你看三份真实配置会发现，它们不是“同一份模板随便复制”，而是随着项目形态在演进：

- `examples/tsconfig.json`
  优先服务单文件或小规模脚本开发。
- `examples/github/tsconfig.json`
  开始考虑多文件组织和 `dist` 输出目录。
- `examples/windows_control/tsconfig.json`
  已经和 ToolPkg 的最终包结构绑定起来了。

这说明 `tsconfig.json` 的本质不是“一次写好永远不动”，而是工程结构的一部分。

## 本章最容易踩的坑

### 坑 1：把单文件脚本配置直接照搬到 ToolPkg 工程

这通常会导致 `dist` 产物和 `manifest` 指向脱节。

### 坑 2：以为 `typeRoots` 只影响编辑器，不影响项目整体类型接入

其实它直接决定编译器怎么发现宿主声明。

### 坑 3：只看编译通过，不看最终产物路径

对 ToolPkg 来说，编译通过只是第一步，真正重要的是 `manifest` 能否找到正确输出文件。

## 本章自查

- 我是否知道自己的项目属于哪一种场景？
- 我是否知道 ToolPkg 场景下为什么必须同时看 `tsconfig` 和 `manifest.json`？
- 我是否知道 `Tools` 没提示时第一批该检查哪些配置项？

## 下一章

建议继续看《[项目结构与目录演进](/#/plugin-tutorial/project-structure)》。
