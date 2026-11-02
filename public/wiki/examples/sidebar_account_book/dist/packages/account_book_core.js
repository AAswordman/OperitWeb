"use strict";
/* METADATA
{
  "name": "account_book_core",
  "display_name": {
    "zh": "记账核心",
    "en": "Account Book Core"
  },
  "description": {
    "zh": "直接对记账数据执行查询、创建、更新、删除和汇总。",
    "en": "Query, create, update, delete, and summarize account-book entries directly."
  },
  "enabled_by_default": true,
  "category": "Data",
  "tools": [
    {
      "name": "list_entries",
      "description": {
        "zh": "列出全部账目并返回汇总。",
        "en": "List all entries and return the summary."
      },
      "parameters": []
    },
    {
      "name": "get_entry",
      "description": {
        "zh": "按 id 获取单条账目。",
        "en": "Get a single entry by id."
      },
      "parameters": [
        {
          "name": "id",
          "description": {
            "zh": "账目 id。",
            "en": "Entry id."
          },
          "type": "string",
          "required": true
        }
      ]
    },
    {
      "name": "create_entry",
      "description": {
        "zh": "创建新账目。",
        "en": "Create a new entry."
      },
      "parameters": [
        { "name": "type", "description": { "zh": "账目类型，如 income 或 expense。", "en": "Entry type, such as income or expense." }, "type": "string", "required": false },
        { "name": "title", "description": { "zh": "账目标题。", "en": "Entry title." }, "type": "string", "required": true },
        { "name": "amount", "description": { "zh": "金额。", "en": "Amount." }, "type": "number", "required": true },
        { "name": "category", "description": { "zh": "分类。", "en": "Category." }, "type": "string", "required": false },
        { "name": "date", "description": { "zh": "日期，建议使用 ISO 字符串。", "en": "Date, preferably as an ISO string." }, "type": "string", "required": false },
        { "name": "note", "description": { "zh": "备注。", "en": "Note." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "update_entry",
      "description": {
        "zh": "更新已有账目。",
        "en": "Update an existing entry."
      },
      "parameters": [
        { "name": "id", "description": { "zh": "要更新的账目 id。", "en": "Entry id to update." }, "type": "string", "required": true },
        { "name": "type", "description": { "zh": "新的账目类型。", "en": "New entry type." }, "type": "string", "required": false },
        { "name": "title", "description": { "zh": "新的账目标题。", "en": "New entry title." }, "type": "string", "required": false },
        { "name": "amount", "description": { "zh": "新的金额。", "en": "New amount." }, "type": "number", "required": false },
        { "name": "category", "description": { "zh": "新的分类。", "en": "New category." }, "type": "string", "required": false },
        { "name": "date", "description": { "zh": "新的日期。", "en": "New date." }, "type": "string", "required": false },
        { "name": "note", "description": { "zh": "新的备注。", "en": "New note." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "delete_entry",
      "description": {
        "zh": "删除账目。",
        "en": "Delete an entry."
      },
      "parameters": [
        {
          "name": "id",
          "description": {
            "zh": "账目 id。",
            "en": "Entry id."
          },
          "type": "string",
          "required": true
        }
      ]
    },
    {
      "name": "get_summary",
      "description": {
        "zh": "获取当前账目汇总。",
        "en": "Get the current summary."
      },
      "parameters": []
    }
  ]
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
const account_book_storage_js_1 = require("../shared/account_book_storage.js");
function requireId(raw) {
    const id = String(raw || "").trim();
    if (!id) {
        throw new Error("Entry id is required.");
    }
    return id;
}
async function listEntries() {
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    return {
        success: true,
        entries,
        summary: (0, account_book_storage_js_1.summarizeEntries)(entries),
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
async function getEntry(params) {
    const id = requireId(params?.id);
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    const entry = entries.find((item) => item.id === id) || null;
    if (!entry) {
        return {
            success: false,
            message: `Entry not found: ${id}`,
            entry: null,
            dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
        };
    }
    return {
        success: true,
        entry,
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
async function createEntry(params) {
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    const entry = (0, account_book_storage_js_1.buildEntry)(params || {});
    entries.unshift(entry);
    await (0, account_book_storage_js_1.saveEntries)(entries);
    const nextEntries = await (0, account_book_storage_js_1.loadEntries)();
    return {
        success: true,
        entry,
        entries: nextEntries,
        summary: (0, account_book_storage_js_1.summarizeEntries)(nextEntries),
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
async function updateEntryTool(params) {
    const id = requireId(params?.id);
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    const index = entries.findIndex((item) => item.id === id);
    if (index < 0) {
        return {
            success: false,
            message: `Entry not found: ${id}`,
            dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
        };
    }
    const nextEntry = (0, account_book_storage_js_1.updateEntry)(entries[index], params || {});
    const sanitized = (0, account_book_storage_js_1.sanitizeEntry)(nextEntry);
    if (!sanitized) {
        throw new Error("Updated entry is invalid.");
    }
    entries[index] = sanitized;
    await (0, account_book_storage_js_1.saveEntries)(entries);
    const nextEntries = await (0, account_book_storage_js_1.loadEntries)();
    return {
        success: true,
        entry: nextEntries.find((item) => item.id === id) || sanitized,
        entries: nextEntries,
        summary: (0, account_book_storage_js_1.summarizeEntries)(nextEntries),
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
async function deleteEntry(params) {
    const id = requireId(params?.id);
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    const nextEntries = entries.filter((item) => item.id !== id);
    if (nextEntries.length === entries.length) {
        return {
            success: false,
            message: `Entry not found: ${id}`,
            dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
        };
    }
    await (0, account_book_storage_js_1.saveEntries)(nextEntries);
    return {
        success: true,
        deletedId: id,
        entries: nextEntries,
        summary: (0, account_book_storage_js_1.summarizeEntries)(nextEntries),
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
async function getSummary() {
    const entries = await (0, account_book_storage_js_1.loadEntries)();
    return {
        success: true,
        summary: (0, account_book_storage_js_1.summarizeEntries)(entries),
        dataFile: account_book_storage_js_1.ACCOUNT_BOOK_DATA_FILE,
    };
}
exports.list_entries = listEntries;
exports.get_entry = getEntry;
exports.create_entry = createEntry;
exports.update_entry = updateEntryTool;
exports.delete_entry = deleteEntry;
exports.get_summary = getSummary;
