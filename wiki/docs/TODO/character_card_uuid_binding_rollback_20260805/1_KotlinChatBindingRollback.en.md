---
title: Kotlin chat binding and database rollback
status: complete
---

# Kotlin Chat Binding and Database Rollback

## Old Implementation

Android chat entities, the Room `20 -> 21` migration, DAO queries, chat creation and updates, the HTTP bridge, and the Compose UI all used `characterCardId` to identify single character card chats.

## Rollback Contents

- Remove `characterCardId` from the chat model and Room
- Remove the `20 -> 21` migration and the data migration code added in this change
- Restore single character card chat filtering, creation, updates, branching, and import/export to `characterCardName`
- Remove this field from chat ToolPkg results, the JavaScript bridge, and UI state
- Keep `characterGroupId` and the character card internal configuration ID

[DONE]
