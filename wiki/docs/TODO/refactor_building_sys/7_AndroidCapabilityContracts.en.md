---
title: Step 7: Android Capability Contracts
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 7
depends_on:
  - 6_PixiAndAssetPreparation.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 7: Android Capability Contracts

[Previous step: pixi and Asset Preparation Entry](./6_PixiAndAssetPreparation.en.md) · [Back to the master plan](./index.en.md) · [Next step: Feature Module Isolation](./8_FeatureModuleIsolation.en.md)

## Previous Implementation

- `app/src/main` directly imports FFmpegKit types
- The speech implementation directly manages Sherpa model paths and native initialization
- Chat and toolbox UI directly call the Android and Windows export implementations
- Base source directly reads `models/` and `subpack/` assets
- Feature entries, tool registration, routing, and concrete SDK types have no stable boundary

## Expected New Implementation

- Media, speech, and export each have a stable capability contract
- Callers in `:app` depend only on the contracts and state models
- Concrete SDKs, asset paths, and native loading appear only at the corresponding implementation boundaries
- The feature registry explicitly declares the implementations included in the current build
- User-visible operations, data formats, and public call contracts are consistent with the previous implementation

## Change Scope

Planned changes:

- `app/src/main/java/com/ai/assistance/operit/core/`
- `app/src/main/java/com/ai/assistance/operit/ui/`
- `app/src/main/java/com/ai/assistance/operit/util/FFmpegUtil.kt`
- Speech service, settings, export flow, and tool registration related source
- Unit test source corresponding to the capability boundaries

This step does not change:

- The Gradle module list
- The physical directories of models, subpack, and local binaries
- Product flavors, applicationId, and signing

## Plan

1. Define the input, output, state, and error contracts for media execution, speech recognition, and export capabilities.
2. Establish an explicit capability registry, with the current `:app` combining all existing implementations.
3. Consolidate FFmpegKit imports and execution code into the media implementation package.
4. Consolidate Sherpa model paths, native initialization, services, and settings entries into the speech implementation package.
5. Consolidate subpack access, export UI, and the Android and Windows export implementations into the export implementation package.
6. Rework chat, toolbox, navigation, and tool registration so they depend only on the contracts.
7. Add debug comments explaining the intent of the changes, recording why direct dependencies would break the lite compilation boundary.

## Acceptance

- Base callers no longer import FFmpegKit or Sherpa implementation types
- Base callers no longer contain models or subpack paths or optional native loading
- The capability registry matches the user-visible entries
- Previous interfaces, data, and functional behavior remain unchanged
- Error paths have explicit logs and do not hide errors

## Completion Record

Status: Not started. Compilation and test results need to be recorded before completion.
