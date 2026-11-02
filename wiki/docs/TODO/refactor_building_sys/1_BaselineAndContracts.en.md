---
title: Step 1: Baseline and Build Contracts
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 1
depends_on: []
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 1: Baseline and Build Contracts

[Back to master plan](./index.en.md) · [Next step: pnpm Workspace and Lockfile](./2_JsWorkspaceAndLockfile.en.md)

## Old Implementation

- `versionCode` and `versionName` are fixed in `app/build.gradle.kts`
- Node.js, pnpm, JDK, Android SDK, NDK, and Gradle have no unified version manifest
- JS assets, external artifacts, pipeline stages, and the final APK have no common machine-readable manifest format
- The current APK's applicationId, signature, ABI, assets, and native libraries lack comparable baseline records
- There is no written invariant between user-visible capabilities and internal build entries

## Expected New Implementation

- `config/build-system/` holds the toolchain, version metadata, stage contracts, and manifest schemas
- Baseline records can describe APK identity, content, and build inputs
- User-visible capabilities, data formats, and external interfaces form an explicit invariant list
- Later steps use only the fields and version sources established in this step

## Modification Scope

Planned modifications:

- `config/build-system/`
- `ci/script/build_inventory/`
- `docs/TODO/refactor_building_sys/`

This step does not modify:

- Android feature implementations and module structure
- JavaScript dependency tree
- Gradle variants and signing configuration

## Plan

1. Statically inventory current Gradle, package manifests, assets producers, external artifact directories, and patch scripts.
2. Define fields for toolchain, version, pipeline stage, JS assets, external artifacts, and final build manifest.
3. Record exact toolchain versions and their sources; dynamic descriptions such as "latest version" are prohibited.
4. Establish user interface invariants covering feature entries, persisted data, applicationId, and update behavior.
5. Define a baseline collection entry for already-releasable APKs, so it can generate real-package records from a specified APK or pipeline artifact.
6. Establish relative links between manifest schemas and documentation.

## Acceptance

- Every configuration category in `config/build-system/` has a single source of truth
- Manifest fields can express the inputs and artifacts needed by the thirteen subsequent steps
- Unknown values are marked as to-be-confirmed, not filled with guessed values
- The static baseline is consistent with the current repository configuration

## Completion Record

Status: not started. After code, documentation, and authorized verification are complete, add `[DONE]` at the end of the level-1 heading.
