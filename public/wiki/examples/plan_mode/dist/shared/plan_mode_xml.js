"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePlantodoXml = parsePlantodoXml;
exports.splitPlanBodyLines = splitPlanBodyLines;
const plan_mode_constants_js_1 = require("./plan_mode_constants.js");
function findOpeningTagEnd(raw) {
    const openTag = new RegExp(`<${plan_mode_constants_js_1.XML_TAG}\\b[^>]*>`, "i");
    const match = raw.match(openTag);
    if (!match || typeof match.index !== "number") {
        return -1;
    }
    return match.index + match[0].length;
}
function parsePlantodoXml(rawValue) {
    const raw = rawValue.replace(/\r\n/g, "\n");
    const openTagRegex = new RegExp(`<${plan_mode_constants_js_1.XML_TAG}\\b[^>]*>`, "i");
    const closeTagRegex = new RegExp(`</${plan_mode_constants_js_1.XML_TAG}>`, "i");
    const hasWrapper = openTagRegex.test(raw);
    if (!hasWrapper) {
        return {
            raw,
            body: raw.trim(),
            hasWrapper: false,
            closed: false,
        };
    }
    const bodyStart = findOpeningTagEnd(raw);
    const closeMatch = raw.match(closeTagRegex);
    const closeIndex = closeMatch && typeof closeMatch.index === "number" ? closeMatch.index : -1;
    const closed = closeIndex >= 0 && closeIndex >= bodyStart;
    const body = raw.slice(bodyStart, closed ? closeIndex : raw.length).trim();
    return {
        raw,
        body,
        hasWrapper: true,
        closed,
    };
}
function splitPlanBodyLines(content) {
    return content
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
