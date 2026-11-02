"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
exports.openBingFromSidebar = openBingFromSidebar;
const BING_URL = "https://www.bing.com";
function registerToolPkg() {
    ToolPkg.registerNavigationEntry({
        id: "open_bing_with_action",
        surface: "main_sidebar_plugins",
        title: {
            zh: "打开 Bing",
            en: "Open Bing",
        },
        icon: "Language",
        order: 100,
        action: openBingFromSidebar,
    });
    return true;
}
async function openBingFromSidebar(event) {
    await toolCall("browser_navigate", {
        url: BING_URL,
    });
    return {
        ok: true,
        openedUrl: BING_URL,
        sourceEntryId: String(event.eventPayload.entryId ?? ""),
    };
}
