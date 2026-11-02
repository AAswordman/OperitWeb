"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePlanaskXml = parsePlanaskXml;
exports.buildPlanaskAnswerMessage = buildPlanaskAnswerMessage;
const plan_mode_constants_js_1 = require("./plan_mode_constants.js");
const MAX_QUESTIONS = 3;
function decodeXmlText(value) {
    return String(value || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}
function findOpeningTagEnd(raw) {
    const openTag = new RegExp(`<${plan_mode_constants_js_1.PLANASK_XML_TAG}\\b[^>]*>`, "i");
    const match = raw.match(openTag);
    if (!match || typeof match.index !== "number") {
        return -1;
    }
    return match.index + match[0].length;
}
function parseTagAttributes(fragment) {
    const attrs = {};
    const regex = /([A-Za-z_][A-Za-z0-9_\-]*)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = regex.exec(String(fragment || ""))) !== null) {
        attrs[match[1]] = decodeXmlText(match[2]);
    }
    return attrs;
}
function extractFirstTagText(xml, tagName) {
    const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
    const match = regex.exec(String(xml || ""));
    return match ? decodeXmlText(match[1]).trim() : "";
}
function parseOptions(questionXml) {
    const options = [];
    const regex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let match;
    let index = 0;
    while ((match = regex.exec(String(questionXml || ""))) !== null) {
        const attrs = parseTagAttributes(match[1]);
        const label = decodeXmlText(match[2]).trim();
        if (!label) {
            continue;
        }
        const id = attrs.id && attrs.id.trim() ? attrs.id.trim() : `option_${index + 1}`;
        options.push({ id, label });
        index += 1;
    }
    return options;
}
function parseQuestions(body) {
    const questions = [];
    const regex = /<question\b([^>]*)>([\s\S]*?)<\/question>/gi;
    let match;
    let index = 0;
    while ((match = regex.exec(String(body || ""))) !== null && questions.length < MAX_QUESTIONS) {
        const attrs = parseTagAttributes(match[1]);
        const questionXml = match[2];
        const title = extractFirstTagText(questionXml, "title");
        const options = parseOptions(questionXml);
        if (!title || options.length < 2) {
            index += 1;
            continue;
        }
        const id = attrs.id && attrs.id.trim() ? attrs.id.trim() : `q${index + 1}`;
        questions.push({
            id,
            title,
            options,
        });
        index += 1;
    }
    return questions;
}
function parsePlanaskXml(rawValue) {
    const raw = String(rawValue || "").replace(/\r\n/g, "\n");
    const openTagRegex = new RegExp(`<${plan_mode_constants_js_1.PLANASK_XML_TAG}\\b[^>]*>`, "i");
    const closeTagRegex = new RegExp(`</${plan_mode_constants_js_1.PLANASK_XML_TAG}>`, "i");
    const hasWrapper = openTagRegex.test(raw);
    if (!hasWrapper) {
        return {
            raw,
            title: "",
            description: "",
            questions: [],
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
        title: extractFirstTagText(body, "title"),
        description: extractFirstTagText(body, "description"),
        questions: parseQuestions(body),
        hasWrapper: true,
        closed,
    };
}
function buildPlanaskAnswerMessage(parsed, answerTexts) {
    const selectedQuestions = parsed.questions
        .map((question) => {
        const answerText = String(answerTexts[question.id] || "").trim();
        if (!answerText) {
            return "";
        }
        return `- ${question.title}：${answerText}`;
    })
        .filter((item) => item !== "");
    const lines = ["计划确认答复："];
    if (parsed.title) {
        lines.push(`主题：${parsed.title}`);
    }
    selectedQuestions.forEach((item) => lines.push(item));
    return lines.join("\n");
}
