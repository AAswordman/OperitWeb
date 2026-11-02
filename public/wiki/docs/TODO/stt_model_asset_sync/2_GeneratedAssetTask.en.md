---
title: 'Step 2: Generate STT assets Task'
status: done
document_type: implementation-step
step: 2
depends_on:
  - 1_ModelSourceManifest.md
---

# Step 2: Generate STT assets Task

[Previous step: Model Source Manifest](./1_ModelSourceManifest.en.md) · [Back to overall plan](./index.en.md) · [Next step: CI and Documentation Migration](./3_CiAndDocumentationMigration.en.md)

## Old Implementation

- Gradle only read files placed in advance in `src/main/assets/models`
- When models were missing, the build could only wait for developers to manually prepare a Google Drive archive

## New Implementation

- `syncSttModelAssets` uses a version-controlled manifest to download files to `app/build/generated/stt-model-assets`
- Immediately after downloading, size and SHA-256 are verified; failed verification fails the build
- The generated directory serves as an additional assets directory for the main source set
- `preBuild` depends on the sync task, so all Android packaging entry points use the same inputs

## Acceptance

- Task output contains only the assets defined in the manifest
- Model download failure or content mismatch aborts the build
- Runtime assets paths require no changes

## Completion Record

Status: completed. `syncSttModelAssets` prepares the generated directory before `preBuild` and assets merge, and verifies content against the manifest. [DONE]
