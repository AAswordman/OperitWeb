---
fork: local workspace
status: complete
---

# External Native Library Build Verification

## Current State

The Android Gradle Plugin can continue generating an APK or AAB when native inputs generated outside the build chain are missing. Currently, `liboperit_ripgrep.so` is compiled separately by the Rust toolchain and then copied into the app's JNI directory, and FFmpegKit is built into a local AAR by a standalone script; if they are missing, loading fails at runtime.

## Goals

- Check `liboperit_ripgrep.so` and the local FFmpegKit AAR before app packaging starts
- Cover only artifacts built outside Gradle and copied into the app's JNI directory
- Fail packaging immediately on a missing or zero-length native file, and point to the generating script

## Scope

- `app/build.gradle.kts`
- `ci/README.md`
- The implementation records in this directory

## Steps

1. [External Native Library Input Check](./01-external-native-library-input-check.en.md) [DONE]

## PR

To be created

## Completion Status

App packaging now depends on the external native library input check. No Gradle build or test commands were run.
