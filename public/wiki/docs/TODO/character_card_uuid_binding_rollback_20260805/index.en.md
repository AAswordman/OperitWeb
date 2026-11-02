---
title: Chat Character Card UUID Binding Rollback
fork: https://github.com/tuxKOH/Operit
status: complete
---

# Chat Character Card UUID Binding Rollback

## Current Status

The unpublished Issue 864 changed the binding between chats and a single character card from `characterCardName` to `characterCardId`, and changed the Android/Kotlin and assistance2 Rust implementations in sync. That approach broke existing chat bindings.

## Intent of the Change

Thoroughly remove this round of single character card UUID chat binding and restore chats to binding character cards only via `characterCardName`. Delete the related database migrations, persisted fields, propagation chain, and ToolPkg type fields, without retaining a compatibility layer.

A character card's own internal ID, character group `characterGroupId`, and the SoftwareSettings character card management interface are outside the scope of this rollback.

## Steps

1. [Kotlin Chat Binding and Database Rollback](./1_KotlinChatBindingRollback.en.md) [DONE]
2. [Rust and ToolPkg Type Rollback](./2_RustAndToolPkgRollback.en.md) [DONE]
3. [Source Review and Delivery](./3_VerificationAndDelivery.en.md) [DONE]

## Execution Constraints

This task does not execute compile, build, or test commands. It only performs source retrieval, diff review, and blank checks.

[DONE]
