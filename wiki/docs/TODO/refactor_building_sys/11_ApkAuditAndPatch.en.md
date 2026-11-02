---
title: Step 11: APK Audit and Patch Chain
status: draft
document_type: implementation-step
plan_scope: apk-audit-and-patch
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 11
depends_on:
  - 10_DebugInterfaceRegistryAndDataRescueShell.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 11: APK Audit and Patch Chain

[Previous step: Debug Interface Registry and Data Rescue Shell](./10_DebugInterfaceRegistryAndDataRescueShell.en.md) · [Back to master plan](./index.en.md) · [Next step: QA ADB Offline Simulation](./12_QaAdbOfflineSimulation.en.md)

## Old Implementation

- `nightly_auto.py` chooses `assembleRelease` or `assembleNightly` on its own and infers the APK file name
- Patch metadata contains the APK hash, but has no unified association of JS, artifacts, toolchain, and variant list
- The `nightly` debug signature cannot form the same update chain as the official release
- The release APK lacks a real-package audit for arbitrary-execution code, debug actions, and debug assets
- The identity and configuration isolation between the official package and the QA package lacks a real-package audit

## Expected New Implementation

- Every APK has a build manifest and a content audit report
- prod, QA, and different capability tiers each have their own patch chain
- Before a patch is published, applicationId, signature, versionCode, ABI, capability tier, and base APK hash are checked
- APK auditing can prove that QA debug has both generic execution and named interfaces, and prove that release contains only approved support commands
- External CI only invokes pixi-managed Android, audit, and patch tasks

## Modification Scope

Planned modifications:

- `ci/script/android/`
- `ci/script/patch/`
- `ci/script/hotbuild/`
- Build manifest, APK audit report, and patch metadata schema

This step does not modify:

- The business contracts of the capability API
- Feature module ownership
- Official user data formats

## Plan

1. Set up `android-assemble` and `apk-audit` tasks, validating the JS and external artifact manifests first.
2. The build manifest records the Git revision, tool versions, input manifest hash, variants, versionCode, signature digest, and APK hash.
3. APK auditing checks applicationId, signature, ABI, assets, native libraries, and Manifest components.
4. Build a debug entry allowlist for the QA debug APK, confirming that the generic `EXECUTE_JS` and named interfaces exist as planned.
5. Build an exported component and support command allowlist for the release APK, with explicit non-existence assertions for generic-execution DEX classes, QA debug actions, debug assets, debug dependencies, and local endpoints.
6. Verify that an ordinary app UID calling the release support gateway is rejected, and that ADB shell can read logs and perform data rescue export.
7. Rework hotbuild so it reads the build manifest and public artifact locations instead of inferring the old build type or file name.
8. After patch generation, rebuild the target APK and check the target SHA-256.

## Acceptance

- The build manifest, APK audit report, and patch metadata can be traced against each other
- The base and target APKs have the same applicationId and signature
- The target versionCode is strictly greater than the base versionCode
- The capability tier, ABI, and built-in artifact combination are exactly identical
- The QA and prod update chains are isolated
- The QA debug APK's generic execution entry, named ADB interfaces, and allowlist are consistent, and the in-app Shell capability does not participate in that restriction
- QA release and prod release contain no external ADB generic-execution receiver, QA debug gateway, debug action, or debug assets
- QA release and prod release contain a consistent support command allowlist, and logs and data rescue can be invoked from ADB shell
- An ordinary app UID cannot invoke release support commands
- The in-app Shell executor of QA release and prod release remains available
- Prod release contains no QA test configuration

## Completion Record

Status: not started. Before completion, the results of APK builds, device tests, patch rebuilds, and release verification need to be recorded.
