---
title: Android CI Cache and ARM64 Build Optimization
repo: https://github.com/luojiaping/Operit
upstream: https://github.com/AAswordman/Operit
status: verified
---

# Android CI Cache and ARM64 Build Optimization

## Original State

Android CI explicitly used `--no-build-cache`, and the JDK setup did not enable Gradle dependency and Wrapper caching. CMake dependency sources were located in each module's `.cxx/operit_deps`, and every runner re-downloaded them. The native ripgrep cache key only included the system and `Cargo.lock`, without binding NDK, Rust, Android API, or runner architecture.

The DragonBones native module declared no ABI filter, while the app and other native modules only supported `arm64-v8a`.

## Intent of the Changes

- Let Gradle reuse dependencies, the Wrapper, and a reusable build cache
- Let CMake reuse only source trees with toolchain and source configuration keys, not binary trees carrying absolute paths
- Let the native ripgrep cache key cover the actual compilation environment
- Align DragonBones' native compilation scope with the app's supported `arm64-v8a`

## Scope

- `.github/workflows/android-build.yml`
- `.github/workflows/android-tests.yml`
- `.github/workflows/pr-check.yml`
- `avator/dragonbones/build.gradle.kts`
- `app/build.gradle.kts`
- This TODO directory

## Verification

- [x] Passed workflow YAML, repository gates, and diff checks
- [x] Pushed `ci/android-cache-optimization` to the fork
- [x] Verified Android build and Android JVM tests in fork PR [#16](https://github.com/luojiaping/Operit/pull/16)
- [x] Confirmed Gradle, CMake source, and native ripgrep cache hits across consecutive runs
- [x] Native packaging paths in the build logs use only `lib/arm64-v8a/`

## Results

Fork run `31875454511` passed `Fast checks`, `Android JVM tests`, `Android build`, and `Candidate checks` on both attempts.

- First Android build: Gradle `24m31s`, with `29` of `329` actionable tasks coming from cache; CMake source cache missed on first use, and saved about `337 MB` after completion
- Second Android build: Gradle `15m46s`, job total time about `17m51s`, with `116` of `329` actionable tasks coming from cache
- Second run logs confirmed Gradle wrapper/dependency, CMake source, and native ripgrep cache hits
- Android JVM tests dropped from about `11m04s` on the first run to about `2m28s` on the second
