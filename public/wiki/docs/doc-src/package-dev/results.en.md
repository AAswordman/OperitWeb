# API Documentation: `results.d.ts`

`results.d.ts` is the centralized definition of all tool return structures. It does not itself provide runtime methods, but almost all `Tools.*`, `toolCall()`, and some global objects ultimately return data types defined here.

## Purpose

This file mainly serves two responsibilities:

- Defining raw result structures in the `...Data` form.
- Defining wrapped results in the `...Result` form, which usually contain a `BaseResult` and a `data` field.

## Naming Conventions

### `...Data`

Represents the return data body of a tool or capability, for example:

- `FileContentData`
- `HttpResponseData`
- `UIPageResultData`
- `WorkflowDetailResultData`

### `...Result`

Represents a result object wrapped with `success` / `error`, for example:

- `SystemSettingResult`
- `UIPageResult`
- `ChatCreationResult`
- `MemoryLinkResult`

### `toString()`

Many `...Data` types declare a `toString()`, indicating that the runtime supports converting the result to readable text.

## Main Result Categories

### 1. File and Search Results

Common types:

- `FileEntry`
- `FileExistsData`
- `FileInfoData`
- `DirectoryListingData`
- `FileContentData`
- `BinaryFileContentData`
- `FilePartContentData`
- `FileOperationData`
- `FileApplyResultData`
- `FindFilesResultData`
- `GrepLineMatch`
- `GrepFileMatch`
- `GrepResultData`

Of these:

- `FileContentData` contains `env`, `path`, `content`, and `size`
- `BinaryFileContentData` represents binary content via `contentBase64`
- `GrepResultData` contains `matches`, `totalMatches`, and `filesSearched`

### 2. Network Results

Common types:

- `HttpResponseData`
- `Link`
- `VisitWebResultData`

Of these:

- `HttpResponseData` contains `statusCode`, `statusMessage`, `headers`, `contentType`, and `content`
- `VisitWebResultData` may additionally contain `metadata`, `links`, `imageLinks`, and `visitKey`, besides the page body text
- When the page body text is too long, `VisitWebResultData` may also contain `contentSavedTo`, `contentTruncated`, and `originalContentLength`

### 3. System / Device / App Results

Common types:

- `SleepResultData`
- `SystemSettingData`
- `AppOperationData`
- `AppListData`
- `AppUsageTimeResultData`
- `BluetoothStateData`
- `BluetoothBondedDevicesData`
- `BluetoothScanResultData`
- `BluetoothSessionData`
- `BluetoothTransferData`
- `BluetoothReadData`
- `BluetoothBleServicesData`
- `BluetoothBleNotificationData`
- `NotificationData`
- `LocationData`
- `DeviceInfoResultData`

Of these:

- `SystemSettingData` contains `namespace`, `setting`, and `value`
- `AppOperationData` contains `operationType`, `packageName`, `success`, and `details`
- `AppUsageTimeResultData` contains the time window, whether system apps are included, and a per-app foreground usage duration entry
- `BluetoothStateData` contains whether the device supports Bluetooth, whether it is turned on, and the current state
- `BluetoothBondedDevicesData` contains the list of paired Bluetooth devices
- `BluetoothScanResultData` contains the list of scanned devices, the source, and RSSI
- `BluetoothSessionData` contains the Bluetooth session ID, address, and mode
- `BluetoothTransferData` contains the number of bytes written
- `BluetoothReadData` contains the number of bytes read, UTF-8 text, and base64 bytes
- `BluetoothBleServicesData` contains the BLE service and characteristic lists
- `BluetoothBleNotificationData` contains the list of received BLE notifications
- `NotificationData` provides a notification list and a capture timestamp
- `LocationData` provides latitude/longitude, accuracy, address, and other information

### 4. UI and Automation Results

Common types:

- `SimplifiedUINode`
- `UIPageResultData`
- `UIActionResultData`
- `CombinedOperationResultData`
- `AutomationExecutionResultData`

Of these:

- `UIPageResultData` contains `packageName`, `activityName`, and `uiElements`
- `UIActionResultData` describes a single click, input, swipe, or similar action
- `AutomationExecutionResultData` additionally contains `agentId`, `displayId`, `executionSuccess`, `executionMessage`, and `finalState`

### 5. Shell / Intent / Terminal / FFmpeg Results

Common types:

- `ADBResultData`
- `IntentResultData`
- `TerminalCommandResultData`
- `TerminalSessionCreationResultData`
- `TerminalSessionCloseResultData`
- `TerminalSessionScreenResultData`
- `FFmpegResultData`
- `StringResultData`

`StringResultData` is very simple, containing only:

- `value`
- `toString()`

Many "control-style APIs" return it.

### 6. Workflow Results and Workflow Structures

`results.d.ts` defines not only workflow return values, but also the data structures of the workflow graph itself.

Common types:

