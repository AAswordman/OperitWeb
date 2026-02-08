# 沙盒包（Package）

> 这里的“沙盒包”对应 Operit 界面里的 `Packages` 标签。

## 它是什么

沙盒包是用脚本定义的一类动态工具包。你可以把它理解为：

- 一组可被 AI 调用的工具函数
- 一份包级元数据（名称、说明、参数、环境变量、状态切换等）

这类包由 `use_package(package_name)` 激活，然后通过 `包名:工具名` 调用。

## 用户视角：你会在界面看到什么

在 `包管理 > Packages`：

- 查看可用包和已导入包
- 导入外部包（当前界面导入器主要支持 `.js`）
- 启用/停用某个包
- 查看包详情、工具列表和环境变量要求

外部包目录（应用提示路径）：

`Android/data/com.ai.assistance.operit/files/packages`

## 内置沙盒包与默认导入逻辑

应用启动后会扫描内置包与外部包。对于“内置且默认启用”的包，会自动加入已导入列表（除非你手动禁用了它）。

常见内置沙盒包（随版本变化，以包管理界面实际显示为准）例如：

- `daily_life`
- `super_admin`
- `system_tools`
- `extended_file_tools`
- `extended_http_tools`
- `extended_memory_tools`
- `ffmpeg`
- `file_converter`
- `web`

## 调用方式（统一且清晰）

1. 激活包：`use_package(package_name)`
2. 调用工具：`packageName:toolName`

例如（示意）：

- `use_package("daily_life")`
- `daily_life:get_current_date`

> 系统也支持“先直接调用 `packageName:toolName` 再自动尝试激活”，但建议仍按“先激活后调用”理解。

## 包的高级能力（给进阶用户）

沙盒包支持：

- `env`：声明包所需环境变量（可必填 / 可选 / 默认值）
- `states`：按设备条件自动切换工具集（如权限等级、是否可用 Shizuku、虚拟显示能力等）

这意味着同一个包在不同设备或授权级别下，最终可用工具可能不同。

## 如何编写自己的沙盒包

官方脚本开发文档：

- GitHub 页面：
  `https://github.com/AAswordman/Operit/blob/main/docs/SCRIPT_DEV_GUIDE.md`
- Raw 链接（便于直接读取）：
  `https://raw.githubusercontent.com/AAswordman/Operit/main/docs/SCRIPT_DEV_GUIDE.md`

最小结构（示意）：

```js
/*
METADATA
{
  "name": "my_package",
  "description": { "zh": "我的包", "en": "My package" },
  "tools": [
    {
      "name": "hello",
      "description": { "zh": "打招呼", "en": "Say hello" },
      "parameters": []
    }
  ]
}
*/

async function hello(params) {
  complete({ success: true, message: "hello" });
}

exports.hello = hello;
```

## 常见问题

- **导入失败：仅支持 JavaScript 文件**
  - 在当前 Packages 页导入流程中，请优先使用 `.js` 文件
- **激活成功但工具不可用**
  - 检查是否漏配 `env`
  - 检查该包当前 `state` 是否把工具排除了
- **调用报“包未激活”**
  - 先显式执行一次 `use_package(package_name)`
