import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { installMockRuntime, loadWorldBookModules } from "./support/mock_runtime.js";

const importFixturePath = path.resolve(
  process.cwd(),
  "examples",
  "worldbook",
  "tests",
  "fixtures",
  "w_system_import_fixture.json"
);

test("imports worldbook fixture, initializes variables, applies JSONPatch, and injects rendered system prompt", async () => {
  const runtime = installMockRuntime({ rootDirName: "worldbook_integration_test" });
  const { storage, service, variables, main } = loadWorldBookModules();

  const importResult = await service.importWorldBookEntries({
    content: fs.readFileSync(importFixturePath, "utf8"),
    character_card_id: "card_1"
  });

  assert.equal(importResult.source_type, "character_book");
  assert.equal(importResult.imported_count, 6);

  const entries = await storage.readWorldBookEntries();
  assert.equal(entries.length, 6);

  const variableListEntry = entries.find((entry: { name?: string }) => String(entry.name || "").includes("变量列表"));
  const stageEntry = entries.find((entry: { name?: string }) => String(entry.name || "").includes("宿主发展阶段"));
  assert.ok(variableListEntry);
  assert.ok(stageEntry);

  runtime.setMessages("chat_1", []);
  const initialContext = await variables.syncWorldBookVariableContext("chat_1", entries, "card_1");
  assert.equal(initialContext.localVariables.stat_data.心理.羁绊值, 0);
  assert.equal(initialContext.localVariables.stat_data.系统.积分, 0);

  const initialVariableText = variables.renderWorldBookContent(String(variableListEntry.content || ""), initialContext);
  const initialStageText = variables.renderWorldBookContent(String(stageEntry.content || ""), initialContext);
  assert.match(initialVariableText, /羁绊值: 0/);
  assert.match(initialVariableText, /积分: 0/);
  assert.match(initialStageText, /associated_variable: 羁绊值 \(0\)/);

  runtime.setMessages("chat_1", [
    {
      sender: "assistant",
      timestamp: 1710000000000,
      content:
        "<UpdateVariable><Analysis>ok</Analysis><JSONPatch>" +
        "[{\"op\":\"delta\",\"path\":\"/心理/羁绊值\",\"value\":12}," +
        "{\"op\":\"replace\",\"path\":\"/系统/积分\",\"value\":77}]" +
        "</JSONPatch></UpdateVariable>"
    }
  ]);

  const updatedContext = await variables.syncWorldBookVariableContext("chat_1", entries, "card_1");
  assert.equal(updatedContext.localVariables.stat_data.心理.羁绊值, 12);
  assert.equal(updatedContext.localVariables.stat_data.系统.积分, 77);

  const updatedVariableText = variables.renderWorldBookContent(String(variableListEntry.content || ""), updatedContext);
  const updatedStageText = variables.renderWorldBookContent(String(stageEntry.content || ""), updatedContext);
  assert.match(updatedVariableText, /羁绊值: 12/);
  assert.match(updatedVariableText, /积分: 77/);
  assert.match(updatedStageText, /associated_variable: 羁绊值 \(12\)/);

  const repeatedContext = await variables.syncWorldBookVariableContext("chat_1", entries, "card_1");
  assert.equal(repeatedContext.localVariables.stat_data.心理.羁绊值, 12);
  assert.equal(repeatedContext.localVariables.stat_data.系统.积分, 77);

  const hookResult = await main.systemPromptHook({
    event: "after_compose_system_prompt",
    eventName: "after_compose_system_prompt",
    eventPayload: {
      chatId: "chat_1",
      systemPrompt: "BASE_SYSTEM_PROMPT",
      metadata: {}
    }
  });

  assert.ok(hookResult);
  assert.match(String(hookResult.systemPrompt || ""), /BASE_SYSTEM_PROMPT/);
  assert.match(String(hookResult.systemPrompt || ""), /羁绊值: 12/);
  assert.match(String(hookResult.systemPrompt || ""), /<worldbook>/);

  const persistedVariables = JSON.parse(runtime.readPackageFile("variables.json"));
  assert.equal(persistedVariables.chats.chat_1.local_variables.stat_data.心理.羁绊值, 12);
  assert.equal(persistedVariables.chats.chat_1.local_variables.stat_data.系统.积分, 77);
});

test("supports prepend, append, and at_depth injection positions", async () => {
  installMockRuntime({ rootDirName: "worldbook_injection_position_test" });
  const { service, main } = loadWorldBookModules();

  await service.createWorldBookEntry({
    name: "system prepend",
    content: "SYS_PRE",
    keywords: "magic",
    always_active: true,
    inject_target: "system",
    inject_position: "prepend"
  });
  await service.createWorldBookEntry({
    name: "system append",
    content: "SYS_APP",
    keywords: "magic",
    always_active: true,
    inject_target: "system",
    inject_position: "append"
  });
  await service.createWorldBookEntry({
    name: "user append",
    content: "USER_APP",
    keywords: "magic",
    always_active: false,
    inject_target: "user",
    inject_position: "append"
  });
  await service.createWorldBookEntry({
    name: "chat depth",
    content: "CHAT_DEPTH",
    keywords: "magic",
    always_active: false,
    inject_target: "assistant",
    inject_position: "at_depth",
    insertion_depth: 1
  });

  const systemHookResult = await main.systemPromptHook({
    event: "after_compose_system_prompt",
    eventName: "after_compose_system_prompt",
    eventPayload: {
      chatId: "chat_1",
      systemPrompt: "BASE_SYSTEM",
      metadata: {}
    }
  });

  assert.ok(systemHookResult);
  assert.match(String(systemHookResult.systemPrompt || ""), /^<worldbook>[\s\S]*SYS_PRE[\s\S]*BASE_SYSTEM/);
  assert.match(String(systemHookResult.systemPrompt || ""), /BASE_SYSTEM[\s\S]*<worldbook>[\s\S]*SYS_APP/);

  const finalizeResult = await main.finalizeHook({
    event: "before_finalize_prompt",
    eventName: "before_finalize_prompt",
    eventPayload: {
      chatId: "chat_1",
      rawInput: "magic",
      processedInput: "magic",
      preparedHistory: [
        { kind: "SYSTEM", content: "BASE_SYSTEM" },
        { kind: "USER", content: "old user" },
        { kind: "ASSISTANT", content: "old assistant" }
      ],
      metadata: {}
    }
  });

  assert.ok(finalizeResult);
  assert.match(String(finalizeResult.processedInput || ""), /magic[\s\S]*USER_APP/);
  assert.equal(finalizeResult.preparedHistory[2].kind, "ASSISTANT");
  assert.match(String(finalizeResult.preparedHistory[2].content || ""), /CHAT_DEPTH/);
});
