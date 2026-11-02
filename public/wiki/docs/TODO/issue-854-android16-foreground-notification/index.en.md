---
fork_repository: local main
issue: https://github.com/AAswordman/Operit/issues/854
---

# Issue 854 Android 16 Foreground Notification

## Current Status

On Android 16 devices, sending a second conversation message may cause the `AIForegroundService` notification to trigger a `BadForegroundServiceNotificationException`. Logs show the system cannot inflate the notification content view and attempts to read a string array resource that does not exist.

The current notification is created via `androidx.core:core-ktx` 1.12.0. That version was released targeting only Android 14, while the app itself already uses the Android 16 SDK.

## Goal

Upgrade the notification compatibility layer to a stable version that supports Android 16, without changing the foreground notification's channel, actions, or visible text.

## Scope

- `gradle/libs.versions.toml`
- The investigation and verification records in this directory

## PR

To be created
