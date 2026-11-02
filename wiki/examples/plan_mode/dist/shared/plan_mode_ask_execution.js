"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL = void 0;
exports.submitPlanaskAnswers = submitPlanaskAnswers;
const plan_mode_i18n_js_1 = require("./plan_mode_i18n.js");
exports.PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL = "plan_mode.submit_answers";
async function submitPlanaskAnswers(message) {
    const text = (0, plan_mode_i18n_js_1.resolvePlanModeI18n)();
    try {
        return await ToolPkg.ipc.call(exports.PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL, message);
    }
    catch (error) {
        const errorText = error instanceof Error
            ? error.message || "error"
            : (typeof error === "string" || error == null ? error || "error" : "error");
        const toastMessage = `${text.askToastAnswerSendFailedPrefix}${errorText}`;
        console.error(`[plan_mode_ask_execution] submitPlanaskAnswers failed: channel=${exports.PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL}, answerLength=${message.length}, error=${errorText}`);
        await Tools.System.toast(toastMessage);
        return {
            success: false,
            error: toastMessage,
        };
    }
}
