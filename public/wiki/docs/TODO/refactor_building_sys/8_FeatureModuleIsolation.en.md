---
title: Step 8: Feature Module Isolation
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 8
depends_on:
  - 7_AndroidCapabilityContracts.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 8: Feature Module Isolation

[Previous step: Android Capability Contracts](./7_AndroidCapabilityContracts.en.md) · [Back to master plan](./index.en.md) · [Next step: Variants, Signing, and Version Identity](./9_VariantsSigningAndVersioning.en.md)

## Old Implementation

- `:app` simultaneously owns the app shell, capability implementations, assets, and the Sherpa native build
- FFmpeg, models, subpack, and feature code have no independent Gradle owners
- All capability dependencies go into the same application module
- The existing module graph cannot produce an APK without optional capabilities
- Features lack a dependency direction enforceable by Gradle

## Expected New Implementation

- `:app` remains the sole application shell
- `:core:capability-api` holds only stable contracts and the registration model
- `:feature:media` owns the FFmpeg implementation, dependencies, resources, and licenses
- `:feature:speech` owns the speech implementation, models, Sherpa native build, and licenses
- `:feature:export` owns the export implementation, subpack, resources, and licenses
- Features depend only on the capability API; there are no direct dependencies between features

## Modification Scope

Planned modifications:

- `settings.gradle.kts`
- `core/capability-api/`
- `feature/media/`
- `feature/speech/`
- `feature/export/`
- `app/build.gradle.kts`
- `app/src/main/`

This step does not modify:

- prod and QA install identities
- full and lite product flavors
- APK release and patch scripts

## Plan

1. Create the capability API and three plain Android library modules.
2. Move the step 6 contracts into the capability API, keeping the call interfaces unchanged.
3. Move the media implementation, FFmpeg binaries, and related resources into the media module.
4. Move the speech implementation, models, CMake configuration, and Sherpa native source boundaries into the speech module.
5. Move the export implementation, subpack, and related UI resources into the export module.
6. Move consumer rules, Manifest entries, dependencies, and license notes to their respective owners.
7. At the end of this step, let `:app` continue to combine all three features, keeping the original capabilities intact.
8. Statically check module dependency direction and duplicate resource owners.

## Acceptance

- Each feature can independently resolve its own dependencies and resources
- The `:app` main source set owns no optional artifacts
- There are no direct or circular dependencies between features
- Each asset, AAR, JAR, and native target has exactly one module owner
- The full-combination user capabilities match those before step 6

## Completion Record

Status: not started. Before completion, module resolution, compilation, and resource check results need to be recorded.
