import {
  COMPLETE_PLAN_TOOL_NAME,
  GET_PLAN_TOOL_NAME,
  SUBPACKAGE_ID,
} from "./plan_mode_constants.js";
import { resolvePlanModeI18n } from "./plan_mode_i18n.js";

export function appendPrompt(basePrompt: string, extraPrompt: string): string {
  const base = basePrompt.trim();
  const extra = extraPrompt.trim();
  if (!extra) {
    return base;
  }
  return base ? `${base}\n\n${extra}` : extra;
}

export function buildPlanningModePrompt(useEnglish?: boolean): string {
  return resolvePlanModeI18n(useEnglish).promptPlanningMode;
}

export function buildExistingPlanPrompt(useEnglish?: boolean): string {
  const text = resolvePlanModeI18n(useEnglish);
  const getPlanTool = `${SUBPACKAGE_ID}:${GET_PLAN_TOOL_NAME}`;
  const completePlanTool = `${SUBPACKAGE_ID}:${COMPLETE_PLAN_TOOL_NAME}`;
  const lines = [text.promptExistingPlanPrefix];
  if (useEnglish) {
    lines.push(`- Call \`${getPlanTool}\` before you start working.`);
    lines.push("- Base your implementation on the returned plan content.");
    lines.push(
      `- When and only when every planned item is truly complete, call \`${completePlanTool}\` exactly once.`
    );
  } else {
    lines.push(`- 在开始工作前，先调用 \`${getPlanTool}\`。`);
    lines.push("- 根据返回的计划内容执行实施。");
    lines.push(
      `- 只有当所有计划项都真正完成后，才调用一次 \`${completePlanTool}\`。`
    );
  }
  return lines.join("\n");
}
