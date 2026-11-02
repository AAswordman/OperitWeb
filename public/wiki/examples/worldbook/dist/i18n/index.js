"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWorldBookI18n = resolveWorldBookI18n;
const en_US_1 = require("./en-US");
const zh_CN_1 = require("./zh-CN");
const DEFAULT_LOCALE = "zh-CN";
const WORLDBOOK_I18N_MAP = {
    "zh-CN": zh_CN_1.WORLDBOOK_I18N_ZH_CN,
    "en-US": en_US_1.WORLDBOOK_I18N_EN_US
};
function normalizeLocale(locale) {
    const value = (locale || "").trim();
    if (!value) {
        return DEFAULT_LOCALE;
    }
    const lower = value.toLowerCase();
    if (lower.startsWith("zh")) {
        return "zh-CN";
    }
    if (lower.startsWith("en")) {
        return "en-US";
    }
    return value;
}
function resolveWorldBookI18n(locale) {
    const normalized = normalizeLocale(locale);
    return WORLDBOOK_I18N_MAP[normalized] || WORLDBOOK_I18N_MAP[DEFAULT_LOCALE];
}
