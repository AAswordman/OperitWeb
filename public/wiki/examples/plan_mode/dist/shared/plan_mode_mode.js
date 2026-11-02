"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlanModeEnabledForChat = isPlanModeEnabledForChat;
exports.enablePlanModeForChat = enablePlanModeForChat;
exports.disablePlanMode = disablePlanMode;
const plan_mode_state_js_1 = require("./plan_mode_state.js");
function isPlanModeEnabledForChat(chatId) {
    return (0, plan_mode_state_js_1.isPlanModeEnabledInState)(chatId);
}
async function enablePlanModeForChat(chatId) {
    await (0, plan_mode_state_js_1.setPlanModeEnabledForChatAsync)(chatId, true);
}
async function disablePlanMode(chatId) {
    await (0, plan_mode_state_js_1.setPlanModeEnabledForChatAsync)(chatId, false);
}
