---
title: Step 3: External Artifact Manifest
status: draft
document_type: implementation-step
For_Agent: Do not execute compile, build, test, or publish commands without the user's explicit authorization
step: 3
depends_on:
  - 2_JsWorkspaceAndLockfile.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 3: External Artifact Manifest

[Previous step: pnpm Workspace and Lockfile](./2_JsWorkspaceAndLockfile.en.md) · [Back to master plan](./index.en.md) · [Next step: Gradle Input Normalization](./4_GradleInputNormalization.en.md)

## Previous Implementation

- `libs.zip`, `jniLibs.zip`, and `subpack.zip` are prepared by processes outside the repository; the default STT model has been migrated to the Gradle asset generation flow
- The three non-model target directories in the current working tree contain only `.keep`
- Gradle cannot state the source, version, license, hash, and unique consumer of local files
- The original plan recorded some archive contents, but the current working tree cannot directly prove those records
- `arsc.jar` has no current consumer; the GIF native library is provided by Maven's `android-gif-drawable` and matches the archived copy
- The sole owner of `libc++_shared.so` still requires an audit to be completed

## Expected New Implementation

- A version-controlled manifest registers all external archives and unpacked files
- Each entry has a source, version, license, SHA-256, size, ABI, and unique consumer
- Undeclared files, duplicate owners, hash mismatches, ABI mismatches, and out-of-bounds archives are all rejected
- Sherpa source build targets and the prebuilt libraries in `jniLibs.zip` are registered separately

## Change Scope

Planned changes:

- `config/build-system/artifacts/`
- Records in `docs/licenses/` corresponding to external artifacts
- `docs/TODO/refactor_building_sys/`

This step does not change:

- The dependency declarations in `app/build.gradle.kts`
- feature module directories
- The business content of external artifacts

## Plan

1. Obtain the three actual archives, and compute SHA-256 and sizes for the archives themselves and for the unpacked files.
2. Inspect AARs, JARs, Manifests, classes, native libraries, ABIs, and licenses.
3. Search for source imports, bytecode references, and runtime load points for `arsc.jar`. [DONE: Currently no consumer]
4. List all providers of each identically named `.so`, confirming the unique owner of the GIF native library and the C++ runtime. [Partially done: The GIF library's SHA-256 matches the Maven copy]
5. Register source native targets such as Sherpa NCNN, Sherpa MNN, streamnative, and ripgrep.
6. Write the manifest, and have each target path map to only one consumer.

## Acceptance

- The manifest covers the actual archives and all unpacked files
- Every file has a real hash, license, ABI, and unique consumer
- Files with no consumer are marked as deletion candidates
- Artifacts that cannot currently be obtained remain unconfirmed, with no speculative content written in

## Completion Record

Status: Not started. Artifact inspection requires the actual archives; without them, this step cannot be marked complete.
