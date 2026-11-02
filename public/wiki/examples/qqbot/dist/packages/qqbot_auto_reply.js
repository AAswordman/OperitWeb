"use strict";
/* METADATA
{
    "name": "qqbot_auto_reply",
    "display_name": {
        "zh": "QQ Bot 自动回复",
        "en": "QQ Bot Auto Reply"
    },
    "description": {
        "zh": "把 QQ Bot 收到的消息自动桥接到 Operit 聊天能力，再把 AI 回复自动发回 QQ。",
        "en": "Automatically bridge inbound QQ Bot messages into Operit's chat capability, then send AI replies back to QQ."
    },
    "enabledByDefault": true,
    "category": "Communication",
    "tools": [
        {
            "name": "qqbot_auto_reply_configure",
            "description": {
                "zh": "配置 QQ Bot 自动回复桥。可启用/停用自动回复、设置轮询间隔、AI 超时、启用场景、会话分组、角色卡和桥接指令。",
                "en": "Configure the QQ Bot auto-reply bridge. Supports enabling/disabling auto reply, polling interval, AI timeout, enabled scenes, chat group, character card, and bridge instruction."
            },
            "parameters": [
                {
                    "name": "enabled",
                    "description": { "zh": "是否启用自动回复桥", "en": "Whether to enable the auto-reply bridge" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "poll_interval_ms",
                    "description": { "zh": "轮询 QQ 消息队列的间隔毫秒数，默认 3000", "en": "Polling interval for the QQ message queue in milliseconds, default 3000" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "ai_timeout_ms",
                    "description": { "zh": "等待 Operit AI 回复的超时毫秒数，默认 180000", "en": "Timeout in milliseconds while waiting for the Operit AI reply, default 180000" },
                    "type": "number",
                    "required": false
                },
                {
                    "name": "c2c_enabled",
                    "description": { "zh": "是否处理私聊 C2C 消息，默认 true", "en": "Whether to handle C2C private messages, default true" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "group_enabled",
                    "description": { "zh": "是否处理群消息，默认 true", "en": "Whether to handle group messages, default true" },
                    "type": "boolean",
                    "required": false
                },
                {
                    "name": "chat_group",
                    "description": { "zh": "为自动创建的 Operit 对话指定分组名，默认 QQ Bot", "en": "Group name for auto-created Operit chats, default QQ Bot" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "character_card_id",
                    "description": { "zh": "可选：绑定到自动回复会话的角色卡 ID", "en": "Optional character card ID bound to auto-reply chats" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "assistant_instruction",
                    "description": { "zh": "每次桥接到 Operit 时附带的回复指令", "en": "Instruction prepended when bridging each message into Operit" },
                    "type": "string",
                    "required": false
                },
                {
                    "name": "start_now",
                    "description": { "zh": "保存配置后是否立即启动自动回复循环", "en": "Whether to start the auto-reply loop immediately after saving" },
                    "type": "boolean",
                    "required": false
                }
            ]
        },
        {
            "name": "qqbot_auto_reply_status",
            "description": {
                "zh": "查看 QQ Bot 自动回复桥的当前配置、运行状态、联系人会话绑定和最近处理记录摘要。",
                "en": "Read the current config, runtime status, conversation bindings, and recent processing summary of the QQ Bot auto-reply bridge."
            },
            "parameters": []
        },
        {
            "name": "qqbot_auto_reply_start",
            "description": {
                "zh": "启动 QQ Bot 自动回复循环。它会轮询消息队列，自动调用 Operit AI，再把回复发回 QQ。",
                "en": "Start the QQ Bot auto-reply loop. It polls the message queue, invokes Operit's AI, and sends the reply back to QQ."
            },
            "parameters": []
        },
        {
            "name": "qqbot_auto_reply_stop",
            "description": {
                "zh": "停止 QQ Bot 自动回复循环。",
                "en": "Stop the QQ Bot auto-reply loop."
            },
            "parameters": []
        },
        {
            "name": "qqbot_auto_reply_run_once",
            "description": {
                "zh": "立即手动处理一次当前 QQ 消息队列，适合调试自动回复链路。",
                "en": "Process the current QQ message queue once immediately, useful for debugging the auto-reply pipeline."
            },
            "parameters": []
        }
    ]
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
const qqbot_auto_reply_1 = require("../shared/qqbot_auto_reply");
exports.ensureQQBotAutoReplyLoopStarted = qqbot_auto_reply_1.ensureQQBotAutoReplyLoopStarted;
exports.qqbot_auto_reply_configure = qqbot_auto_reply_1.qqbot_auto_reply_configure;
exports.qqbot_auto_reply_status = qqbot_auto_reply_1.qqbot_auto_reply_status;
exports.qqbot_auto_reply_start = qqbot_auto_reply_1.qqbot_auto_reply_start;
exports.qqbot_auto_reply_stop = qqbot_auto_reply_1.qqbot_auto_reply_stop;
exports.qqbot_auto_reply_run_once = qqbot_auto_reply_1.qqbot_auto_reply_run_once;
