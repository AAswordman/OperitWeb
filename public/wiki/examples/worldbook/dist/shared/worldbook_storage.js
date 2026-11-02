"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorldBookDir = getWorldBookDir;
exports.getWorldBookFile = getWorldBookFile;
exports.ensureWorldBookStorage = ensureWorldBookStorage;
exports.readWorldBookEntries = readWorldBookEntries;
exports.writeWorldBookEntries = writeWorldBookEntries;
exports.getWorldBookGroupsFile = getWorldBookGroupsFile;
exports.readWorldBookGroups = readWorldBookGroups;
exports.writeWorldBookGroups = writeWorldBookGroups;
const LEGACY_WORLD_BOOK_DIR = "/sdcard/Download/Operit/worldbook";
const LEGACY_WORLD_BOOK_FILE = `${LEGACY_WORLD_BOOK_DIR}/entries.json`;
function getWorldBookDir() {
    return ToolPkg.getConfigDir();
}
function getWorldBookFile() {
    return `${getWorldBookDir()}/entries.json`;
}
async function deleteLegacyWorldBookStorage() {
    try {
        const legacyFileExists = await Tools.Files.exists(LEGACY_WORLD_BOOK_FILE);
        if (legacyFileExists?.exists) {
            await Tools.Files.deleteFile(LEGACY_WORLD_BOOK_FILE);
        }
    }
    catch (_error) {
    }
    try {
        const legacyDirExists = await Tools.Files.exists(LEGACY_WORLD_BOOK_DIR);
        if (legacyDirExists?.exists) {
            await Tools.Files.deleteFile(LEGACY_WORLD_BOOK_DIR, true);
        }
    }
    catch (_error) {
    }
}
async function ensureWorldBookStorage() {
    const worldBookDir = getWorldBookDir();
    const worldBookFile = getWorldBookFile();
    const worldBookGroupsFile = getWorldBookGroupsFile();
    await Tools.Files.mkdir(worldBookDir, true);
    const currentFileExists = await Tools.Files.exists(worldBookFile);
    if (!currentFileExists?.exists) {
        const legacyFileExists = await Tools.Files.exists(LEGACY_WORLD_BOOK_FILE);
        if (legacyFileExists?.exists) {
            const legacyFile = await Tools.Files.read(LEGACY_WORLD_BOOK_FILE);
            const migratedContent = String(legacyFile?.content || "").trim() || "[]";
            await Tools.Files.write(worldBookFile, migratedContent, false);
        }
        else {
            await Tools.Files.write(worldBookFile, "[]", false);
        }
    }
    const groupFileExists = await Tools.Files.exists(worldBookGroupsFile);
    if (!groupFileExists?.exists) {
        await Tools.Files.write(worldBookGroupsFile, "[]", false);
    }
    await deleteLegacyWorldBookStorage();
}
async function readWorldBookEntries() {
    await ensureWorldBookStorage();
    try {
        const fileResult = await Tools.Files.read(getWorldBookFile());
        if (!fileResult?.content) {
            return [];
        }
        const parsed = JSON.parse(fileResult.content);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_error) {
        return [];
    }
}
async function writeWorldBookEntries(entries) {
    await ensureWorldBookStorage();
    await Tools.Files.write(getWorldBookFile(), JSON.stringify(entries, null, 2));
}
function getWorldBookGroupsFile() {
    return `${getWorldBookDir()}/groups.json`;
}
async function readWorldBookGroups() {
    await ensureWorldBookStorage();
    const fileResult = await Tools.Files.read(getWorldBookGroupsFile());
    if (fileResult?.content == null) {
        throw new Error("世界书分组文件读取失败");
    }
    const parsed = JSON.parse(fileResult.content);
    if (!Array.isArray(parsed)) {
        throw new Error("世界书分组文件格式无效");
    }
    return parsed;
}
async function writeWorldBookGroups(groups) {
    await ensureWorldBookStorage();
    await Tools.Files.write(getWorldBookGroupsFile(), JSON.stringify(groups, null, 2));
}
