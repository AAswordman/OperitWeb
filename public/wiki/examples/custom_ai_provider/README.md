# Custom AI Provider Example

This ToolPkg registers a custom AI provider that can be selected directly in model settings.

Provider id:

- `example_openai_compatible_provider`

What it does:

- Registers a provider with `ToolPkg.registerAiProvider(...)`
- Uses the model config's `apiEndpoint`, `apiKey`, and `modelName`
- Sends requests to an OpenAI-compatible `/chat/completions` endpoint
- Tries to read models from a compatible `/models` endpoint

Recommended usage:

1. Import this folder as a ToolPkg.
2. Enable the package.
3. Open model settings.
4. Select `示例 OpenAI 兼容供应商`.
5. Fill in:
   - `API Endpoint`
   - `API Key`
   - `Model Name`

Notes:

- This is an example package, intended to show the provider registration shape clearly.
- The implementation is intentionally simple and targets OpenAI-compatible APIs.
