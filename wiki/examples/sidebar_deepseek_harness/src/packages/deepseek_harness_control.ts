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

import {
  installDeepSeekHarnessRuntime,
  readDeepSeekHarnessWebServerStatus,
  startDeepSeekHarnessWebServer,
  stopDeepSeekHarnessWebServer,
  type DeepSeekHarnessRuntimeInstallResult,
  type DeepSeekHarnessWebServerResult,
  type DeepSeekHarnessWebServerStatus,
} from "../shared/deepseek_harness_web_runtime.js";

interface DeepSeekHarnessControlAdvice {
  success: true;
  message: string;
}

export async function usage_advice(): Promise<DeepSeekHarnessControlAdvice> {
  return {
    success: true,
    message:
      "Use get_deepseek_harness_server_status to inspect DeepSeek Harness Web. " +
      "Use start_deepseek_harness_server, restart_deepseek_harness_server, or " +
      "stop_deepseek_harness_server to control it. DSH credentials stay in the native Web UI.",
  };
}

export async function get_deepseek_harness_server_status(): Promise<DeepSeekHarnessWebServerStatus> {
  return readDeepSeekHarnessWebServerStatus();
}

export async function start_deepseek_harness_server(): Promise<DeepSeekHarnessWebServerResult> {
  return startDeepSeekHarnessWebServer();
}

export async function install_deepseek_harness_runtime(): Promise<DeepSeekHarnessRuntimeInstallResult> {
  return installDeepSeekHarnessRuntime();
}

export async function restart_deepseek_harness_server(): Promise<DeepSeekHarnessWebServerResult> {
  return startDeepSeekHarnessWebServer({ forceRestart: true });
}

export async function stop_deepseek_harness_server(): Promise<DeepSeekHarnessWebServerStatus> {
  return stopDeepSeekHarnessWebServer();
}
