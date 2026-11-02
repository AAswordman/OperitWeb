"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCOUNT_BOOK_DATA_FILE = exports.ACCOUNT_BOOK_DATA_DIR = void 0;
exports.normalizeType = normalizeType;
exports.normalizeDate = normalizeDate;
exports.normalizeAmount = normalizeAmount;
exports.sanitizeEntry = sanitizeEntry;
exports.loadEntries = loadEntries;
exports.saveEntries = saveEntries;
exports.summarizeEntries = summarizeEntries;
exports.buildEntry = buildEntry;
exports.updateEntry = updateEntry;
exports.ACCOUNT_BOOK_DATA_DIR = "/root/sidebar_account_book_data";
exports.ACCOUNT_BOOK_DATA_FILE = `${exports.ACCOUNT_BOOK_DATA_DIR}/entries.json`;
function nowIso() {
    return new Date().toISOString();
}
function roundCurrency(value) {
    return Math.round(value * 100) / 100;
}
function normalizeType(value) {
    return String(value || "").trim().toLowerCase() === "income"
        ? "income"
        : "expense";
}
function normalizeDate(value) {
    const text = String(value || "").trim();
    return text || nowIso().slice(0, 10);
}
function normalizeAmount(value) {
    const amount = roundCurrency(Number(value || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than 0.");
    }
    return amount;
}
async function ensureDataFile() {
    await Tools.Files.mkdir(exports.ACCOUNT_BOOK_DATA_DIR, true, "linux");
    const exists = await Tools.Files.exists(exports.ACCOUNT_BOOK_DATA_FILE, "linux");
    if (!exists?.exists) {
        await Tools.Files.write(exports.ACCOUNT_BOOK_DATA_FILE, "[]", false, "linux");
    }
}
function sanitizeEntry(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const item = raw;
    const id = String(item.id || "").trim();
    const title = String(item.title || "").trim();
    if (!id || !title) {
        return null;
    }
    try {
        return {
            id,
            type: normalizeType(item.type),
            title,
            amount: normalizeAmount(item.amount),
            category: String(item.category || "").trim(),
            date: normalizeDate(item.date),
            note: String(item.note || "").trim(),
            created_at: String(item.created_at || nowIso()),
            updated_at: String(item.updated_at || nowIso()),
        };
    }
    catch (_error) {
        return null;
    }
}
function sortEntries(entries) {
    entries.sort((left, right) => {
        const dateCompare = String(right.date).localeCompare(String(left.date));
        if (dateCompare !== 0) {
            return dateCompare;
        }
        return String(right.updated_at).localeCompare(String(left.updated_at));
    });
    return entries;
}
async function loadEntries() {
    await ensureDataFile();
    const result = await Tools.Files.read({
        path: exports.ACCOUNT_BOOK_DATA_FILE,
        environment: "linux",
    });
    const content = String(result?.content || "[]").trim() || "[]";
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (_error) {
        parsed = [];
    }
    const entries = Array.isArray(parsed)
        ? parsed.map((item) => sanitizeEntry(item)).filter(Boolean)
        : [];
    return sortEntries(entries);
}
async function saveEntries(entries) {
    await ensureDataFile();
    await Tools.Files.write(exports.ACCOUNT_BOOK_DATA_FILE, JSON.stringify(sortEntries([...entries]), null, 2), false, "linux");
}
function summarizeEntries(entries) {
    const income = roundCurrency(entries
        .filter((entry) => entry.type === "income")
        .reduce((sum, entry) => sum + entry.amount, 0));
    const expense = roundCurrency(entries
        .filter((entry) => entry.type !== "income")
        .reduce((sum, entry) => sum + entry.amount, 0));
    return {
        count: entries.length,
        income,
        expense,
        balance: roundCurrency(income - expense),
    };
}
function buildEntry(input) {
    const title = String(input.title || "").trim();
    if (!title) {
        throw new Error("Title is required.");
    }
    const timestamp = nowIso();
    return {
        id: String(input.id || `acct_${Date.now()}`),
        type: normalizeType(input.type),
        title,
        amount: normalizeAmount(input.amount),
        category: String(input.category || "").trim(),
        date: normalizeDate(input.date),
        note: String(input.note || "").trim(),
        created_at: String(input.created_at || timestamp),
        updated_at: timestamp,
    };
}
function updateEntry(current, patch) {
    const next = {
        ...current,
        type: Object.prototype.hasOwnProperty.call(patch, "type")
            ? normalizeType(patch.type)
            : current.type,
        title: Object.prototype.hasOwnProperty.call(patch, "title")
            ? String(patch.title || "").trim()
            : current.title,
        amount: Object.prototype.hasOwnProperty.call(patch, "amount")
            ? normalizeAmount(patch.amount)
            : current.amount,
        category: Object.prototype.hasOwnProperty.call(patch, "category")
            ? String(patch.category || "").trim()
            : current.category,
        date: Object.prototype.hasOwnProperty.call(patch, "date")
            ? normalizeDate(patch.date)
            : current.date,
        note: Object.prototype.hasOwnProperty.call(patch, "note")
            ? String(patch.note || "").trim()
            : current.note,
        updated_at: nowIso(),
    };
    if (!next.title) {
        throw new Error("Title cannot be empty.");
    }
    return next;
}
