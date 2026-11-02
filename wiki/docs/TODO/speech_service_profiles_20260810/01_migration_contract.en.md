# Migration and Runtime Contract

## Old Data Source

Old data lives in the `speech_services_preferences` DataStore. For TTS, the service type, HTTP configuration, VITS configuration, cleanup rules, speech rate, and pitch are read separately; for STT, the service type and HTTP configuration are read. When old keys are missing, the app's existing defaults are used, ensuring fresh-install users still get system TTS and local Sherpa STT profiles.

## New Data Shape

The new store uses a separate `speech_service_profiles` DataStore:

- TTS profile list and current profile ID
- STT profile list and current profile ID
- Migration version marker

Each profile is saved as JSON, and configuration fields continue to reuse the structures understood by existing Providers, avoiding rewriting provider protocols during migration.

## Lifecycle

A migration check runs before reading, creating, updating, deleting, or switching profiles. The version marker is set after migration completes. The current profile cannot be deleted; switching and saving update the old preference projection and reset the corresponding service instance.

[DONE]
