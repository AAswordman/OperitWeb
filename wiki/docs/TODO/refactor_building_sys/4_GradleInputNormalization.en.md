---
title: "Step 4: Gradle Input Normalization"
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 4
depends_on:
  - 3_ExternalArtifactManifest.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 4: Gradle Input Normalization

[Previous step: External Artifact Manifest](./3_ExternalArtifactManifest.en.md) · [Back to master plan](./index.en.md) · [Next step: Tooling Directory Migration](./5_ToolingDirectoryMigration.en.md)

## Legacy Implementation Status

- `app/libs` unconditionally accepts all AARs and JARs via `implementation(fileTree(...))`
- `packaging.resources` contains a broad `pickFirsts += "**/*.so"`
- Local binaries and native libraries have no Gradle input validation
- The Gradle Wrapper uses a single mirror address; the PR gate refactoring has already added the official Gradle 8.13 `distributionSha256Sum`
- Current dependency declarations cannot be traced from the Gradle graph back to the step 3 artifact manifest

## Expected New Implementation Status

- Local AARs and JARs are declared with exact filenames
- JNI and native conflicts are resolved by removing duplicate providers
- Gradle validates artifact filenames, hashes, ABIs, and owners before resolving related tasks
- The Wrapper uses the single project-confirmed address and the official Gradle SHA-256
- Gradle only consumes files already confirmed in the step 3 manifest

## Change Scope

Planned changes:

- `app/build.gradle.kts`
- `gradle/wrapper/gradle-wrapper.properties`
- `config/build-system/artifacts/`
- build logic related to Gradle input validation

This step does not change:

- Android source capability boundaries
- product flavors and build types
- JS assets production tasks

## Plan

1. Replace `fileTree` with precise dependency declarations for manifest-confirmed files.
2. Remove the broad `.so` selection rule and remove duplicate native providers.
3. Move the consumer-less `arsc.jar` and other files out of the build inputs.
4. Add a read-only Gradle input validation task that outputs an auditable report.
5. Write the official Wrapper SHA-256 and verify that the current distribution address matches its content.
6. Statically scan the Gradle configuration to confirm no other local directory dependency scanning exists.

## Acceptance

- Gradle dependency declarations contain no local AAR or JAR wildcard scanning
- `.so` has no broad `pickFirst` rule
- The manifest and Gradle-consumed files correspond one-to-one
- The Wrapper URL and SHA-256 point to the same release content
- Input errors terminate explicitly, without selecting another file or address

## Completion Record

Status: Partially prepared. The Wrapper checksum has been written; the rest of this step's input normalization has not yet started, and Gradle resolution and compilation verification results still need to be recorded before completion.
