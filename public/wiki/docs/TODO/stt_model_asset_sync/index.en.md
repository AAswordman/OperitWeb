---
title: STT Model Build-Time Automatic Preparation
status: done
document_type: implementation-plan
fork_repository: "https://github.com/AAswordman/Operit"
last_reviewed: 2026-07-25
---

# STT Model Build-Time Automatic Preparation

[Model Source Manifest](./1_ModelSourceManifest.en.md) · [Generated Assets Task](./2_GeneratedAssetTask.en.md) · [CI and Documentation Migration](./3_CiAndDocumentationMigration.en.md)

## Goal

The default Sherpa NCNN local speech recognition model is automatically fetched from Hugging Face at Android build time, and enters the APK at the existing `models/` assets path.

## Old Implementation

- A full Android build downloaded `models.zip` from Google Drive
- Model files were extracted to `app/src/main/assets/models`
- `SherpaSpeechProvider` copied the models from that assets directory, then created the recognizer via file paths
- Model source, revision, and file hashes had no version-controlled declaration

## Expected New Implementation

- The model manifest pins the Hugging Face repository, commit, file paths, sizes, and SHA-256 values
- Gradle prepares the managed generated assets directory before `preBuild`
- The current `models/<model directory>` resource paths and runtime loading behavior stay unchanged
- Google Drive only keeps the non-model `libs.zip`, `subpack.zip`, and `jniLibs.zip`

## Change Scope

- `app/config/`
- `app/build.gradle.kts`
- Android dependency download and unpack scripts
- Android build and contributor documentation

## Acceptance

- A clean working tree running an Android package does not need `models.zip`
- All eight STT files in the generated assets pass the declared SHA-256 and size checks
- The model path inside the APK remains `models/sherpa-ncnn-streaming-zipformer-bilingual-zh-en-2023-02-13/...`
- CI no longer requests `models.zip` from Google Drive

## Completion Record

Status: completed. No Gradle build or test was run in this round; per the repository's execution rules, those are reserved for an explicit verification request. [DONE]
