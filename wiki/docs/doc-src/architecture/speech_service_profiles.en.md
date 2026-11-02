# Speech Service Standalone Profiles

## Storage

TTS and STT profiles are stored in a standalone `speech_service_profiles` DataStore. Each profile contains a stable ID, name, creation and update times, and the full parameters for that service type; the DataStore also stores the current profile IDs for TTS and STT.

`SpeechServiceProfilesPreferences` is the sole read/write entry for profiles. Factories, the settings page, chat read-aloud, the floating window, and the built-in software settings tool all read configuration through the current profile.

## Released Version Migration

The released version's single configuration lives in the `speech_services_preferences` DataStore. On first access to the new profile store, migration writes the old TTS and STT configurations as profiles with fixed IDs, and writes a version marker. Repeated access does not create duplicate profiles.

After creating, updating, or switching the current profile, the current profile is synchronously projected to the old DataStore. That projection exists only to preserve compatibility with existing Providers and old-version read interfaces; new code does not select or manage profiles through the old DataStore.

The original snapshot backup already includes the entire app `datastore/` directory, so the new profile store is automatically exported and restored with existing backups.

## Lifecycle Constraints

- When creating a profile, copy the current profile's parameters and assign a new UUID.
- Updating a profile keeps the ID and creation time, changing only the content and update time.
- The current profile cannot be deleted; other profiles can be deleted.
- When a profile is corrupted or missing, report a clear error; do not create an implicit default profile.

## Settings Page Interaction

The settings page separates profile management from the parameter form: the top management card lists the current TTS/STT profiles separately, uses full-row Surface selection for profiles, provides create and rename entries, and deletes non-current profiles in the profile menu. The parameter form is carried by a `LazyColumn`, save exceptions are presented via Snackbar, and the original editing logic for Provider-specific fields is preserved.
