---
title: "Step 1: Release and Nightly Dual Signing"
status: draft
document_type: implementation-step
plan_scope: apk-v3-signing-rotation
step: 1
fork_repository: "https://github.com/AAswordman/Operit.git"
last_reviewed: 2026-08-07
---

# Step 1: Release and Nightly Dual Signing

## Old Implementation

- `tools/hotbuild/nightly_auto.py` uses the Gradle artifact directly after building a Release or Nightly APK
- Release uses the current release key
- Nightly uses the debug key
- There is no APK Signature Scheme v3 rotation chain

## Expected New Implementation

- After the script builds Release or Nightly, it writes the V2 signature with the old release key
- The script writes the V3 signature with the new release key and the already-generated lineage
- Android 8 and 8.1 keep the old certificate update chain
- Android 9 and above migrate to the new certificate update chain
- Debug does not enter the dual-signing task for official APKs

## Change Scope

Modified:

- `app/build.gradle.kts`
- `local.properties.example`
- `.gitignore`

Not modified:

- App business code
- Gradle build type definitions
- `tools/hotbuild/nightly_auto.py`, which continues to call the original Gradle assemble tasks
- Debug signing policy, handled by the next step
- GitHub Actions release flow

## Acceptance

- Both Release and Nightly artifacts report valid V2 and V3 signatures
- V2 uses the current release certificate
- The V3 lineage points from the current release certificate to the new release certificate
- Debug artifacts do not enter the dual-signing flow

## Completion Notes

Status: [DONE].
