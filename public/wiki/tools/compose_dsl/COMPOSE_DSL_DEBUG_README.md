# Compose DSL UI Dump

## 用途

`dump_current_compose_dsl_ui.bat` 用来抓取当前正在显示的 `compose_dsl` 页面运行时快照，方便排查：

- 脚本输出的组件树是否正确
- 宿主解析后的树是否一致
- 布局坐标和尺寸是否符合预期
- 当前页面 `state` / `memo` 是否异常

这套工具适合排查“结构看起来对，但界面显示不对”的问题。

## 使用方法

1. 用宿主打开你要调试的 `compose_dsl` 页面。
2. 等页面进入你想观察的状态。
3. 运行：

```bat
d:\Code\prog\assistance\tools\compose_dsl\dump_current_compose_dsl_ui.bat
```

## 前提条件

- 已安装并可使用 `adb`
- 至少连接了一台可调试设备
- 设备上的宿主版本已经包含当前调试导出逻辑
- 设备上已安装 `com.ai.assistance.operit.debug` 或 `com.ai.assistance.operit`；脚本未指定时优先使用 Debug 包

如果连接了多台设备，脚本会提示选择目标设备。

如果 Debug 和 Release APK 同时安装，可以用环境变量指定目标：

```bat
set OPERIT_APP_PACKAGE=com.ai.assistance.operit
d:\Code\prog\assistance\tools\compose_dsl\dump_current_compose_dsl_ui.bat
```

## 导出位置

脚本会把文件拉回本地目录：

```text
d:\Code\prog\assistance\debug_output\compose_dsl_dump\<时间戳>\
```

例如：

```text
d:\Code\prog\assistance\debug_output\compose_dsl_dump\20260425-153457\
```

## 文件说明

- `dump_manifest.json`
  当前页面的基础信息，包括包名、模块名、phase、是否仍在 loading / dispatching。

- `source_script.js`
  当前页面实际执行的 UI 脚本源码。

- `raw_render_result.txt`
  JS 原始 render 返回值的文本形式。

- `raw_render_result.json`
  如果原始返回值可以解析为 JSON，这里会保存格式化后的版本。

- `parsed_render_result.json`
  宿主解析后的完整 render 结果。

- `compose_tree.txt`
  解析后的组件树，可快速看结构。

- `compose_tree.json`
  组件树的 JSON 形式。

- `layout_nodes.txt`
  每个节点的真实布局信息，包括 `x / y / width / height`。

- `layout_nodes.json`
  布局信息的 JSON 形式。

- `compose_layout_tree.txt`
  “组件树 + 布局信息”合并后的可读版本。

- `state.json`
  当前页面状态。

- `memo.json`
  当前页面 memo。

## 推荐排查顺序

1. 先看 `dump_manifest.json`
   确认抓到的是不是当前页面，以及页面是不是已经稳定。

2. 再看 `compose_tree.txt`
   判断脚本输出结构是否正确。

3. 再看 `layout_nodes.txt` 或 `compose_layout_tree.txt`
   判断真实布局是不是出了问题。

4. 如果怀疑状态异常，再看 `state.json`
   确认是不是脚本状态导致界面不对。

5. 如果怀疑宿主解析有偏差，再对比：
   `raw_render_result.json` 和 `parsed_render_result.json`

## 常见场景

- 文本、图标、按钮没有居中
- `weight`、`fillMaxWidth`、`padding` 没按预期生效
- `onLoad` 后页面状态和预期不一致
- 脚本写出来的树和宿主最终理解的树不同

## 注意事项

- 这套工具抓的是“当前正在显示的页面快照”，不是历史页面。
- 如果页面还在频繁重组或异步加载，建议等稳定后再抓一次。
- 如果宿主调试导出逻辑有更新，需要重新安装宿主后才能看到新导出字段。
