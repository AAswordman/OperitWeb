"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendPrompt = appendPrompt;
exports.buildPlanningModePrompt = buildPlanningModePrompt;
exports.buildExistingPlanPrompt = buildExistingPlanPrompt;
const plan_mode_constants_js_1 = require("./plan_mode_constants.js");
const plan_mode_i18n_js_1 = require("./plan_mode_i18n.js");
function appendPrompt(basePrompt, extraPrompt) {
    const base = basePrompt.trim();
    const extra = extraPrompt.trim();
    if (!extra) {
        return base;
    }
    return base ? `${base}\n\n${extra}` : extra;
}
function buildPlanningModePrompt(useEnglish) {
    return (0, plan_mode_i18n_js_1.resolvePlanModeI18n)(useEnglish).promptPlanningMode;
}
function buildExistingPlanPrompt(useEnglish) {
    const text = (0, plan_mode_i18n_js_1.resolvePlanModeI18n)(useEnglish);
    const getPlanTool = `${plan_mode_constants_js_1.SUBPACKAGE_ID}:${plan_mode_constants_js_1.GET_PLAN_TOOL_NAME}`;
    const completePlanTool = `${plan_mode_constants_js_1.SUBPACKAGE_ID}:${plan_mode_constants_js_1.COMPLETE_PLAN_TOOL_NAME}`;
    const lines = [text.promptExistingPlanPrefix];
    if (useEnglish) {
        lines.push(`- Call \`${getPlanTool}\` before you start working.`);
        lines.push("- Base your implementation on the returned plan content.");
        lines.push(`- When and only when every planned item is truly complete, call \`${completePlanTool}\` exactly once.`);
    }
    else {
        lines.push(`- 在开始工作前，先调用 \`${getPlanTool}\`。`);
        lines.push("- 根据返回的计划内容执行实施。");
        lines.push(`- 只有当所有计划项都真正完成后，才调用一次 \`${completePlanTool}\`。`);
    }
    return lines.join("\n");
}
