const express = require("express");
const fs = require("fs");
const path = require("path");

function nowIso() {
  return new Date().toISOString();
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase() === "income" ? "income" : "expense";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  return text || nowIso().slice(0, 10);
}

function normalizeAmount(value) {
  const amount = Math.round(Number(value || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }
  return amount;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadEntries(dataFile) {
  ensureParent(dataFile);
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, "[]", "utf8");
  }
  let parsed = [];
  try {
    parsed = JSON.parse(fs.readFileSync(dataFile, "utf8") || "[]");
  } catch (_error) {
    parsed = [];
  }
  if (!Array.isArray(parsed)) {
    parsed = [];
  }
  const entries = parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => {
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
          amount: normalizeAmount(item.amount || 0),
          category: String(item.category || "").trim(),
          date: normalizeDate(item.date),
          note: String(item.note || "").trim(),
          created_at: String(item.created_at || nowIso()),
          updated_at: String(item.updated_at || nowIso()),
        };
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
  entries.sort((left, right) => {
    const dateCompare = String(right.date).localeCompare(String(left.date));
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return String(right.updated_at).localeCompare(String(left.updated_at));
  });
  return entries;
}

function saveEntries(dataFile, entries) {
  ensureParent(dataFile);
  fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2), "utf8");
}

function summarize(entries) {
  const income = Math.round(entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  const expense = Math.round(entries.filter((entry) => entry.type !== "income").reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  return {
    count: entries.length,
    income,
    expense,
    balance: Math.round((income - expense) * 100) / 100,
  };
}

function makeEntry(payload) {
  const title = String(payload.title || "").trim();
  if (!title) {
    throw new Error("Title is required.");
  }
  const now = nowIso();
  return {
    id: payload.id || `acct_${Date.now()}`,
    type: normalizeType(payload.type),
    title,
    amount: normalizeAmount(payload.amount || 0),
    category: String(payload.category || "").trim(),
    date: normalizeDate(payload.date),
    note: String(payload.note || "").trim(),
    created_at: String(payload.created_at || now),
    updated_at: now,
  };
}

function parseArgs(argv) {
  const parsed = {
    host: "127.0.0.1",
    port: 39321,
    dataFile: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--host" && next) {
      parsed.host = String(next);
      index += 1;
    } else if (token === "--port" && next) {
      parsed.port = Number(next);
      index += 1;
    } else if (token === "--data-file" && next) {
      parsed.dataFile = String(next);
      index += 1;
    }
  }
  if (!parsed.dataFile) {
    throw new Error("--data-file is required.");
  }
  return parsed;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  config.dataFile = path.resolve(config.dataFile);

  const app = express();
  const publicDir = path.join(__dirname, "public");

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    const entries = loadEntries(config.dataFile);
    response.json({
      ok: true,
      service: "sidebar_account_book",
      timestamp: nowIso(),
      entryCount: entries.length,
      dataFile: config.dataFile,
      publicDir,
    });
  });

  app.get("/api/entries", (_request, response) => {
    const entries = loadEntries(config.dataFile);
    response.json({ success: true, entries, summary: summarize(entries) });
  });

  app.post("/api/entries", (request, response) => {
    const entries = loadEntries(config.dataFile);
    const entry = makeEntry(request.body || {});
    entries.unshift(entry);
    saveEntries(config.dataFile, entries);
    response.json({ success: true, entry, summary: summarize(entries) });
  });

  app.put("/api/entries/:entryId", (request, response) => {
    const entryId = String(request.params.entryId || "").trim();
    if (!entryId) {
      response.status(400).json({ success: false, message: "Entry id is required." });
      return;
    }
    const entries = loadEntries(config.dataFile);
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      response.status(404).json({ success: false, message: `Entry not found: ${entryId}` });
      return;
    }
    const current = entries[index];
    const payload = request.body || {};
    const nextEntry = {
      ...current,
      type: Object.prototype.hasOwnProperty.call(payload, "type") ? normalizeType(payload.type) : current.type,
      title: Object.prototype.hasOwnProperty.call(payload, "title") ? String(payload.title).trim() : current.title,
      amount: Object.prototype.hasOwnProperty.call(payload, "amount") ? normalizeAmount(payload.amount) : current.amount,
      category: Object.prototype.hasOwnProperty.call(payload, "category") ? String(payload.category || "").trim() : current.category,
      date: Object.prototype.hasOwnProperty.call(payload, "date") ? normalizeDate(payload.date) : current.date,
      note: Object.prototype.hasOwnProperty.call(payload, "note") ? String(payload.note || "").trim() : current.note,
      updated_at: nowIso(),
    };
    if (!nextEntry.title) {
      throw new Error("Title cannot be empty.");
    }
    entries[index] = nextEntry;
    entries.sort((left, right) => {
      const dateCompare = String(right.date).localeCompare(String(left.date));
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return String(right.updated_at).localeCompare(String(left.updated_at));
    });
    saveEntries(config.dataFile, entries);
    response.json({ success: true, entry: nextEntry, summary: summarize(entries) });
  });

  app.delete("/api/entries/:entryId", (request, response) => {
    const entryId = String(request.params.entryId || "").trim();
    if (!entryId) {
      response.status(400).json({ success: false, message: "Entry id is required." });
      return;
    }
    const entries = loadEntries(config.dataFile);
    const nextEntries = entries.filter((entry) => entry.id !== entryId);
    if (nextEntries.length === entries.length) {
      response.status(404).json({ success: false, message: `Entry not found: ${entryId}` });
      return;
    }
    saveEntries(config.dataFile, nextEntries);
    response.json({ success: true, deletedId: entryId, summary: summarize(nextEntries) });
  });

  app.use(express.static(publicDir, { etag: false, maxAge: 0 }));

  app.get("*", (_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      success: false,
      message: String(error && error.message ? error.message : error),
    });
  });

  app.listen(config.port, config.host, () => {
    console.log(JSON.stringify({
      ok: true,
      url: `http://${config.host}:${config.port}`,
      dataFile: config.dataFile,
      publicDir,
    }));
  });
}

main().catch((error) => {
  console.error(String(error && error.stack ? error.stack : error));
  process.exit(1);
});
