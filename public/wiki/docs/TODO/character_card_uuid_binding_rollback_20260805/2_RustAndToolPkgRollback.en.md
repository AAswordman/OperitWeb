---
title: Rust and ToolPkg Type Rollback
status: complete
---

# Rust and ToolPkg Type Rollback

## Old Implementation

The assistance2 Rust chat model, SQLite `23 -> 24` migration, runtime binding chain, and ToolPkg SDK output simultaneously added a single-character-card `character_card_id`.

## Rollback Contents

- Remove the single-character-card ID from the Rust chat model, SQLite, and binding chain
- Remove that field from ToolPkg results and TypeScript types
- Restore single-character-card chat semantics keyed on `character_card_name`

[DONE]
