export type AccountBookEntryType = "expense" | "income";

export interface AccountBookEntry {
  id: string;
  type: AccountBookEntryType;
  title: string;
  amount: number;
  category: string;
  date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface AccountBookSummary {
  count: number;
  income: number;
  expense: number;
  balance: number;
}

export interface AccountBookEntryInput {
  id?: string;
  type?: unknown;
  title?: unknown;
  amount?: unknown;
  category?: unknown;
  date?: unknown;
  note?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

export const ACCOUNT_BOOK_DATA_DIR = "/root/sidebar_account_book_data";
export const ACCOUNT_BOOK_DATA_FILE = `${ACCOUNT_BOOK_DATA_DIR}/entries.json`;

function nowIso(): string {
  return new Date().toISOString();
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeType(value: unknown): AccountBookEntryType {
  return String(value || "").trim().toLowerCase() === "income"
    ? "income"
    : "expense";
}

export function normalizeDate(value: unknown): string {
  const text = String(value || "").trim();
  return text || nowIso().slice(0, 10);
}

export function normalizeAmount(value: unknown): number {
  const amount = roundCurrency(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }
  return amount;
}

async function ensureDataFile(): Promise<void> {
  await Tools.Files.mkdir(ACCOUNT_BOOK_DATA_DIR, true, "linux");
  const exists = await Tools.Files.exists(ACCOUNT_BOOK_DATA_FILE, "linux");
  if (!exists?.exists) {
    await Tools.Files.write(ACCOUNT_BOOK_DATA_FILE, "[]", false, "linux");
  }
}

export function sanitizeEntry(raw: unknown): AccountBookEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
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
  } catch (_error) {
    return null;
  }
}

function sortEntries(entries: AccountBookEntry[]): AccountBookEntry[] {
  entries.sort((left, right) => {
    const dateCompare = String(right.date).localeCompare(String(left.date));
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return String(right.updated_at).localeCompare(String(left.updated_at));
  });
  return entries;
}

export async function loadEntries(): Promise<AccountBookEntry[]> {
  await ensureDataFile();
  const result = await Tools.Files.read({
    path: ACCOUNT_BOOK_DATA_FILE,
    environment: "linux",
  });
  const content = String(result?.content || "[]").trim() || "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    parsed = [];
  }
  const entries = Array.isArray(parsed)
    ? parsed.map((item) => sanitizeEntry(item)).filter(Boolean) as AccountBookEntry[]
    : [];
  return sortEntries(entries);
}

export async function saveEntries(entries: AccountBookEntry[]): Promise<void> {
  await ensureDataFile();
  await Tools.Files.write(
    ACCOUNT_BOOK_DATA_FILE,
    JSON.stringify(sortEntries([...entries]), null, 2),
    false,
    "linux"
  );
}

export function summarizeEntries(entries: AccountBookEntry[]): AccountBookSummary {
  const income = roundCurrency(
    entries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0)
  );
  const expense = roundCurrency(
    entries
      .filter((entry) => entry.type !== "income")
      .reduce((sum, entry) => sum + entry.amount, 0)
  );
  return {
    count: entries.length,
    income,
    expense,
    balance: roundCurrency(income - expense),
  };
}

export function buildEntry(input: AccountBookEntryInput): AccountBookEntry {
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

export function updateEntry(
  current: AccountBookEntry,
  patch: Record<string, unknown>
): AccountBookEntry {
  const next: AccountBookEntry = {
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
