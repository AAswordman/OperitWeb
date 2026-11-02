---
title: Step 3: CI and Documentation Migration
status: done
document_type: implementation-step
step: 3
depends_on:
  - 2_GeneratedAssetTask.md
---

# Step 3: CI and Documentation Migration

[Previous step: Generated Assets Task](./2_GeneratedAssetTask.en.md) · [Back to master plan](./index.en.md)

## Previous Implementation

- CI's full Android profile downloads and unpacks `models.zip`
- The README, build guide, and contribution guide require developers to manually download four Google Drive archives

## New Implementation

- The full Android profile downloads only three non-model archives
- CI's Android build prepares STT assets automatically via Gradle
- The documentation states that a first build requires access to the pinned Hugging Face model sources, but does not require manually handling model archives

## Acceptance Criteria

- The dependency scripts and Python unpacker no longer declare `models.zip`
- The Chinese and English READMEs, build guide, contribution guide, and CI documentation remain consistent

## Completion Record

Status: Complete. CI handles only three Drive archives, and generates STT assets cached by manifest hash. [DONE]
