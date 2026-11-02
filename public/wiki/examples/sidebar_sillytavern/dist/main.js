"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
const index_ui_js_1 = __importDefault(require("./ui/sillytavern_dashboard/index.ui.js"));
const SILLYTAVERN_ROUTE = "toolpkg:com.operit.sidebar_sillytavern:ui:sillytavern_dashboard";
function registerToolPkg() {
    ToolPkg.registerUiRoute({
        id: "sillytavern_dashboard",
        route: SILLYTAVERN_ROUTE,
        runtime: "compose_dsl",
        screen: index_ui_js_1.default,
        params: {},
        keepAlive: true,
        title: {
            zh: "酒馆",
            en: "SillyTavern",
        },
    });
    ToolPkg.registerNavigationEntry({
        id: "sillytavern_dashboard_sidebar",
        route: SILLYTAVERN_ROUTE,
        surface: "main_sidebar_plugins",
        title: {
            zh: "酒馆",
            en: "SillyTavern",
        },
        icon: "Chat",
        order: 122,
    });
    return true;
}
