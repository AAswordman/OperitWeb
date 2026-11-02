# Updating the Notification Compatibility Layer

## Old Implementation

The app depends on `androidx.core:core-ktx` 1.12.0. That dependency provides the
`NotificationCompat` implementation used for foreground service notifications, but it was released aligned only up to Android 14.

## Fix Intent

Upgrade the dependency to the Android 16-aligned stable version 1.18.0, so notifications are built by the current platform compatibility implementation.

## Expected Result

On Android 16, publishing AI foreground service notifications no longer receives invalid array resource references, and the existing notification channels and actions remain unchanged.

## Verification

No build or test was performed for this change, following the repository's execution guidelines. Before release, the flow from Issue 854 — sharing an attachment and then sending two consecutive messages — should be repeated on an Android 16 device.

[DONE]
