/* METADATA
{
    "name": "qqbot",
    "display_name": {
        "zh": "QQ Bot",
        "en": "QQ Bot"
    },
    "description": {
        "zh": "把腾讯 QQ Bot 的配置、后台 Gateway WebSocket 收消息服务、消息队列读取，以及 C2C/群发消息能力整理成 Operit 工具。",
        "en": "Expose Tencent QQ Bot configuration, background Gateway WebSocket receive service, queued inbound events, and C2C/group messaging as Operit tools."
    },
    "enabledByDefault": true,
    "category": "Communication",
    "env": [
        {
            "name": "QQBOT_APP_ID",
            "description": { "zh": "QQ Bot AppID", "en": "QQ Bot AppID" },
            "required": false
        },
        {
            "name": "QQBOT_APP_SECRET",
            "description": { "zh": "QQ Bot AppSecret", "en": "QQ Bot AppSecret" },
            "required": false
        }
    ],
    "tools": [
        {
            "name": "usage_advice",
            "description": {
                "zh": "QQ Bot 使用建议：\\n- 先用 qqbot_configure 保存 AppID 和 AppSecret。\\n- 需要在腾讯 QQ Bot 管理端启用你要接收的事件，至少勾选 C2C_MESSAGE_CREATE 和/或群相关事件。\\n- 热加载后请手动调用 qqbot_service_start 拉起 Gateway WebSocket 收消息服务；需要重启旧实例时传 restart=true。\\n- 收到消息后，用 qqbot_receive_events 取出事件，再把其中 replyHint 里的 scene / openid / group_openid / msg_id 传给发送工具。\\n- 这里的 openid 不是 QQ 号，通常需要先通过收消息事件拿到。",
                "en": "QQ Bot advice:\\n- Save AppID and AppSecret with qqbot_configure first.\\n- Enable the events you want in the Tencent QQ Bot console, at least C2C_MESSAGE_CREATE and/or the relevant group events.\\n- After hot reload, start the Gateway WebSocket receive service manually with qqbot_service_start; pass restart=true when you need to replace an old instance.\\n- Use qqbot_receive_events to dequeue inbound events, then pass replyHint.scene / openid / group_openid / msg_id into the send tools.\\n- Note that openid is not the same as a QQ number; you usually obtain it from inbound events first."
            },
            "parameters": [],
            "advice": true
        },
        {
            "name": "qqbot_configure",
            "description": {
                "zh": "保存 QQ Bot 的 AppID、AppSecret 和沙箱开关；按需自动重启后台 Gateway 收消息服务。",
                "en": "Persist QQ Bot AppID, AppSecret, and sandbox mode; optionally restart the background Gateway receive service."
            },
            "parameters": [
                {
                    "name": "app_id",
                    "description": { "zh": "QQ Bot AppID", "en": "QQ Bot AppID" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "app_secret",
                    "description": { "zh": "QQ Bot AppSecret", "en": "QQ Bot AppSecret" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "use_sandbox",
                    "description": { "zh": "是否使用沙箱 OpenAPI", "en": "Whether to use sandbox OpenAPI" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "test_connection",
                    "description": { "zh": "保存后是否立即测试凭证", "en": "Whether to test credentials after saving" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "restart_service",
                    "description": { "zh": "保存后是否强制重启后台服务", "en": "Whether to force-restart the background service after saving" },
                    "type": "boolean",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_status",
            "description": {
                "zh": "读取当前 QQ Bot 配置摘要、后台服务状态、消息队列积压数量和最近缓存到的 openid 信息摘要。",
                "en": "Read the current QQ Bot config summary, background service status, queued event count, and a summary of recently cached openids."
            },
            "parameters": []
        },
        {
            "name": "qqbot_service_start",
            "description": {
                "zh": "立即启动 QQ Bot 后台 Gateway WebSocket 收消息服务；可选强制重启，适合热加载后立刻拉起。",
                "en": "Start the QQ Bot background Gateway WebSocket receive service immediately; optionally force a restart, which is useful right after hot reload."
            },
            "parameters": [
                {
                    "name": "restart",
                    "description": { "zh": "是否强制先停掉旧服务再重启", "en": "Whether to force-stop the previous service before starting" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "timeout_ms",
                    "description": { "zh": "等待服务启动成功的超时毫秒数，默认 4000", "en": "Timeout in milliseconds while waiting for the service to become healthy, default 4000" },
                    "type": "number",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_service_stop",
            "description": {
                "zh": "停止当前 QQ Bot 后台 Gateway WebSocket 收消息服务。",
                "en": "Stop the current QQ Bot background Gateway WebSocket receive service."
            },
            "parameters": [
                {
                    "name": "timeout_ms",
                    "description": { "zh": "等待服务停掉的超时毫秒数，默认 4000", "en": "Timeout in milliseconds while waiting for the service to stop, default 4000" },
                    "type": "number",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_receive_events",
            "description": {
                "zh": "从后台服务维护的事件队列里读取 QQ Bot 收到的事件；默认会消费并移除这些事件。",
                "en": "Read inbound QQ Bot events from the queue maintained by the background service; by default the events are consumed and removed."
            },
            "parameters": [
                {
                    "name": "limit",
                    "description": { "zh": "最多取多少条事件，默认 20", "en": "Maximum number of events to return, default 20" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "consume",
                    "description": { "zh": "是否在读取后从队列移除，默认 true", "en": "Whether to remove the returned events from the queue, default true" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "scene",
                    "description": { "zh": "可选过滤：c2c / group / unknown", "en": "Optional scene filter: c2c / group / unknown" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "event_type",
                    "description": { "zh": "可选过滤：只保留指定 eventType", "en": "Optional filter: keep only a specific eventType" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "include_raw",
                    "description": { "zh": "是否返回 rawBody / rawPayload，默认 false", "en": "Whether to return rawBody / rawPayload, default false" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "auto_start",
                    "description": { "zh": "若服务未运行，是否自动尝试启动，默认 true", "en": "Whether to auto-start the service when it is not running, default true" },
                    "type": "boolean",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_clear_events",
            "description": {
                "zh": "清空当前 QQ Bot 事件队列。",
                "en": "Clear the current QQ Bot event queue."
            },
            "parameters": []
        },
        {
            "name": "qqbot_test_connection",
            "description": {
                "zh": "验证 AppID/AppSecret 是否能正常获取 access token，并尝试读取机器人资料和 Gateway 地址。",
                "en": "Verify whether AppID/AppSecret can obtain an access token and attempt to read the bot profile and Gateway URL."
            },
            "parameters": [
                {
                    "name": "timeout_ms",
                    "description": { "zh": "本次请求超时毫秒数（默认 20000）", "en": "Timeout for this request in milliseconds (default 20000)" },
                    "type": "number",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_send_c2c_message",
            "description": {
                "zh": "向指定用户 openid 发送一条 C2C 文本消息，可用于主动消息，也可用于对已有 msg_id 的被动回复。",
                "en": "Send one C2C text message to a specific user openid. Can be used as a proactive message or a passive reply to an existing msg_id."
            },
            "parameters": [
                {
                    "name": "openid",
                    "description": { "zh": "目标用户 openid", "en": "Target user openid" },
                    "type": "string",
                    "required": true
                },
                {
                    "name": "content",
                    "description": { "zh": "发送的文本内容", "en": "Text content to send" },
                    "type": "string",
                    "required": true
                },
                {
                    "name": "msg_id",
                    "description": { "zh": "可选：要回复的原消息 ID", "en": "Optional source message ID to reply to" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "event_id",
                    "description": { "zh": "可选：要回复的事件 ID", "en": "Optional source event ID to reply to" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "msg_seq",
                    "description": { "zh": "回复序号，默认 1", "en": "Reply sequence number, default 1" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "msg_type",
                    "description": { "zh": "消息类型，默认 0（文本）", "en": "Message type, default 0 (text)" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "timeout_ms",
                    "description": { "zh": "本次请求超时毫秒数（默认 20000）", "en": "Timeout for this request in milliseconds (default 20000)" },
                    "type": "number",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_send_group_message",
            "description": {
                "zh": "向指定群 group_openid 发送一条群文本消息，可用于主动消息，也可用于对已有 msg_id 的被动回复。",
                "en": "Send one group text message to a specific group_openid. Can be used as a proactive message or a passive reply to an existing msg_id."
            },
            "parameters": [
                {
                    "name": "group_openid",
                    "description": { "zh": "目标群 group_openid", "en": "Target group_openid" },
                    "type": "string",
                    "required": true
                },
                {
                    "name": "content",
                    "description": { "zh": "发送的文本内容", "en": "Text content to send" },
                    "type": "string",
                    "required": true
                },
                {
                    "name": "msg_id",
                    "description": { "zh": "可选：要回复的原消息 ID", "en": "Optional source message ID to reply to" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "event_id",
                    "description": { "zh": "可选：要回复的事件 ID", "en": "Optional source event ID to reply to" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "msg_seq",
                    "description": { "zh": "回复序号，默认 1", "en": "Reply sequence number, default 1" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "msg_type",
                    "description": { "zh": "消息类型，默认 0（文本）", "en": "Message type, default 0 (text)" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "timeout_ms",
                    "description": { "zh": "本次请求超时毫秒数（默认 20000）", "en": "Timeout for this request in milliseconds (default 20000)" },
                    "type": "number",
                    "required": false
                }
            ]
        }
    ]
}
*/

import {
    ensureQQBotServiceStarted,
    qqbot_configure,
    qqbot_status,
    qqbot_service_start,
    qqbot_service_stop,
    qqbot_receive_events,
    qqbot_clear_events,
    qqbot_test_connection,
    qqbot_send_c2c_message,
    qqbot_send_group_message
} from "../shared/qqbot_runtime";

exports.ensureQQBotServiceStarted = ensureQQBotServiceStarted;
exports.qqbot_configure = qqbot_configure;
exports.qqbot_status = qqbot_status;
exports.qqbot_service_start = qqbot_service_start;
exports.qqbot_service_stop = qqbot_service_stop;
exports.qqbot_receive_events = qqbot_receive_events;
exports.qqbot_clear_events = qqbot_clear_events;
exports.qqbot_test_connection = qqbot_test_connection;
exports.qqbot_send_c2c_message = qqbot_send_c2c_message;
exports.qqbot_send_group_message = qqbot_send_group_message;
