---
title: "Step 2: Debug Standalone Package Name and Test Key"
status: draft
document_type: implementation-step
plan_scope: apk-v3-signing-rotation
step: 2
depends_on:
  - 01_NightlyAndReleaseDualSigning.md
fork_repository: "https://github.com/AAswordman/Operit.git"
last_reviewed: 2026-08-07
---

# Step 2: Debug Standalone Package Name and Test Key

## Old Implementation

- Debug uses the official `applicationId`
- When configured with the local official key, Debug is signed with that key
- Debug and the official version cannot be installed side by side
- Dynamic shortcuts fixedly point to the official package name

## Intended Fix

Old Debug APKs have already been released, but the release specification is incomplete. Collaborators installing the official version directly overwrite the old Debug version, without preserving an update or data migration path for the old Debug version.

## Expected New Implementation

- Debug's application ID is `com.ai.assistance.operit.debug`
- Debug uses Android's default debug keystore
- Debug's launcher name is `Operit Debug`
- Debug shortcuts only open the Debug package
- The official version, Nightly, and Debug can be installed side by side

## Change Scope

Modified:

- `app/build.gradle.kts`
- `app/src/debug/res/xml/shortcuts.xml`

Not modified:

- The official and Nightly application IDs
- The official and Nightly rotation signing
- The old Debug APK's update chain and user data

## Acceptance

- The Debug APK package is `com.ai.assistance.operit.debug`
- The Debug signing certificate differs from the official release certificate
- Debug and the official version can be installed at the same time
- Debug shortcuts point to `com.ai.assistance.operit.debug`

## Completion Notes

Status: [DONE].
