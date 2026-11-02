# Job Boundaries and Status Contract

## Current State

`Candidate checks` simultaneously handles scope planning, fast checks, JavaScript-specific checks, Android
resource compilation, dependency preparation, and the full Android Gradle check.

## Goals

- `Fast checks` handles planning, fast gates, the resource lane, WebChat, and ToolPkg-specific checks
- `Android build` runs `assembleDebug` only on `android_full`
- `Android JVM tests` runs JVM unit tests on `android_jvm` or `android_full`
- Both Android jobs are based on the same merge candidate, but each has a clean workspace
- The new job results are aggregated by the final `Candidate checks`

## Constraints

- A PR with only fast gates must not fail because an Android job does not exist
- The Android build must generate the WebChat and ToolPkg Gradle inputs itself
- The JVM test job must prepare the Gradle dependencies and native ripgrep itself
- Do not pass an unaudited workspace between jobs; use the existing caches and candidate checkout
