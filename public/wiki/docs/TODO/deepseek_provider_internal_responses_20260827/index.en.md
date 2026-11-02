---
fork: local
---

# DeepSeek Provider Internal Responses Routing

## Current State

PR #1015 spread the endpoint selection for DeepSeek Responses, server-side search records, and tool status display across the generic chat path, the UI rendering layer, and Web Chat. Protocol details were elevated into `AIServiceFactory`, causing DeepSeek's private capabilities to affect the public paths of other providers.

## Intent

- Converge the choice between DeepSeek Chat Completions and Responses inside `DeepseekProvider`
- Keep the DeepSeek branch of `AIServiceFactory` to only create the DeepSeek provider
- Declare the `web_search` tool only in the body of DeepSeek Responses requests
- Remove the generic-layer server-side tool events, hidden search records, and related test documentation added by PR #1015

## Scope

- Internal routing of `DeepseekProvider` and the Responses subclass
- Display conversion from DeepSeek Responses `web_search_call` to `<search>` blocks
- Saving the protocol markers of the official Responses `web_search_call` output item and restoring them verbatim in the next round's `input`
- Preserving Responses protocol markers in DeepSeek history inside the provider, with the endpoint protocol deciding whether to consume or remove them
- Emitting Responses reasoning and body text along output item boundaries; appending a thinking block after the answer ends is prohibited
- DeepSeek/Codex search display continues to save structured `<query>` and `<source>` child nodes; multiple `web_search_call` items in the same round are aggregated into a single display block, Android and Web prefer rendering the favicon and site name of the complete source list, showing the query term directly when the server only returns query terms, and following adjacent thinking and tool calls into the same collapsible group
- DeepSeek web search configuration items and settings page toggle
- Codex OAuth Responses server-side search declaration and `<search>` block display
- Cleanup of the spread of PR #1015 changes across public chat, rendering, Web Chat, and documentation tests

[DONE]
