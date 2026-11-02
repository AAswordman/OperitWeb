import { resolvePlanModeI18n } from "./plan_mode_i18n.js";

export type SubmitPlanaskAnswersResult = {
  success: boolean;
  error?: string;
};

export const PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL = "plan_mode.submit_answers";

export async function submitPlanaskAnswers(
  message: string
): Promise<SubmitPlanaskAnswersResult> {
  const text = resolvePlanModeI18n();
  try {
    return await ToolPkg.ipc.call<string, SubmitPlanaskAnswersResult>(
      PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL,
      message
    );
  } catch (error) {
    const errorText = error instanceof Error
      ? error.message || "error"
      : (typeof error === "string" || error == null ? error || "error" : "error");
    const toastMessage = `${text.askToastAnswerSendFailedPrefix}${errorText}`;
    console.error(
      `[plan_mode_ask_execution] submitPlanaskAnswers failed: channel=${PLAN_MODE_SUBMIT_ANSWERS_IPC_CHANNEL}, answerLength=${message.length}, error=${errorText}`
    );
    await Tools.System.toast(toastMessage);
    return {
      success: false,
      error: toastMessage,
    };
  }
}
