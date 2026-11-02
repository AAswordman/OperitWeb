---
title: "Step 9: Variants, Debug Boundaries, Signing, and Version Identity"
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 9
depends_on:
  - 8_FeatureModuleIsolation.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 9: Variants, Debug Boundaries, Signing, and Version Identity

[Previous step: Feature Module Isolation](./8_FeatureModuleIsolation.en.md) · [Back to master plan](./index.en.md) · [Next step: Debug Interface Registry and Data Rescue Shell](./10_DebugInterfaceRegistryAndDataRescueShell.en.md)

## Old Implementation Status

- `clone` and `nightly` both took on debug, co-installation, signing, and update-channel responsibilities
- `nightly` ended up using the debug signature
- `versionCode` and `versionName` were fixed in `app/build.gradle.kts`
- APK renaming depended on the AGP internal type `BaseVariantOutputImpl`
- prod, QA, full, and lite had no independent Gradle dimension
- `ScriptExecutionReceiver`, ToolPkg debug installation, refresh, and DSL dump receiver were in the main Manifest, with `exported=true`
- The debug receiver implementation classes and action strings were in `src/main`, so release APKs also included this code and these entry points
- `GITHUB_CLIENT_SECRET` was written into BuildConfig

## Expected New Implementation Status

- The identity dimension includes `prod` and `qa`
- The capability dimension includes `full` and `lite`
- Build type includes only `debug` and `release`
- Initially only `qaFullDebug`, `qaLiteDebug`, `qaFullRelease`, and `prodFullRelease` are enabled
- QA debug test builds keep full in-app debugging and Shell capability, and allow external ADB to drive generic code, script files, and debug command execution
- QA debug uses an independent QA applicationId and a fixed QA debug signature, and provides stable ToolPkg debugging, package refresh, Compose DSL dump, and QA scenario triggers through named registration interfaces
- QA release and prod release do not include entry points for arbitrary code, script paths, commands, endpoint switching, or ToolPkg debugging driven by external ADB
- QA release and prod release include the same restricted external support gateway, for logs and data rescue
- The in-app Shell executor keeps its original capability in debug and release
- QA release keeps only compile-time-fixed QA service configuration, for official-test verification close to the production environment
- prod release includes only production service configuration
- versionName and monotonically increasing versionCode come from step 1's single version metadata

## Modification Scope

Planned modifications:

- `app/build.gradle.kts`
- Root `build.gradle.kts`
- `app/src/debug/`
- `app/src/release/`
- `app/src/qa/`
- `app/src/prod/`
- full and lite combined source
- Debug receivers, debug assets, and debug-only dependencies
- Network Security Config for debug and release
- `config/build-system/version.*`
- Build logic using the Variant and Artifacts APIs

This step does not modify:

- Feature internal business implementations
- QA offline fixture business data
- Patch generation algorithm

## Plan

1. Declare two flavor dimensions in the order identity, capability.
2. Use the Android Components API to enable only the four approved variants.
3. full explicitly depends on three features; lite does not resolve these modules, nor register their entry points.
4. Establish independent, fixed signature mappings for QA debug, QA release, and prod release.
5. Move debug implementations, Manifests, action resources, and debug-only dependencies out of the main source set, and put the generic `ScriptExecutionReceiver` into the debug source set.
6. QA debug keeps in-app and external-ADB-driven code, script, and Shell debugging capability; named interfaces are used for repeatable automated scenarios.
7. The release source set declares no QA debug components, and does not compile the generic execution receiver or the QA debug gateway. The release support gateway dispatches only explicitly registered support commands.
8. Put QA identity and fixed official-test configuration into the qa source set; put ADB offline endpoints and debug execution entry points into the debug source set.
9. The debug network configuration opens only explicit ports for local fixtures used via ADB reverse; the release network configuration does not accept local plaintext endpoints.
10. Remove client secret injection into the APK; confidential OAuth exchange stays on a controlled server.
11. Provide versionName and versionCode from the single version metadata.
12. Use the public Artifacts API to locate artifacts; delete `clone`, `nightly`, `assembleDebugClone`, and internal artifact APIs.

## Acceptance

- Gradle generates only the four approved variants
- `qaFullDebug` and `qaLiteDebug` keep full in-app debugging and Shell capability, and include the generic `EXECUTE_JS` and named debug interfaces
- The merged Manifests of `qaFullRelease` and `prodFullRelease` contain no generic `EXECUTE_JS` receiver, but include the restricted external support gateway
- The merged Manifests of `qaFullRelease` and `prodFullRelease` contain no debug receivers or debug actions
- Release DEX, assets, and dependency graphs contain no external-ADB generic execution receiver, QA debug gateway, debug component class names, or debug action strings
- The release support command list contains only reviewed log, data rescue, and subsequent restricted support interfaces
- Release APKs set `debuggable=false` and do not accept arbitrary endpoints, script paths, or commands via external ADB
- The in-app Shell executor in release remains usable with existing tool-call paths
- QA release contains only fixed QA service configuration; prod release contains no QA endpoints or client secrets
- Variant names can be used to derive applicationId, signature, capability tier, and service configuration
- lite does not resolve the three features, and contains none of their entry points, assets, or native libraries

## Completion Record

Status: Not started. Before completion, the resolution, assemble, Manifest, DEX, assets, dependency, and network configuration audit results for the four variants need to be recorded.
