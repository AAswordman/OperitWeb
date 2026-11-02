---
title: DeepSeek Responses and Web Search Protocol
description: DeepSeek Chat Completions compatibility, Responses routing, search recognition, and history recovery conventions
keywords: DeepSeek,Responses,web_search,configuration compatibility,chat history
For_Agent: This document is a collaboration implementation protocol; it does not mean the feature has entered a released version
---

# DeepSeek Responses and Web Search Protocol

## Configuration Compatibility

DeepSeek continues to use `ApiProviderType.DEEPSEEK`. The API endpoint is the sole configuration source for that provider's internal transport protocol; no new provider identity is created, so model pricing, token statistics, and existing configuration ownership stay unchanged.

Endpoints saved by released versions ending in `/chat/completions` continue to use Chat Completions. Endpoints whose path ends in `/responses` use Responses. The Web Search switch only takes effect on Responses endpoints; when the switch is off or Chat Completions is used, `web_search` is not declared.

The API endpoint selector in Settings offers the official Chat Completions and Responses full addresses, and directly saves the address the user selects. At runtime, no separate protocol field is saved, and the two protocol paths do not rewrite each other.

## Responses Requests

The Responses endpoint is selected internally by `DeepseekProvider`; endpoint detection is not spread beyond `AIServiceFactory`. When Web Search is enabled, the following tool declaration is added alongside the existing function tools:

```json
{"type":"web_search"}
```

The tool declaration allows the model to choose whether to search; each round's search is not forced.

DeepSeek Responses currently does not declare `include`. The compatibility table does not list `include` support; a 2026-08-28 live test showed the returned `web_search_call.action` contains `type` and `queries` but not `sources`, and the final `output_text.annotations` is an empty array. The provider first recognizes a search call by `output[].type == "web_search_call"` and reads `action.queries`; when multiple `web_search_call` items appear in the same round, they are merged into one `<search>` display block. If the response also provides `web_search_call.action.sources`, `web_search_call.action.url`, or final-text `annotations[].url_citation`, those structured sources are then written into the same `<search>` block.

In multi-round context, the complete `web_search_call` output item returned by the server must continue to be submitted as a Responses `input` item. The current message model has no standalone provider metadata field, so the provider encodes that official JSON item into the `<meta provider="openai:responses_output_item">` protocol marker; when constructing the next round's request, the adapter decodes it and writes it back verbatim into `input`. The `<search>` display block in the same assistant message is removed when constructing request text, to avoid handing UI display text back to the model.

Pre-send cleanup does not guess the endpoint protocol from DeepSeek's providerModel. DeepSeek history keeps the Responses protocol marker internal to the provider; Chat Completions content construction strips these markers and the `<search>` display block, and the Responses adapter consumes and restores the official input item.

Responses streaming ends with `response.completed`, `response.incomplete`, or `response.failed`. `completed` and `incomplete` are both server-confirmed termination events; `failed` is handled as a response error. A connection ending before a termination event arrives is still treated as a network interruption.

When `response.reasoning_text.delta` and `response.reasoning_summary_text.delta` arrive, reasoning is output immediately. The DeepSeek sub-provider records the message item on `response.output_item.added`: `output_text.delta` with `phase=commentary` is written only to hidden metadata and does not enter the UI; non-commentary body-text deltas are output immediately. `response.output_item.done` re-emits buffered body text only once, for text not yet output live, to avoid replaying the already-streamed final answer in full. Visible thinking comes only from `reasoning` items. `response.reasoning_text.done` is handled only when the event carries complete text and that text has not yet been output via deltas; `response.output_item.done` only supplements the `content[].reasoning_text` carried by the reasoning item itself. Termination events do not append reasoning or body text, to avoid appending thinking after the answer is complete.

## Search Display

Server-side `web_search_call` is strictly separated from client function tools. `web_search_call` does not enter the `AITool`, `ToolInvocation`, tool authorization, tool execution, or `function_call_output` paths, and does not create a standalone local stream event.

The provider generates `<query>` child nodes from `web_search_call.action.queries`; it merges structured sources from `web_search_call.action.sources`, `web_search_call.action.url`, and the final message content's `annotations[].url_citation` to generate `<source>` child nodes. `<search>` keeps provider, action, status, query, title, url, type, and additional source attributes; the Android and Web rendering layers preferentially list all clickable sources, each showing the site icon and site name. When a real response has only query terms and no source URLs, the UI lists the query terms, ensuring the user can see that a search did happen this round. A search block follows adjacent thinking and tool calls into the same collapsible group, whose title shows as "thinking and searching" or "thinking, searching, and calling tools" depending on content.

By default, Responses returns call entries and the final answer, and does not provide a standalone tool output equivalent to client function tools. What DeepSeek can currently read stably is `web_search_call.action.queries`; citations may be carried by `url_citation` in the final text, and the complete source list may also live in `web_search_call.action.sources`. The provider only converts these structured fields into display XML; it does not wrap search state into a tool-call row.

`openai:responses_output_item` is a hidden protocol marker; the Android and Web rendering layers and copy-text cleanup do not display it. The user-visible surface keeps only the site icons, site names, and clickable sources in `<search>`, or the query terms when there is no URL.

## Client Function Tool History

When the same assistant round contains both visible text and client function calls, Responses input writes the visible message first, then that round's `function_call`. The corresponding `function_call_output` is written right after, and must not be separated by another message.

`call_id` enters the internal tool-call marker from the Responses output, is written into the corresponding tool-result marker after parallel execution, and the next round binds call and result by that ID, without depending on the completion order of parallel tasks. Old chat records without `call_id` are still read by the positional relationship of the released version.

When a client function call occurs in thinking mode, DeepSeek's returned plain-text `reasoning` item and `message.phase=commentary` both belong to the stateless history that subsequent requests must carry. The `reasoning` item is saved using Responses reasoning hidden metadata, and is restored in the next round's input before the corresponding assistant message and `function_call`; it is also the source of the user-visible `<think>`. The `commentary` message is saved using Responses output item hidden metadata, and the UI does not render that text; when replayed into input, it is rewritten as a `reasoning` item carrying `reasoning_text`. In thinking mode, a `reasoning_text` must precede `function_call`; writing commentary verbatim as an `output_text` message returns 400. Plain-text `reasoning` content must keep the original `reasoning_text` and item ID; OpenAI Responses encrypted reasoning items continue to use the existing `encrypted_content` format.

Saving and restoring `reasoning_text` is handled by `DeepseekResponsesProvider` and `DeepseekResponsesPayloadAdapter`. The generic OpenAI Responses adapter only maintains the OpenAI Responses encrypted reasoning history format.

## Current Boundaries

The `<search>` block currently stores the search queries and source list. If the server's final text contains inline citations, they are still shown as ordinary response text; this protocol does not define an additional inline citation component.
