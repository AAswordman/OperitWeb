"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
const index_ui_js_1 = __importDefault(require("./ui/model_sites_list/index.ui.js"));
const index_ui_js_2 = __importDefault(require("./ui/model_sites_viewer/index.ui.js"));
const site_catalog_js_1 = require("./shared/site_catalog.js");
function registerToolPkg() {
    ToolPkg.registerUiRoute({
        id: "model_sites_list",
        route: site_catalog_js_1.MODEL_SITES_LIST_ROUTE,
        runtime: "compose_dsl",
        screen: index_ui_js_1.default,
        params: {},
        title: {
            zh: "网站聚合",
            en: "Model Sites",
        },
    });
    ToolPkg.registerUiRoute({
        id: "model_sites_viewer",
        route: site_catalog_js_1.MODEL_SITES_VIEWER_ROUTE,
        runtime: "compose_dsl",
        screen: index_ui_js_2.default,
        params: {},
        title: {
            zh: "站点浏览",
            en: "Site Viewer",
        },
    });
    ToolPkg.registerNavigationEntry({
        id: "model_sites_sidebar",
        route: site_catalog_js_1.MODEL_SITES_LIST_ROUTE,
        surface: "main_sidebar_plugins",
        title: {
            zh: "网站聚合",
            en: "Model Sites",
        },
        icon: "Language",
        order: 136,
    });
    return true;
}
