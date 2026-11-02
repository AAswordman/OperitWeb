---
title: APK V3 signing rotation
status: draft
document_type: implementation-plan
fork_repository: "https://github.com/AAswordman/Operit.git"
last_reviewed: 2026-08-07
---

# APK V3 Signing Rotation

The current production APK uses only V2 signing with the old release certificate. The old certificate has leaked, and Android 9 and above devices need to be migrated to a new certificate without affecting updates on Android 8 and 8.1.

Release and Nightly keep the same official package name and use dual signing with the old V2 and new V3. Debug uses a separate package name and test keys, so it can be installed side by side with the official build.

## Plan Steps

1. [Release and Nightly dual signing](./01_NightlyAndReleaseDualSigning.en.md)
2. [Debug separate package name and test keys](./02_DebugPackageAndTestKey.en.md)
