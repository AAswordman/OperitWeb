---
title: Operit Build System Refactoring Master Plan
status: draft
document_type: refactoring-plan-index
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Operit Build System Refactoring Master Plan

This directory is a working draft of the build system refactoring; it does not represent a published or finalized implementation. Each numbered file corresponds to a minimal step that can be independently reviewed and submitted, and each later step depends only on the steps already completed before it.

## Goals

The repository needs a single, auditable build input for JavaScript assets, external binaries, Android modules, APK variants, and patch releases.

User-visible capabilities, data, and external interfaces remain stable. Once the internal build entry points have completed migration, the old npm commands, old Gradle build types, directory scanning, and outdated documentation will be removed.

## Steps

1. [Baseline and Build Contracts](./1_BaselineAndContracts.en.md): Record the current state, and determine the manifest format, tool versions, and user-interface invariants
2. [pnpm workspace and Lockfile](./2_JsWorkspaceAndLockfile.en.md): Unify the dependency inputs of the repository's own JavaScript packages
3. [External Artifact Manifest](./3_ExternalArtifactManifest.en.md): Register the sources and owners of AAR, JAR, JNI, models, and subpack artifacts
4. [Gradle Input Normalization](./4_GradleInputNormalization.en.md): Remove broad dependency scanning and ambiguous `.so` selection rules
5. [Tooling Directory Migration](./5_ToolingDirectoryMigration.en.md): Move scripts, host tools, and app-bundled tools into directories with clear responsibilities
6. [pixi and Asset Preparation Entry Points](./6_PixiAndAssetPreparation.en.md): Unify the entry points for JS assets, artifact verification, and environment reporting
7. [Android Capability Contracts](./7_AndroidCapabilityContracts.en.md): Consolidate the media, speech, and export boundaries within the existing `:app`
8. [Feature Module Isolation](./8_FeatureModuleIsolation.en.md): Move capability implementations and artifacts to a single Android library owner
9. [Variants, Debug Boundaries, Signing, and Version Identity](./9_VariantsSigningAndVersioning.en.md): Establish controlled combinations and isolate debug and release capabilities
10. [Debug Interface Registry and Data Rescue Shell](./10_DebugInterfaceRegistryAndDataRescueShell.en.md): Remove external generic execution and add extensible internal debug entry points
11. [APK Audit and Patch Chain](./11_ApkAuditAndPatch.en.md): Establish APK identity auditing and hard constraints on patch releases
12. [QA ADB Offline Simulation](./12_QaAdbOfflineSimulation.en.md): Verify the plugin marketplace, delta updates, and in-app popup notification pushes
13. [Build Pipeline Contract and Platform Adapters](./13_BuildPipelineContractAndAdapters.en.md): Provide stable stage boundaries for visual CI and GitHub Actions
14. [Documentation Sync and Legacy Path Cleanup](./14_DocumentationAndCleanup.en.md): Update the official development documentation and remove migration-period entry points

## Build Pipeline Stages

The build consists of the following stable stages. A platform may hide stages not selected by a profile, but it must not change stage responsibilities or dependencies.

### Input Validation

1. `source_validate`: Check source state, configuration schemas, approved variants, and path references

### Environment and Dependency Preparation

2. `environment_prepare`: Prepare the pinned toolchain and output an environment report
3. `dependency_prepare`: Run a pnpm frozen install and confirm the Gradle inputs
4. `asset_prepare`: Generate web-chat, toolpkg, bridge assets, and manifests
5. `artifact_verify`: Verify AAR, JAR, JNI, models, and subpack artifacts

### Build

6. `static_verify`: Run the static checks explicitly required by the profile
7. `test_execute`: Run the unit tests or integration tests explicitly required by the profile
8. `android_assemble`: Build the specified and approved APK or AAB variants

### Artifact Validation

9. `package_audit`: Check APK identity, signing, ABI, Manifest, assets, and native libraries
10. `qa_verify`: Run ADB offline simulations of the plugin marketplace, delta updates, and in-app popup notification pushes, plus official-test verification

### Patch and Release

11. `patch_prepare`: Validate the base and target APKs, and generate, rebuild, and cross-check the patch
12. `publish`: Publish the full package, patch, metadata, and audit report under explicit authorization

The `verify`, `build`, `qa`, and `release` profiles explicitly select from the stages above. Each stage calls only one pixi task, and delivers its status and artifacts through a structured report.

These profiles must retain full compile, build, test, audit, patch, and release capabilities. The `For_Agent` in YAML only restricts the agent from running commands in the current session; it does not participate in profile selection, nor does it change build script behavior.

## QA debug and release Boundaries

- `qaFullDebug` and `qaLiteDebug` are full debug test packages, allowing external ADB to submit code, script paths, and debug commands to support exploratory and fully automated debugging
- QA debug also provides named interfaces for stably executing ToolPkg debugging, package refresh, DSL dump, and QA scenarios
- `qaFullRelease` retains the QA applicationId, QA release signing, fixed official-test service configuration, the in-app Shell, and release support interfaces, but contains no external ADB generic execution or arbitrary endpoints
- `prodFullRelease` contains the official identity, official service configuration, the in-app Shell, and the same set of release support interfaces
- The generic execution receiver and the named debug gateway are introduced only through the debug source set, the debug Manifest, and debug-only dependencies
- The in-app ADB/Shell mode continues to use the internal Shell executor and is not restricted by changes to the external debug entry points
- Release retains only explicitly registered external support commands, such as log output and data rescue, and rejects calls from ordinary app UIDs
- Release restrictions are achieved by not compiling QA debug generic execution, not merging the debug Manifest, not packaging debug assets, not resolving debug dependencies, and not accepting plaintext endpoints on the device
- APK auditing must check the release Manifest, DEX, action strings, assets, dependency graph, and network configuration; it must not check only `BuildConfig.DEBUG`

## Execution Constraints

- Each category of input may have only one version-controlled source of truth
- Each binary, asset, and native library may have only one consuming module
- Missing files, hash mismatches, signature mismatches, non-incrementing versions, or unapproved variants terminate the build immediately
- Gradle does not install JS or Python dependencies, download business artifacts, or publish network assets
- QA debug explicitly includes generic code, script, and debug command execution entry points for external ADB
- No release APK contains a generic execution receiver, QA debug gateway, debug assets, or client secret
- Every release APK contains a restricted external support gateway, and provides at least log output, a data rescue path, and data snapshot export
- Prod release contains no QA endpoints or test OAuth configuration

## Target Module Directories

```text
/
	app/
	ci/
		script/
		tools/
	core/
		capability-api/
	feature/
		media/
		speech/
		export/
	tools_built-in/
```

`:app` remains the application shell. The capability API provides stable contracts, and the three feature directories each provide an ordinary Android library.

## Completion Markers

After each step completes its code changes, documentation sync, and the verification required by that step, add `[DONE]` at the end of that file's top-level heading. Only when all fourteen steps are complete may this directory be archived.
