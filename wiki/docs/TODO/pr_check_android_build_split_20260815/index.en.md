---
title: PR Check Android Build and Unit Test Split
repo: https://github.com/luojiaping/Operit
upstream: https://github.com/AAswordman/Operit
status: verified
---

# PR Check Android Build and Unit Test Split

## Original State

The full Android lane of PR Check ran `assembleDebug` and
`:app:testDebugUnitTest` in the same job. The Android Build workflow also continued to run JVM unit tests after compilation,
so unit test issues and build issues shared failure boundaries, runner time, and artifact upload conditions.

## Intent of the Change

- The Android build job is only responsible for preparing packaging inputs, running compilation, and uploading Android artifacts
- The Android JVM test job independently runs unit tests and the necessary AndroidTest compilation
- The PR's build and unit test results are visible separately, and unit test failures do not block APK compilation
- Keep the existing `PR Check / Candidate checks` aggregate status name
- Keep merge candidate validation, permission limits, and fork safety boundaries

## Scope

- `.github/workflows/pr-check.yml`
- `.github/workflows/android-build.yml`
- `.github/workflows/android-tests.yml`
- `ci/script/pr_check.py` and related tests
- `ci/README.md`, developer CI documentation, and this TODO directory

## Steps

1. [Job boundaries and status contract](./1_JobBoundaries.en.md)
2. [Workflow implementation](./2_WorkflowImplementation.en.md)
3. [Verification and fork testing](./3_Verification.en.md)

## Current Status

- [x] Completed the build/test job split in the PR workflow
- [x] Completed the pure-build conversion of the trusted Android workflow
- [x] Added the standalone test workflow and documentation
- [x] Passed YAML, actionlint, and CI gate unit tests
- [x] Verified independent execution of the build/test jobs on a fork's PR/Actions
- [x] Fixed the Android JVM test source and test fixture errors exposed by fork verification
- [x] Completed fork Actions verification after the cancellation assertion fix
