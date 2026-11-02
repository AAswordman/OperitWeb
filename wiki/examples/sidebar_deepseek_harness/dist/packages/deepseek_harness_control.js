"use strict";
/* METADATA
{
  "name": "deepseek_harness_control",
  "display_name": {
    "zh": "DeepSeek Harness 控制",
    "en": "DeepSeek Harness Control"
  },
  "description": {
    "zh": "管理 DeepSeek Harness Web 服务：查询状态、启动、重启和停止。DSH 凭据仍仅由原生 Web UI 管理。",
    "en": "Manage the DeepSeek Harness Web service: inspect, start, restart, and stop it. DSH credentials remain managed only by its native Web UI."
  },
  "enabled_by_default": true,
  "category": "System",
  "tools": [
    {
      "name": "usage_advice",
      "description": {
        "zh": "DeepSeek Harness 服务控制建议。",
        "en": "DeepSeek Harness service control advice."
      },
      "parameters": [],
      "advice": true
    },
    {
      "name": "get_deepseek_harness_server_status",
      "description": {
        "zh": "查询 DeepSeek Harness Web 服务状态、回环地址、PID 和日志尾部。",
        "en": "Inspect DeepSeek Harness Web status, loopback URL, PID, and recent logs."
      },
      "parameters": []
    },
    {
      "name": "start_deepseek_harness_server",
      "description": {
        "zh": "启动已安装的 DeepSeek Harness Web 服务，不执行运行时更新。",
        "en": "Start the installed DeepSeek Harness Web service without updating the runtime."
      },
      "parameters": []
    },
    {
      "name": "install_deepseek_harness_runtime",
      "description": {
        "zh": "显式安装或更新 DeepSeek Harness 运行时到上游 latest。",
        "en": "Explicitly install or update the DeepSeek Harness runtime to upstream latest."
      },
      "parameters": []
    },
    {
      "name": "restart_deepseek_harness_server",
      "description": {
        "zh": "停止后重新启动 DeepSeek Harness Web 服务。",
        "en": "Stop and restart DeepSeek Harness Web."
      },
      "parameters": []
    },
    {
      "name": "stop_deepseek_harness_server",
      "description": {
        "zh": "停止 DeepSeek Harness Web 服务。",
        "en": "Stop DeepSeek Harness Web."
      },
      "parameters": []
    }
  ]
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.usage_advice = usage_advice;
exports.get_deepseek_harness_server_status = get_deepseek_harness_server_status;
exports.start_deepseek_harness_server = start_deepseek_harness_server;
exports.install_deepseek_harness_runtime = install_deepseek_harness_runtime;
exports.restart_deepseek_harness_server = restart_deepseek_harness_server;
exports.stop_deepseek_harness_server = stop_deepseek_harness_server;
const deepseek_harness_web_runtime_js_1 = require("../shared/deepseek_harness_web_runtime.js");
async function usage_advice() {
    return {
        success: true,
        message: "Use get_deepseek_harness_server_status to inspect DeepSeek Harness Web. " +
            "Use start_deepseek_harness_server, restart_deepseek_harness_server, or " +
            "stop_deepseek_harness_server to control it. DSH credentials stay in the native Web UI.",
    };
}
async function get_deepseek_harness_server_status() {
    return (0, deepseek_harness_web_runtime_js_1.readDeepSeekHarnessWebServerStatus)();
}
async function start_deepseek_harness_server() {
    return (0, deepseek_harness_web_runtime_js_1.startDeepSeekHarnessWebServer)();
}
async function install_deepseek_harness_runtime() {
    return (0, deepseek_harness_web_runtime_js_1.installDeepSeekHarnessRuntime)();
}
async function restart_deepseek_harness_server() {
    return (0, deepseek_harness_web_runtime_js_1.startDeepSeekHarnessWebServer)({ forceRestart: true });
}
async function stop_deepseek_harness_server() {
    return (0, deepseek_harness_web_runtime_js_1.stopDeepSeekHarnessWebServer)();
}
