# 常见坑与定位方法

这一章不再只是零散提醒，而是把最常见问题改成“症状 -> 原因 -> 修复 -> 预防”的排错页。  
当你开始真的写脚本、接类型、跑 ToolPkg，这一页通常会是回看频率最高的一页之一。

## 学完这一章，你应该能做到

- 遇到常见问题时，先按症状定位，而不是盲猜。
- 把类型系统相关坑和脚本结构相关坑分开排查。
- 根据项目阶段决定自己下一步应该回哪一章、哪份类型文件、哪份示例。

## 建议先具备

- 已经看过前面的章节，尤其是宿主类型系统、`tsconfig`、ToolPkg、调试两部分。

## 本章对应的真实文件

- `examples/types/index.d.ts`
- `examples/types/core.d.ts`
- `examples/types/tool-types.d.ts`
- `examples/types/results.d.ts`
- `examples/tsconfig.json`
- `examples/windows_control/manifest.json`

## 症状 1：函数写好了，但宿主找不到工具

### 常见原因

- 忘了 `exports.xxx = xxx`
- `METADATA.tools[].name` 和函数名、导出名对不上
- 最终编译产物里的导出结构和你以为的不一样

### 如何修

- 先核对 `METADATA` 里的工具名
- 再核对真实函数名
- 最后核对导出语句

### 如何避免下次再犯

- 入门阶段尽量让工具名、函数名、导出名完全一致
- 不要一开始就玩复杂别名

## 症状 2：`Tools`、`complete(...)`、`exports` 没有提示

### 常见原因

- 三斜线引用缺失
- `typeRoots` 没接对
- 独立项目里没有完整复制 `examples/types`

### 如何修

- 检查脚本文件是否引用了 `./types/index.d.ts`
- 检查 `tsconfig.json` 的 `typeRoots`
- 确认项目里的 `types/` 真的是从 `examples/types` 完整复制过来的

### 如何避免下次再犯

- 把“宿主类型入口是否接入”当成新项目初始化的第一批检查项

## 症状 3：`toolCall(...)` 或某些结果字段没有精确类型

### 常见原因

- 没理解 `toolCall` 的类型链路
- 查错了文件，以为所有字段都在 `tool-types.d.ts`
- 某个工具名没有命中映射表

### 如何修

- 先去 `core.d.ts` 看 `ToolReturnType<T>`
- 再去 `tool-types.d.ts` 看工具名映射
- 最后去 `results.d.ts` 看具体结构

### 如何避免下次再犯

- 养成“工具名 -> 映射表 -> 结果结构”三步查法

## 症状 4：把宿主脚本当成网页脚本

### 常见原因

- 心里默认这是浏览器环境
- `lib` 配置和类型心智都跑偏到 DOM 侧

### 如何修

- 回到 `index.d.ts` 看全局对象声明
- 重新确认这里的关键对象是 `Tools`、`complete`、`exports`
- 不要默认寻找 `window`、`document`

### 如何避免下次再犯

- 每次写宿主 API 之前，都先问自己一句：我现在是在写宿主脚本，还是在写网页？

## 症状 5：ToolPkg 编译通过了，但安装或注册不成功

### 常见原因

- `manifest.main` 指向的文件不存在
- `subpackages[].entry` 没对上编译输出
- `main` 脚本里注册函数写错或没被正确导出

### 如何修

- 先对照 `manifest.json`
- 再核对 `tsconfig.outDir`
- 再回到 `src/main.ts` 和 `toolpkg.d.ts`

### 如何避免下次再犯

- ToolPkg 改动时，不要只看源码，要同时看 `manifest`、输出目录和调试安装日志

## 症状 6：ToolPkg 的 hook、UI 模块写着写着越来越模糊

### 常见原因

- 只盯着示例代码抄，没有回 `toolpkg.d.ts`
- Compose DSL 用法只靠印象，没有去看 `compose-dsl*.d.ts`

### 如何修

- 回到 `toolpkg.d.ts` 看注册对象和 hook 约束
- 回到 `compose-dsl.d.ts` 和 `compose-dsl.material3.generated.d.ts` 看 UI 类型

### 如何避免下次再犯

- ToolPkg 项目里，把 `types` 目录当成和 `manifest` 同等重要的参考材料

## 一条更稳的学习路线

### 路线 1：从零入门

1. 《开发环境与仓库地图》
2. JavaScript 五章
3. 《TypeScript 类型入门》
4. 宿主类型系统四章
5. `tsconfig` 与结构演进
6. ToolPkg 两章
7. 调试与排错

### 路线 2：先做出原型

1. 《开发环境与仓库地图》
2. 《变量、对象与数组》
3. 《异步、错误处理与宿主运行时》
4. 《第一个 JavaScript 脚本包》
5. 《METADATA、exports 与 complete》
6. 《编译、运行与调试》

### 路线 3：目标就是 ToolPkg

1. 先把 JavaScript 和 TypeScript 基础走通
2. 一定补看宿主类型系统四章
3. 再进入 `tsconfig`、项目结构、ToolPkg 两章
4. 最后回到调试与排错反复对照

## 读完以后，还可以去看什么

- 《[沙盒包（Package）](/#/guide/tools-and-features/ai-tools/sandbox-package)》
- 《[Skill](/#/guide/tools-and-features/ai-tools/skill)》
- 《[MCP](/#/guide/tools-and-features/ai-tools/mcp)》

## 本章自查

- 我是否已经知道类型系统相关问题通常先回哪几份 `.d.ts`？
- 我是否已经知道脚本包问题和 ToolPkg 问题要分开排查？
- 我是否已经有一条适合自己的学习路线，而不是每次都从头乱翻？

## 下一章

如果你是第一次完整读到这里，建议回到《[总览](/#/guide/plugin)》，重新按目录走一遍自己最需要的章节。  
如果你正在做真实项目，建议把本页和《[编译、运行与调试](/#/guide/plugin/build-and-debug)》一起开着用。
