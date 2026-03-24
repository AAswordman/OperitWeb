# 编译、运行与调试

这一章只关注一件事：写完以后怎么真正跑起来。  
而且一定要把四件事分开看：

- 编译
- 运行
- 安装调试
- 看日志

## 学完这一章，你应该能做到

- 区分普通脚本包和 ToolPkg 的调试路径。
- 知道 `npx tsc`、`tools/execute_js.bat`、`tools/debug_toolpkg.bat` 各自什么时候用。
- 知道出问题时该优先看哪些日志标签。

## 建议先具备

- 已经看过 ToolPkg 两章。
- 已经知道普通脚本包和 ToolPkg 的结构差异。

## 本章对应的真实文件

- `tools/execute_js.bat`
- `tools/debug_toolpkg.bat`
- `tools/debug_toolpkg.py`
- `docs/SCRIPT_DEV_GUIDE.md`
- `docs/TOOLPKG_FORMAT_GUIDE.md`

## 先看两条最常见流程

### 普通脚本包

```bash
cd examples
npx tsc

cd ..
tools/execute_js.bat examples/my_first_script.js hello_world "{/"name/":/"世界/"}"
```

### ToolPkg

```bash
cd <repo-root>
tools/debug_toolpkg.bat examples/windows_control
```

## 把流程拆开理解

### 1. 编译

TypeScript 项目的第一步通常是编译。  
无论是普通脚本包还是 ToolPkg，只要源码是 `.ts`，就通常要先：

```bash
npx tsc
```

如果你要指定某个项目配置，也可以：

```bash
npx tsc -p examples/github/tsconfig.json
```

### 2. 运行普通脚本包

`tools/execute_js.bat` 是面向普通脚本包的执行器。  
它做的事情包括：

- 检查 adb
- 检测连接设备
- 把脚本推到设备临时目录
- 通过广播让宿主执行指定函数
- 等待一小段时间后抓取 `ScriptExecutionReceiver` / `JsEngine` 相关日志

所以它适合这种场景：

- 你手里有一个 `.js`
- 你知道要执行哪个导出函数
- 你想快速验证这个函数本身是否正常

### 3. 安装调试 ToolPkg

ToolPkg 不要按“直接执行某个导出函数”的思路调。  
`tools/debug_toolpkg.bat` 的本质是去调用 `debug_toolpkg.py`，而后者做的是：

- 解析 `manifest`
- 校验 `toolpkg_id` 和 `main`
- 把整个包目录或 `.toolpkg` 打成临时归档
- 推送到设备包目录
- 触发 ToolPkg 调试安装广播
- 抓取 `ToolPkg` / `PackageManager` 相关日志

这就是为什么 ToolPkg 的调试思路更接近“重装调试包”，而不是“执行一个单函数”。

## 什么时候用哪个工具

| 场景 | 推荐工具 | 说明 |
|---|---|---|
| 单文件 / 普通脚本包函数验证 | `tools/execute_js.bat` | 直接指定 `.js` 文件和导出函数 |
| ToolPkg 包安装与注册调试 | `tools/debug_toolpkg.bat` | 会走打包、推送、安装、抓日志流程 |
| 只想先确认 TS 是否编过 | `npx tsc` | 先检查编译层面的问题 |

## 日志应该怎么看

### 普通脚本包常看

- `ScriptExecutionReceiver:*`
- `JsEngine:*`

### ToolPkg 常看

- `ToolPkg:*`
- `PackageManager:*`
- `ToolPkgDebugInstallReceiver:*`

这也是为什么两个批处理脚本抓的日志标签并不一样。  
因为它们面对的是不同阶段的问题。

## 一套更稳的工作流

### 普通脚本包

1. 写 `.ts`
2. `npx tsc`
3. `tools/execute_js.bat ...`
4. 看日志
5. 回到类型文件和源码一起改

### ToolPkg

1. 改 `src/`、`manifest.json` 或相关资源
2. `npx tsc`
3. `tools/debug_toolpkg.bat ...`
4. 看 `ToolPkg` / `PackageManager` 日志
5. 核对 `manifest`、注册函数、编译输出路径

## 回到源码仓库，它为什么这样写

这套工具链的设计很一致：

- 普通脚本包重点在“执行某个函数”
- ToolPkg 重点在“安装整个插件包并检查注册过程”

也就是说，调试方式是被包形态决定的，不是随便选一条命令都行。

## 本章最容易踩的坑

### 坑 1：ToolPkg 还没装进设备，就想像普通脚本那样直接跑

这会让你一直在错误的调试路径里打转。

### 坑 2：只看编译是否成功，不看安装 / 注册日志

对 ToolPkg 来说，编译通过只是前半程。

### 坑 3：日志只看一眼报错文字，不回头核对 `manifest`、类型和导出结构

很多问题表面上像运行错误，本质上其实是配置或包结构不一致。

## 本章自查

- 我是否知道普通脚本和 ToolPkg 为什么要走不同调试路径？
- 我是否知道 `execute_js.bat` 和 `debug_toolpkg.bat` 大致各做了什么？
- 我是否知道遇到问题时要优先看哪组日志标签？

## 下一章

建议继续看《[常见坑与定位方法](/#/guide/plugin/pitfalls)》。