- `WorkflowResultData`
- `WorkflowListResultData`
- `NodePosition`
- `StaticValue`
- `NodeReference`
- `ParameterValue`
- `TriggerType`
- `TriggerNode`
- `ExecuteNode`
- `ConditionOperator`
- `ConditionNode`
- `LogicOperator`
- `LogicNode`
- `ExtractMode`
- `ExtractNode`
- `WorkflowNode`
- `WorkflowConnectionConditionKeyword`
- `WorkflowConnectionCondition`
- `WorkflowNodeConnection`
- `WorkflowDetailResultData`

Of these:

- `WorkflowResultData` / `WorkflowListResultData` are more list-oriented views
- `WorkflowDetailResultData` contains `nodes`, `connections`, `enabled`, statistics, and the most recent execution status
- `WorkflowNode` is a union type of five node kinds

### 7. Software Settings and Model Configuration Results

Common types:

- `SpeechTtsHttpConfigResultItem`
- `SpeechSttHttpConfigResultItem`
- `SpeechServicesConfigResultData`
- `SpeechServicesUpdateResultData`
- `ModelConfigResultItem`
- `FunctionModelMappingResultItem`
- `ModelConfigsResultData`
- `ModelConfigCreateResultData`
- `ModelConfigUpdateResultData`
- `ModelConfigDeleteResultData`
- `FunctionModelConfigsResultData`
- `FunctionModelConfigResultData`
- `FunctionModelBindingResultData`
- `ModelConfigConnectionTestOutcome`
- `ModelConfigConnectionTestItemResultData`
- `ModelConfigConnectionTestResultData`

This section is mainly used by `Tools.SoftwareSettings`.

`ModelConfigConnectionTestResultData.success` indicates that the connection test had no hard failure — for example, the request or tool call did not error. It does not mean that multimodal capability has been proven.

`ModelConfigConnectionTestResultData.verified` indicates that all test items in this request were verified. A single item `tests[].outcome` has three possible values:

- `passed`: the item has been verified as passed
- `unverified`: the request connected, but the returned content did not prove the corresponding capability
- `failed`: the item's request or execution failed

In the statistics fields, `passedTests`, `unverifiedTests`, and `failedTests` correspond to these three categories of individual item results, respectively.

### 8. Chat Results

Common types:

- `ChatServiceStartResultData`
- `ChatCreationResultData`
- `ChatInfo`
- `ChatListResultData`
- `ChatSwitchResultData`
- `ChatTitleUpdateResultData`
- `ChatDeleteResultData`
- `MessageSendResultData`
- `ChatMessageInfo`
- `ChatMessagesResultData`
- `CharacterCardListResultData`
- `CharacterCardInfo`
- `ChatFindResultData`
- `AgentStatusResultData`

The corresponding wrapped results are also defined:

- `ChatServiceStartResult`
- `ChatCreationResult`
- `ChatListResult`
- `ChatFindResult`
- `AgentStatusResult`
- `ChatSwitchResult`
- `ChatTitleUpdateResult`
- `ChatDeleteResult`
- `MessageSendResult`
- `ChatMessagesResult`

### 9. Memory Link Results

Common types:

- `MemoryQueryResultData`
- `MemoryLinkResultData`
- `MemoryLinkQueryResultData`
- `MemoryLinkResult`
- `MemoryLinkQueryResult`

`MemoryQueryResultData` internally contains `memories[]`, each item having:

- `title`
- `content`
- `source`
- `tags`
- `createdAt`
- `chunkInfo`
- `chunkIndices`

`MemoryQueryResultData` itself also contains:

- `snapshotId`
- `snapshotCreated`
- `excludedBySnapshotCount`

Of these, `snapshotId` may be system-generated, or a custom string actively passed by the caller and created on first use.

`MemoryLinkQueryResultData` internally contains `links[]`, each item having:

- `linkId`
- `sourceTitle`
- `targetTitle`
- `linkType`
- `weight`
- `description`

## Examples

### Using `FileContentData`

```ts
const file = await Tools.Files.read('/sdcard/a.txt');
console.log(file.content);
console.log(file.size);
```

### Using `VisitWebResultData`

```ts
const page = await Tools.Net.visit('https://example.com');
console.log(page.title);
console.log(page.links?.length ?? 0);
if (page.contentSavedTo) {
  console.log(page.contentSavedTo);
}
```

### Using `WorkflowDetailResultData`

```ts
const detail = await Tools.Workflow.get('workflow_123');
console.log(detail.nodes.length);
console.log(detail.connections.length);
```

## How to Read This File

It is recommended to look things up in reverse, by "who returns it":

- File-related → `files.d.ts`
- Network-related → `network.d.ts` / `okhttp.d.ts`
- System-related → `system.d.ts`
- UI-related → `ui.d.ts`
- Workflow-related → `workflow.d.ts`
- Software-settings-related → `software_settings.d.ts`
- Chat-related → `chat.d.ts`
- Memory-related → `memory.d.ts`

## Related Files

- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/files.md`
- `docs/doc-src/package-dev/network.md`
- `docs/doc-src/package-dev/system.md`
- `docs/doc-src/package-dev/ui.md`
- `docs/doc-src/package-dev/workflow.md`
- `docs/doc-src/package-dev/software_settings.md`
- `docs/doc-src/package-dev/chat.md`
- `docs/doc-src/package-dev/memory.md`
