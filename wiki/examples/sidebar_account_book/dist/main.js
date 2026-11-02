"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
const index_ui_js_1 = __importDefault(require("./ui/bookkeeping_dashboard/index.ui.js"));
const ACCOUNT_BOOK_ROUTE = "toolpkg:com.operit.sidebar_account_book:ui:bookkeeping_dashboard";
function registerToolPkg() {
    ToolPkg.registerUiRoute({
        id: "bookkeeping_dashboard",
        route: ACCOUNT_BOOK_ROUTE,
        runtime: "compose_dsl",
        screen: index_ui_js_1.default,
        params: {},
        title: {
            zh: "记账本",
            en: "Account Book",
        },
    });
    ToolPkg.registerNavigationEntry({
        id: "bookkeeping_dashboard_sidebar",
        route: ACCOUNT_BOOK_ROUTE,
        surface: "main_sidebar_plugins",
        title: {
            zh: "记账本",
            en: "Account Book",
        },
        icon: "Book",
        order: 120,
    });
    return true;
}
