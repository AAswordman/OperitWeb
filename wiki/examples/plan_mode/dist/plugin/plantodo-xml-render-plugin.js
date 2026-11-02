"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPlantodoXmlRender = onPlantodoXmlRender;
const index_ui_js_1 = __importDefault(require("../ui/plantodo/index.ui.js"));
const plan_mode_constants_js_1 = require("../shared/plan_mode_constants.js");
function onPlantodoXmlRender(event) {
    const payload = event.eventPayload;
    const tagName = payload.tagName;
    if (tagName !== plan_mode_constants_js_1.XML_TAG) {
        return { handled: false };
    }
    const xmlContent = payload.xmlContent;
    if (xmlContent === undefined) {
        return { handled: false };
    }
    return {
        handled: true,
        composeDsl: {
            screen: index_ui_js_1.default,
            state: {
                xmlContent,
            },
            memo: {},
        },
    };
}
