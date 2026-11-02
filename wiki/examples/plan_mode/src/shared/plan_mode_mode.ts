import { isPlanModeEnabledInState, setPlanModeEnabledForChatAsync } from "./plan_mode_state.js";

export function isPlanModeEnabledForChat(chatId: string): boolean {
  return isPlanModeEnabledInState(chatId);
}

export async function enablePlanModeForChat(chatId: string): Promise<void> {
  await setPlanModeEnabledForChatAsync(chatId, true);
}

export async function disablePlanMode(chatId: string): Promise<void> {
  await setPlanModeEnabledForChatAsync(chatId, false);
}
