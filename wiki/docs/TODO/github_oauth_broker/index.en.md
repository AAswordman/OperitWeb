---
fork: https://github.com/AAswordman/Operit
---

# GitHub OAuth Broker

## Background

The Android client used to write the GitHub OAuth client secret into BuildConfig and exchange authorization codes directly on the device. That secret shipped with released APKs and can no longer be treated as a trusted credential.

## Goals

- New Android versions complete the GitHub authorization code exchange only through the protected Worker on `api.operit.app`
- New APKs no longer contain the client ID, client secret, or the `operit://` OAuth callback
- Already released old APKs keep using the original OAuth App until the migration deadline set in the published announcement
- The new OAuth App's client secret exists only in the Cloudflare Worker secret

## Scope

- Backend: `D:\Code\prog\assistance_web\workers\market`
- Android: GitHub login coordinator, generic browser callback component, auth preferences, and Android Manifest
- Operit 2: Rust CLI and Flutter marketplace login
- Development: edit directly in the `main` workspaces of both repositories, deploying the backend before Android

## Status

- Cloud secrets configured, new OAuth App created
- D1 migration applied
- Worker deployment pending cleanup of the backend's existing uncommitted marketplace changes
- Operit 2 client migration in progress; existing compile issues in the CLI package are unrelated to this protocol
