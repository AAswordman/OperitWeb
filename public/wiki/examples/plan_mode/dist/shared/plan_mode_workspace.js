"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPlanModeDebug = logPlanModeDebug;
exports.resolveChatWorkspace = resolveChatWorkspace;
exports.buildPlanFilePath = buildPlanFilePath;
const plan_mode_constants_js_1 = require("./plan_mode_constants.js");
const plan_mode_state_js_1 = require("./plan_mode_state.js");
const LOG_TAG = "[plan_mode_workspace]";
function formatLogPayload(payload) {
    if (!payload) {
        return "";
    }
    return ` ${JSON.stringify(payload)}`;
}
function logPlanModeDebug(message, payload) {
    console.log(`${LOG_TAG} ${message}${formatLogPayload(payload)}`);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
}
function hasValidWorkspaceBinding(view) {
    return isNonEmptyString(view.workspacePath);
}
function buildWorkspaceBinding(view) {
    return {
        chatId: view.chatId,
        workspacePath: view.workspacePath,
        workspaceEnv: isNonEmptyString(view.workspaceEnv) ? view.workspaceEnv : undefined,
        runtime: view.runtime,
        viewId: view.viewId,
    };
}
function resolveChatWorkspace(chatId, runtime) {
    logPlanModeDebug("resolveChatWorkspace.input", { chatId, runtime });
    if (runtime) {
        const runtimeView = (0, plan_mode_state_js_1.readActiveChatViewForRuntime)(runtime);
        if (runtimeView && runtimeView.chatId === chatId && hasValidWorkspaceBinding(runtimeView)) {
            logPlanModeDebug("resolveChatWorkspace.runtime", {
                chatId,
                runtime: runtimeView.runtime,
                viewId: runtimeView.viewId,
                workspacePath: runtimeView.workspacePath,
                workspaceEnv: runtimeView.workspaceEnv,
            });
            return buildWorkspaceBinding(runtimeView);
        }
    }
    const trackedView = (0, plan_mode_state_js_1.readTrackedChatViewByChatId)(chatId);
    if (!trackedView || !hasValidWorkspaceBinding(trackedView)) {
        logPlanModeDebug("resolveChatWorkspace.unbound", {
            chatId,
            runtime,
            hasTrackedView: !!trackedView,
            workspacePath: trackedView?.workspacePath,
            workspaceEnv: trackedView?.workspaceEnv,
        });
        return null;
    }
    logPlanModeDebug("resolveChatWorkspace.tracked", {
        chatId,
        runtime: trackedView.runtime,
        viewId: trackedView.viewId,
        workspacePath: trackedView.workspacePath,
        workspaceEnv: trackedView.workspaceEnv,
    });
    return buildWorkspaceBinding(trackedView);
}
function buildPlanFilePath(workspacePath) {
    const normalizedWorkspacePath = workspacePath.endsWith("/")
        ? workspacePath.slice(0, -1)
        : workspacePath;
    return `${normalizedWorkspacePath}/${plan_mode_constants_js_1.PLAN_FILE_DIRECTORY_NAME}/${plan_mode_constants_js_1.PLAN_FILE_NAME}`;
}
