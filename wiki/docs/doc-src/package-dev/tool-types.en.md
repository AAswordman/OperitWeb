# API Documentation: `tool-types.d.ts`

`tool-types.d.ts` defines a core interface: `ToolResultMap`. Its purpose is not to provide runtime capabilities, but to give `toolCall()` a static mapping from **tool name → return type**.

## Purpose

When you write:

```ts
const result = await toolCall('read_file', { path: '/sdcard/a.txt' });
```

TypeScript infers the type of `result` from `ToolResultMap['read_file']`.

## Core Interface

```ts
interface ToolResultMap {
  [toolName: string]: ResultType
}
```

## Current Tool Name Mappings

### File Operations

- `list_files` → `DirectoryListingData`
- `read_file` → `FileContentData`
- `read_file_part` → `FilePartContentData`
- `read_file_full` → `FileContentData`
- `read_file_binary` → `BinaryFileContentData`
- `write_file` → `FileOperationData`
- `delete_file` → `FileOperationData`
- `file_exists` → `FileExistsData`
- `move_file` → `FileOperationData`
- `copy_file` → `FileOperationData`
- `make_directory` → `FileOperationData`
- `find_files` → `FindFilesResultData`
- `grep_code` → `GrepResultData`
- `grep_context` → `GrepResultData`
- `file_info` → `FileInfoData`
- `zip_files` → `FileOperationData`
- `unzip_files` → `FileOperationData`
- `open_file` → `FileOperationData`
- `share_file` → `FileOperationData`
- `download_file` → `FileOperationData`
- `apply_file` → `FileApplyResultData`
- `create_file` → `FileApplyResultData`
- `edit_file` → `FileApplyResultData`

### Network Operations

- `http_request` → `HttpResponseData`
- `visit_web` → `VisitWebResultData`

`visit_web` only reads page content; it does not perform login, captcha, or other interactive verification. If page loading has still not completed after more than 10 seconds, the visit ends and a timeout result is returned.

- `browser_click` → `StringResultData`
- `browser_close` → `StringResultData`
- `browser_close_all` → `StringResultData`
- `browser_console_messages` → `StringResultData`
- `browser_drag` → `StringResultData`
- `browser_evaluate` → `StringResultData`
- `browser_file_upload` → `StringResultData`
- `browser_fill_form` → `StringResultData`
- `browser_handle_dialog` → `StringResultData`
- `browser_hover` → `StringResultData`
- `browser_navigate` → `StringResultData`
- `browser_navigate_back` → `StringResultData`
- `browser_network_requests` → `StringResultData`
- `browser_press_key` → `StringResultData`
- `browser_resize` → `StringResultData`
- `browser_run_code` → `StringResultData`
- `browser_select_option` → `StringResultData`
- `browser_wait_for` → `StringResultData`
- `browser_snapshot` → `StringResultData`
- `browser_take_screenshot` → `StringResultData`
- `browser_type` → `StringResultData`
- `browser_tabs` → `StringResultData`
- `multipart_request` → `HttpResponseData`
- `manage_cookies` → `HttpResponseData`

### System Operations

