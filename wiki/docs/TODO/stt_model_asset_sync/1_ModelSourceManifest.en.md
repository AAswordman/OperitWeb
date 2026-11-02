---
title: Step 1: STT Model Source Manifest
status: done
document_type: implementation-step
step: 1
---

# Step 1: STT Model Source Manifest

[Back to master plan](./index.en.md) · [Next step: Generated Assets Task](./2_GeneratedAssetTask.en.md)

## Previous Implementation

- `models.zip` provides the default Sherpa NCNN models and the Silero VAD model
- Build inputs have no per-file version or integrity records

## New Implementation

- `app/config/stt-model-assets.properties` records eight input files
- The Sherpa NCNN files come from the public `csukuangfj/sherpa-ncnn-streaming-zipformer-bilingual-zh-en-2023-02-13` commit `05945efc40afe4b572542f01104ca5c413a9f6e1`
- Silero VAD uses exactly the same public Hugging Face files as the existing assets
- Each entry records the target path, size, and SHA-256

## Acceptance Criteria

- The existing assets manifest matches the manifest's file sizes and SHA-256 values
- The revision and source paths can directly construct immutable download URLs

## Completion Record

Status: Complete. `app/config/stt-model-assets.properties` records the eight assets, pinned sources, sizes, and SHA-256 values for the default STT. [DONE]
