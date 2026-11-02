# 03 Documentation and Verification

## Changes

- Expand the external HTTP settings page to display the Agent Card URL and JSON-RPC URL.
- Add A2A Server usage instructions and JSON-RPC examples under `docs/doc-src/feature-protocol/`.
- Statically verify that the existing HTTP routes and protocol documentation are unchanged.

## Verification Record

- No compile, build, or test commands were run, following the repository's execution guidelines.
- Statically verified that the existing `/api/health`, `/api/external-chat`, `/api/web/*`, and Web Chat routes of `ExternalChatHttpServer` are unchanged.
- Statically verified that the A2A Agent Card, JSON-RPC method names, error codes, and SSE envelope conform to the A2A 1.0 JSON-RPC binding.
- Statically verified that the A2A copy keys used by the settings page exist in both the default Chinese and English resources.

[DONE]
