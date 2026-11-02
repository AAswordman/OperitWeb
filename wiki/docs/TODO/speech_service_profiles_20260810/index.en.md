---
feature: speech-service-profiles
branch: feat/speech-service-profiles
status: done
---

# Speech Service Standalone Configuration Profiles

## Original Situation

The released version saves TTS and STT configurations as one current service type each and one shared HTTP configuration. Switching providers reuses the same fields, so multiple sets of models, endpoints, keys, and voices cannot be saved at the same time.

## Goal

Introduce standalone TTS and STT configuration profiles, each with a stable ID, display name, service parameters, creation time, and update time; at runtime only the currently selected profile is read. On first read, convert the old preferences into profiles, and keep the old preference interface as a migration and compatibility projection for existing Providers.

## Migration Contract

- The old TTS current configuration generates a TTS profile, preserving service type, HTTP/VITS parameters, cleanup rules, speech rate, and pitch.
- The old STT current configuration generates an STT profile, preserving service type, endpoint, key, and model.
- Migration uses fixed profile IDs and a version marker, runs only once, and does not create duplicate profiles when profiles already exist.
- The current profile cannot be deleted; after creating, updating, or switching, the old preference projection is synced so existing Providers continue to receive the same parameters during migration.

## Scope

- `SpeechServiceProfilesPreferences.kt`: model, storage, migration, and profile management.
- TTS/STT factories: read by profile and maintain the active projection required by old Providers.
- `SpeechServicesSettingsScreen.kt`: standalone profile management card, select/create/rename/delete, and existing parameter editing.
- Related development documentation and static check notes.

## Steps

1. [Migration contract and runtime integration [DONE]](./01_migration_contract.en.md)
2. Settings page profile management aligned with model configuration page interaction [DONE]

[DONE]
