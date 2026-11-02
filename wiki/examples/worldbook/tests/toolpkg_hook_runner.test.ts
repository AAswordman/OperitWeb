import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { installMockRuntime, loadWorldBookModules } from "./support/mock_runtime.js";

const importFixturePath = path.resolve(
  process.cwd(),
  "examples",
  "worldbook",
  "tests",
  "fixtures",
  "w_system_import_fixture.json"
);

test("toolpkg_hook_runner invokes worldbook system prompt hook with prepared storage", async () => {
  const runtime = installMockRuntime({ rootDirName: "worldbook_hook_runner_test" });
  const { storage, service, variables } = loadWorldBookModules();

  await service.importWorldBookEntries({
    content: fs.readFileSync(importFixturePath, "utf8"),
    character_card_id: "card_1"
  });
  const entries = await storage.readWorldBookEntries();

  runtime.setMessages("chat_1", [
    {
      sender: "assistant",
      timestamp: 1710000000000,
      content:
        "<UpdateVariable><Analysis>ok</Analysis><JSONPatch>" +
        "[{\"op\":\"delta\",\"path\":\"/心理/羁绊值\",\"value\":9}]" +
        "</JSONPatch></UpdateVariable>"
    }
  ]);
  await variables.syncWorldBookVariableContext("chat_1", entries, "card_1");

  const runnerTempDir = path.join(process.cwd(), "temp", "worldbook_hook_runner_cli");
  fs.rmSync(runnerTempDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(runnerTempDir, "com.operit.worldbook"), { recursive: true });
  fs.copyFileSync(
    path.join(runtime.packageConfigDir, "entries.json"),
    path.join(runnerTempDir, "com.operit.worldbook", "entries.json")
  );
  fs.copyFileSync(
    path.join(runtime.packageConfigDir, "variables.json"),
    path.join(runnerTempDir, "com.operit.worldbook", "variables.json")
  );

  const fixturesPath = path.join(runnerTempDir, "fixtures.json");
  const payloadPath = path.join(runnerTempDir, "payload.json");
  fs.writeFileSync(
    fixturesPath,
    JSON.stringify(
      {
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
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    payloadPath,
    JSON.stringify(
      {
        chatId: "chat_1",
        systemPrompt: "BASE_SYSTEM_PROMPT",
        metadata: {}
      },
      null,
      2
    ),
    "utf8"
  );

  const outputText = execFileSync(
    process.execPath,
    [
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
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
  const parsed = JSON.parse(outputText);

  assert.equal(parsed.packageId, "com.operit.worldbook");
  assert.equal(parsed.kind, "system_prompt");
  assert.equal(parsed.hookCount, 1);
  assert.equal(parsed.results[0].id, "worldbook_always_active");
  assert.match(String(parsed.results[0].result.systemPrompt || ""), /BASE_SYSTEM_PROMPT/);
  assert.match(String(parsed.results[0].result.systemPrompt || ""), /羁绊值: 9/);
});
