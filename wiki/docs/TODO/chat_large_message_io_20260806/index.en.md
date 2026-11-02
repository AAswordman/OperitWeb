---
fork: https://github.com/luojiaping/Operit
branch: fix/chat-large-message-io
status: implementation-complete
---

# Oversized Chat Message Read Fix

## Original State

Chat messages and message variants were loaded directly into the Android `CursorWindow` via `SELECT *`. When a single `content` field exceeded the window capacity, `SQLiteBlobTooBigException` was thrown. Chat export was therefore interrupted; and conversation-window queries converted the exception into an empty list, which ultimately showed up as blank content after switching conversations.

## Intent of the Change

Fully preserve existing database content and export format, without truncating messages or adjusting the device-dependent `CursorWindow` capacity. Read queries return only a fixed-size leading segment of text plus the full character count, and the remaining part is read in segments within the same Room transaction and reassembled.

## Scope

- Add `ChatContentDao` to uniformly read the full text of messages and message variants
- Conversation display, runtime context, message variant operations, long-term memory, and chat export switch to the safe read path
- Remove queries in `MessageDao` and `MessageVariantDao` that directly return full large-text rows
- On export failure, delete files that were created but not yet completed
- Database entities, table structure, version number, and archived JSON structure remain unchanged

## Acceptance Criteria

- Conversations containing a message exceeding the Android `CursorWindow` single-row capacity can switch and display normally
- JSON export fully preserves such a message and its variants, with identical content after import
- Ordinary messages continue to be read with a single query
- An export exception leaves no truncated file in the backup directory

Implementation complete. [DONE]
