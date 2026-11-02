# Public Provider Recovery Boundary

## Old Implementation

Public providers change reasoning auto-injection, parameter filtering, and the Gemini request endpoint through the `OpenCodeReasoningParameters` marker. That marker serves only one provider, yet it enters the request construction path of all ordinary requests.

## Target Implementation

Public providers no longer import or recognize OpenCode types. OpenCode requests use a dedicated subclass or a dedicated request construction hook; authentication, endpoints, and thinking behavior of ordinary requests stay unchanged.

## Completion Criteria

- `ClaudeProvider.kt`, `GeminiProvider.kt`, `OpenAIProvider.kt`, and `OpenAIResponsesProvider.kt` contain no OpenCode special-case checks
- OpenCode-specific code takes on the explicit reasoning parameters and the Gemini `x-goog-api-key` / SSE URL
