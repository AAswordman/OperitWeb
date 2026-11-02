# API Documentation: `software_settings.d.ts`

`software_settings.d.ts` describes the `Tools.SoftwareSettings` namespace. It is responsible for reading and writing software runtime configuration, rather than ordinary business tool calls.

## Purpose

The current definitions cover three categories of capability:

- Environment variable management.
- Sandbox package enabling/disabling and MCP startup logs.
- Speech service and model configuration management.

## Runtime Entry Point

```ts
Tools.SoftwareSettings
```

## Environment Variables

### `readEnvironmentVariable(key)`

```ts
readEnvironmentVariable(key: string): Promise<StringResultData>
```

Reads the specified environment variable.

### `writeEnvironmentVariable(key, value?)`

```ts
writeEnvironmentVariable(key: string, value?: string): Promise<StringResultData>
```

Writes an environment variable; when `value` is an empty string, it means clearing that variable.

## Sandbox and MCP

### `listSandboxPackages()`

Lists the current sandbox packages and their enabled states.

### `setSandboxPackageEnabled(packageName, enabled)`

Enables or disables a sandbox package.

### `restartMcpWithLogs(timeoutMs?)`

Restarts the MCP startup flow and collects each plugin's startup logs.

## Speech Services

### `getSpeechServicesConfig()`

Reads the current TTS / STT profile configuration, returning `SpeechServicesConfigResultData`. Speech configuration is now managed by independent TTS/STT profiles; for compatibility, this API still reads and writes the current profile without changing the original fields.

### `setSpeechServicesConfig(updates?)`

Updates the current TTS / STT profile, returning `SpeechServicesUpdateResultData`. Creating, switching, and deleting profiles must be done on the speech service settings page.

Updatable fields include:

- TTS: `tts_service_type`, `tts_url_template`, `tts_api_key`, `tts_headers`, `tts_http_method`, `tts_request_body`, `tts_content_type`, `tts_locale`, `tts_voice_id`, `tts_model_name`, `tts_response_pipeline`, `tts_cleaner_regexs`, `tts_speech_rate`, `tts_pitch`
- STT: `stt_service_type`, `stt_endpoint_url`, `stt_api_key`, `stt_model_name`

Among these, `tts_response_pipeline` is only used for `HTTP_TTS`, and its value is a JSON array string. When left empty or passed as `[]`, the old behavior is kept, treating the first response body directly as audio; when filled in, response processing is performed step by step.

## Model Configuration

### `listModelConfigs()`

Lists all model configurations and the current function binding relationships.

### `createModelConfig(options?)`

Creates a model configuration, returning `ModelConfigCreateResultData`.

### `updateModelConfig(configId, updates?)`

Updates the specified model configuration, returning `ModelConfigUpdateResultData`.

### `deleteModelConfig(configId)`

Deletes a model configuration, returning `ModelConfigDeleteResultData`.

### `listFunctionModelConfigs()`

Views the binding relationships between function types and model configurations.

### `getFunctionModelConfig(functionType)`

Views the model configuration currently bound to a given function type.

### `setFunctionModelConfig(functionType, configId, modelIndex?)`

Binds a function type to a specified model configuration.

### `testModelConfigConnection(configId, modelIndex?)`

Runs a connection test on a model configuration, returning `ModelConfigConnectionTestResultData`.

Return values distinguish connectivity from capability verification:

- `success`: this test had no hard failure. When a multimodal request returned content but did not hit a probe, it may still be `true`
- `verified`: all test items across all requests have been verified as passed
- `tests[].outcome`: individual item result, with values `passed`, `unverified`, or `failed`

## Updatable Model Configuration Fields

The main fields visible in `ModelConfigUpdateOptions` include:

- Interface information: `name`, `api_provider_type`, `api_endpoint`, `api_key`, `model_name`
- Sampling parameters: `max_tokens`, `temperature`, `top_p`, `top_k`
- Penalties: `presence_penalty`, `frequency_penalty`, `repetition_penalty`
- Context parameters: `context_length`, `max_context_length`, `enable_max_context_mode`
- Summary-related: `summary_token_threshold`, `enable_summary`, `enable_summary_by_message_count`, `summary_message_count_threshold`
- Multimodal switches: `enable_direct_image_processing`, `enable_direct_audio_processing`, `enable_direct_video_processing`
- Extended capabilities: `enable_google_search`, `enable_tool_call`
- Local model / concurrency control: `mnn_forward_type`, `mnn_thread_count`, `llama_thread_count`, `llama_context_size`, `request_limit_per_minute`, `max_concurrent_requests`

When a group of fields has corresponding `..._enabled` boolean control items, they should be passed together as defined by the type definitions.

## Examples

### Reading an Environment Variable

```ts
const apiKey = await Tools.SoftwareSettings.readEnvironmentVariable('OPENAI_API_KEY');
console.log(apiKey.value);
```

### Updating Speech Service Configuration

```ts
await Tools.SoftwareSettings.setSpeechServicesConfig({
  tts_service_type: 'SIMPLE_TTS',
  tts_locale: 'en-US',
  tts_voice_id: 'en-us-x-sfg#female_1-local'
});
```

### Testing a Model Configuration Connection

```ts
const result = await Tools.SoftwareSettings.testModelConfigConnection('config_123');
complete(result);
```

## Related Files

- `examples/types/software_settings.d.ts`
- `examples/types/results.d.ts`
- `examples/types/index.d.ts`
