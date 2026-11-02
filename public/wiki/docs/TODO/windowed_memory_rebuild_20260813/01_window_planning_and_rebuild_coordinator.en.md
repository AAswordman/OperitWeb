# Window Planning and Rebuild Coordinator

Old implementation:

- `MemoryAutoSaveScheduler` only looked back at recent messages from candidate points
- `MemoryLibrary` had already centralized knowledge graph parsing, deduplication, merging, and memory space data updates

Intended fix:

- Split a complete session into a fixed number of user/assistant message windows
- Summary messages do not participate in long-term memory extraction, and do not change the original message window boundaries due to their count
- The coordinator processes windows sequentially, reporting running, completed, failed, and cancelled states to the UI

Expected results:

- A single request stays stable in size, and long chats can be fully traversed
- Each window can still update and merge based on existing memory
- Long sessions with dense summaries still advance by the user-selected window size, without issuing requests based on the number of summaries
- Memory graph output uses named-object JSON, where `main` may be empty and does not block entities, updates, merges, and edges in the same window
- Analysis input removes assistant thinking and tool result body text; candidate retrieval uses limited window context, avoiding short-tail issues bringing unrelated memories into updates

[DONE]
