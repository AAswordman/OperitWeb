"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
const index_ui_js_1 = __importDefault(require("./ui/opencode_dashboard/index.ui.js"));
const OPENCODE_ROUTE = "toolpkg:com.operit.sidebar_opencode:ui:opencode_dashboard";
function registerToolPkg() {
    ToolPkg.registerUiRoute({
        id: "opencode_dashboard",
        route: OPENCODE_ROUTE,
        runtime: "compose_dsl",
        screen: index_ui_js_1.default,
        params: {},
        keepAlive: true,
        title: {
            zh: "OpenCode",
            en: "OpenCode",
        },
    });
    ToolPkg.registerNavigationEntry({
        id: "opencode_dashboard_sidebar",
        route: OPENCODE_ROUTE,
        surface: "main_sidebar_plugins",
        title: {
            zh: "OpenCode",
            en: "OpenCode",
        },
        icon: "Code",
        order: 130,
    });
    return true;
}
