# UI Relayout Details

## Published Behavior Constraints

- Do not change the JSON, profile IDs, current profile selection, or deletion constraints of `SpeechServiceProfilesPreferences`.
- Do not change the old `SpeechServicesPreferences` projection; existing Providers keep reading the same fields.
- Do not add a second saving mechanism; the page keeps using the existing autosave flow.
- Do not delete any existing Provider configuration field.

## Page Structure

1. In-page Tabs: `TTS` and `STT`.
2. A compact management bar for the current Tab's configuration profiles, keeping create, switch, rename, and delete-non-current-profile.
3. The current Provider and playback parameters shown together.
4. Cleanup regexes and HTTP request parameters shown as expandable sections.
5. The TTS Tab keeps Test TTS; the STT Tab keeps the corresponding engine parameters and descriptions.

## Completion Criteria

- Switching Tabs does not lose editing state.
- Switch, create, rename, and delete profile behaviors are unchanged.
- Every existing TTS Provider can still access its original fields.
- The page no longer renders both complete long TTS and STT forms at the same time.
