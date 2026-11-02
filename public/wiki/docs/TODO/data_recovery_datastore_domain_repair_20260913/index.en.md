---
Repository: https://github.com/AAswordman/Operit
Branch: feat/data-recovery-datastore-domain-repair
Status: in-progress
---

# Data Recovery DataStore Domain Repair

## Original State

Data recovery can already check whether Preferences protobuf is readable, and delete undecodable files after preserving them. Corrupted JSON, dangling model references, and illegal memory space IDs inside readable files are still left as-is. PR #1006 has a complete DataStore domain repair, but it is bound to the startup flow and dual-slot recovery, so it cannot be merged as a whole package.

## Intent

- Extract the Preferences domain repair from #1006 and connect it to the existing user-triggered automatic repair
- Do not connect it to the startup flow, do not replace the existing DataStore owner, and do not introduce dual-slot or ObjectBox recovery
- Checks still use an isolated copy; before writing, preserve the original, and require the main process to have stopped

## Scope

- `PreferencesHealthManager` checks and repairs
- Domain validation adapted from #1006: model configuration, feature mapping, character cards, character groups, API settings, memory space index
- Data recovery UI repair plan copy
- Developer documentation and JVM tests

## Non-Goals

- Pre-checks or automatic repair at startup
- RecoverablePreferencesDataStore / dual-slot snapshots
- ObjectBox discovery and recovery
- Voice profile migration-style repair
- Modifying business DataStore declarations