- `sleep` → `SleepResultData`
- `get_system_setting` → `SystemSettingData`
- `modify_system_setting` → `SystemSettingData`
- `toast` → `StringResultData`
- `send_notification` → `StringResultData`
- `install_app` → `AppOperationData`
- `uninstall_app` → `AppOperationData`
- `list_installed_apps` → `AppListData`
- `start_app` → `AppOperationData`
- `stop_app` → `AppOperationData`
- `device_info` → `DeviceInfoResultData`
- `get_notifications` → `NotificationData`
- `get_device_location` → `LocationData`
- `request_bluetooth_permission` → `StringResultData`
- `get_bluetooth_state` → `BluetoothStateData`
- `request_enable_bluetooth` → `StringResultData`
- `list_bluetooth_bonded_devices` → `BluetoothBondedDevicesData`
- `scan_bluetooth_devices` → `BluetoothScanResultData`
- `bluetooth_connect` → `BluetoothSessionData`
- `bluetooth_listen` → `BluetoothSessionData`
- `bluetooth_accept` → `BluetoothSessionData`
- `bluetooth_send` → `BluetoothTransferData`
- `bluetooth_read` → `BluetoothReadData`
- `bluetooth_send_and_read` → `BluetoothReadData`
- `bluetooth_close` → `StringResultData`
- `bluetooth_ble_connect` → `BluetoothSessionData`
- `bluetooth_ble_discover_services` → `BluetoothBleServicesData`
- `bluetooth_ble_read_characteristic` → `BluetoothReadData`
- `bluetooth_ble_write_characteristic` → `BluetoothTransferData`
- `bluetooth_ble_write_and_read_characteristic` → `BluetoothReadData`
- `bluetooth_ble_subscribe_characteristic` → `BluetoothTransferData`
- `bluetooth_ble_read_notifications` → `BluetoothBleNotificationData`
- `read_environment_variable` → `StringResultData`
- `write_environment_variable` → `StringResultData`
- `list_sandbox_packages` → `StringResultData`
- `set_sandbox_package_enabled` → `StringResultData`
- `restart_mcp_with_logs` → `StringResultData`
- `get_speech_services_config` → `SpeechServicesConfigResultData`
- `set_speech_services_config` → `SpeechServicesUpdateResultData`
- `list_model_configs` → `ModelConfigsResultData`
- `create_model_config` → `ModelConfigCreateResultData`
- `update_model_config` → `ModelConfigUpdateResultData`
- `delete_model_config` → `ModelConfigDeleteResultData`
- `list_function_model_configs` → `FunctionModelConfigsResultData`
- `get_function_model_config` → `FunctionModelConfigResultData`
- `set_function_model_config` → `FunctionModelBindingResultData`
- `test_model_config_connection` → `ModelConfigConnectionTestResultData`
- `trigger_tasker_event` → `string`

### UI Operations

- `get_page_info` → `UIPageResultData`
- `click_element` → `UIActionResultData`
- `tap` → `UIActionResultData`
- `set_input_text` → `UIActionResultData`
- `press_key` → `UIActionResultData`
- `swipe` → `UIActionResultData`
- `combined_operation` → `CombinedOperationResultData`
- `run_ui_subagent` → `AutomationExecutionResultData`

### Calculator

- `calculate` → `CalculationResultData`

### Packages and Memory

- `use_package` → `string`
- `query_memory` → `MemoryQueryResultData`
- `link_memories` → `MemoryLinkResultData`
- `query_memory_links` → `MemoryLinkQueryResultData`

### FFmpeg

- `ffmpeg_execute` → `FFmpegResultData`
- `ffmpeg_info` → `FFmpegResultData`
- `ffmpeg_convert` → `FFmpegResultData`

### ADB / Intent / Terminal

- `execute_shell` → `ADBResultData`
- `execute_intent` → `IntentResultData`
- `send_broadcast` → `IntentResultData`
- `execute_terminal` → `TerminalCommandResultData`
- `get_terminal_session_screen` → `TerminalSessionScreenResultData`

### Workflows

- `get_all_workflows` → `WorkflowListResultData`
- `create_workflow` → `WorkflowDetailResultData`
- `get_workflow` → `WorkflowDetailResultData`
- `update_workflow` → `WorkflowDetailResultData`
- `patch_workflow` → `WorkflowDetailResultData`
- `delete_workflow` → `StringResultData`
- `trigger_workflow` → `StringResultData`

### Chat Manager

- `start_chat_service` → `ChatServiceStartResultData`
- `create_new_chat` → `ChatCreationResultData`
- `list_chats` → `ChatListResultData`
- `find_chat` → `ChatFindResultData`
- `agent_status` → `AgentStatusResultData`
- `switch_chat` → `ChatSwitchResultData`
- `update_chat_title` → `ChatTitleUpdateResultData`
- `delete_chat` → `ChatDeleteResultData`
- `send_message_to_ai` → `MessageSendResultData`
- `list_character_cards` → `CharacterCardListResultData`
- `get_chat_messages` → `ChatMessagesResultData`
- `get_chat_messages_range` → `ChatMessagesResultData`

## Usage

### Letting `toolCall()` Get a Precise Return Type

```ts
const file = await toolCall('read_file', {
  path: '/sdcard/demo.txt'
});

file.content;
file.size;
```

### Object-Form Calls

```ts
const page = await toolCall({
  name: 'get_page_info'
});
```

## Notes

- `tool-types.d.ts` only describes the **mapping between tool names and return types**.
- Parameter structures still need to be checked against the corresponding module documentation or the corresponding `.d.ts` file.
- If a tool name does not appear in `ToolResultMap`, the generic return value of `toolCall()` may degrade to `any`.

## Related Files

- `examples/types/tool-types.d.ts`
- `examples/types/core.d.ts`
- `docs/doc-src/package-dev/results.md`
