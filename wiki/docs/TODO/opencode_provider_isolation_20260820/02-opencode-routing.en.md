# OpenCode Routing Isolation

OpenCodeProvider is responsible for selecting the protocol based on the model and handing the request to a dedicated provider implementation. Dedicated implementations may reuse the generic provider's message, tool, and streaming handling, but override the request body and request URL through controlled extension points, without writing OpenCode conditions back into the public provider.

## Request Boundaries

- OpenAI Chat Completions: explicitly pass `reasoning_effort`
- OpenAI Responses: explicitly pass `reasoning`, without triggering the public automatic injection
- Anthropic Messages: explicitly pass `thinking` / `output_config`
- Gemini: use the model URL, `x-goog-api-key`, and streaming `?alt=sse`
