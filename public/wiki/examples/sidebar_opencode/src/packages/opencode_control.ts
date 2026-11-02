/* METADATA
{
  "name": "opencode_control",
  "display_name": {
    "zh": "OpenCode 配置",
    "en": "OpenCode Config"
  },
  "description": {
    "zh": "编辑 OpenCode 全局配置文件（`~/.config/opencode/opencode.json`），本包默认启用。",
    "en": "Edit the OpenCode global config file (`~/.config/opencode/opencode.json`). Enabled by default."
  },
  "enabled_by_default": true,
  "category": "System",
  "tools": [
    {
      "name": "usage_advice",
      "description": {
        "zh": "OpenCode 配置编辑建议：\\n- 本包只编辑 `~/.config/opencode/opencode.json`，不提供服务启停控制。\\n- 写入与合并工具接受合法 JSON / JSONC 对象字符串，但写回时会统一整理成标准 JSON。\\n- 建议优先用 merge 工具做局部更新，例如 provider、model、server.port。\\n- OpenCode 官方文档说明该全局配置路径会和项目级配置合并，冲突键以后者覆盖前者。",
        "en": "OpenCode config editing advice:\\n- This package only edits `~/.config/opencode/opencode.json` and does not expose server start/stop controls.\\n- Write and merge tools accept valid JSON / JSONC object strings, but the saved file is normalized to standard JSON.\\n- Prefer the merge tool for partial updates such as provider, model, or server.port.\\n- OpenCode docs state that the global config is merged with project-level config, with later sources overriding conflicting keys."
      },
      "parameters": [],
      "advice": true
    },
    {
      "name": "read_opencode_global_config",
      "description": {
        "zh": "读取 OpenCode 全局配置文件原文与解析结果。",
        "en": "Read the raw OpenCode global config file and its parsed result."
      },
      "parameters": []
    },
    {
      "name": "write_opencode_global_config",
      "description": {
        "zh": "用传入的 JSON 对象完整覆盖 OpenCode 全局配置文件。",
        "en": "Fully overwrite the OpenCode global config file with the provided JSON object."
      },
      "parameters": [
        { "name": "config_json", "description": { "zh": "完整配置 JSON / JSONC 字符串，必须是对象。", "en": "Full config JSON / JSONC string. Must be an object." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "merge_opencode_global_config",
      "description": {
        "zh": "把传入 JSON 对象深度合并到当前 OpenCode 全局配置。",
        "en": "Deep-merge the provided JSON object into the current OpenCode global config."
      },
      "parameters": [
        { "name": "patch_json", "description": { "zh": "要合并进去的 JSON / JSONC 字符串，必须是对象。", "en": "JSON / JSONC string to merge into the current config. Must be an object." }, "type": "string", "required": true }
      ]
    }
  ]
}
*/

import {
  mergeOpenCodeGlobalConfig,
  readOpenCodeGlobalConfig,
  writeOpenCodeGlobalConfig,
} from "../shared/opencode_config_runtime.js";

exports.usage_advice = async function usageAdvice() {
  return {
    success: true,
    message:
      "本包只负责编辑 OpenCode 全局配置文件 ~/.config/opencode/opencode.json，不负责服务启停。",
  };
};

exports.read_opencode_global_config = readOpenCodeGlobalConfig;
exports.write_opencode_global_config = writeOpenCodeGlobalConfig;
exports.merge_opencode_global_config = mergeOpenCodeGlobalConfig;
