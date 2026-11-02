"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const mock_runtime_js_1 = require("./support/mock_runtime.js");
const importFixturePath = node_path_1.default.resolve(process.cwd(), "examples", "worldbook", "tests", "fixtures", "w_system_import_fixture.json");
(0, node_test_1.test)("toolpkg_hook_runner invokes worldbook system prompt hook with prepared storage", async () => {
    const runtime = (0, mock_runtime_js_1.installMockRuntime)({ rootDirName: "worldbook_hook_runner_test" });
    const { storage, service, variables } = (0, mock_runtime_js_1.loadWorldBookModules)();
    await service.importWorldBookEntries({
        content: node_fs_1.default.readFileSync(importFixturePath, "utf8"),
        character_card_id: "card_1"
    });
    const entries = await storage.readWorldBookEntries();
    runtime.setMessages("chat_1", [
        {
            sender: "assistant",
            timestamp: 1710000000000,
            content: "<UpdateVariable><Analysis>ok</Analysis><JSONPatch>" +
                "[{\"op\":\"delta\",\"path\":\"/心理/羁绊值\",\"value\":9}]" +
                "</JSONPatch></UpdateVariable>"
        }
    ]);
    await variables.syncWorldBookVariableContext("chat_1", entries, "card_1");
    const runnerTempDir = node_path_1.default.join(process.cwd(), "temp", "worldbook_hook_runner_cli");
    node_fs_1.default.rmSync(runnerTempDir, { recursive: true, force: true });
    node_fs_1.default.mkdirSync(node_path_1.default.join(runnerTempDir, "com.operit.worldbook"), { recursive: true });
    node_fs_1.default.copyFileSync(node_path_1.default.join(runtime.packageConfigDir, "entries.json"), node_path_1.default.join(runnerTempDir, "com.operit.worldbook", "entries.json"));
    node_fs_1.default.copyFileSync(node_path_1.default.join(runtime.packageConfigDir, "variables.json"), node_path_1.default.join(runnerTempDir, "com.operit.worldbook", "variables.json"));
    const fixturesPath = node_path_1.default.join(runnerTempDir, "fixtures.json");
    const payloadPath = node_path_1.default.join(runnerTempDir, "payload.json");
    node_fs_1.default.writeFileSync(fixturesPath, JSON.stringify({
        callerCardId: "card_1",
        lang: "zh-CN",
        characterCards: [
            {
                id: "card_1",
                name: "Test Card",
                description: "",
                isDefault: false
            }
        ],
        chatsById: {
            chat_1: {
                id: "chat_1",
                characterCardName: "Test Card"
            }
        },
        messagesByChatId: {
            chat_1: [
                {
                    sender: "assistant",
                    timestamp: 1710000000000,
                    content: "<UpdateVariable><JSONPatch>[{\"op\":\"delta\",\"path\":\"/心理/羁绊值\",\"value\":9}]</JSONPatch></UpdateVariable>"
                }
            ]
        }
    }, null, 2), "utf8");
    node_fs_1.default.writeFileSync(payloadPath, JSON.stringify({
        chatId: "chat_1",
        systemPrompt: "BASE_SYSTEM_PROMPT",
        metadata: {}
    }, null, 2), "utf8");
    const outputText = (0, node_child_process_1.execFileSync)(process.execPath, [
        "tools/toolpkg/toolpkg_hook_runner.js",
        "--source",
        "examples/worldbook",
        "--kind",
        "system_prompt",
        "--event",
        "after_compose_system_prompt",
        "--payload",
        `@${payloadPath}`,
        "--fixtures",
        `@${fixturesPath}`,
        "--config-dir",
        runnerTempDir,
        "--pretty"
    ], {
        cwd: process.cwd(),
        encoding: "utf8"
    });
    const parsed = JSON.parse(outputText);
    strict_1.default.equal(parsed.packageId, "com.operit.worldbook");
    strict_1.default.equal(parsed.kind, "system_prompt");
    strict_1.default.equal(parsed.hookCount, 1);
    strict_1.default.equal(parsed.results[0].id, "worldbook_always_active");
    strict_1.default.match(String(parsed.results[0].result.systemPrompt || ""), /BASE_SYSTEM_PROMPT/);
    strict_1.default.match(String(parsed.results[0].result.systemPrompt || ""), /羁绊值: 9/);
});
