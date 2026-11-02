---
feature: speech-services-settings-ui
status: in-progress
---

# Speech Services Settings Page UI Rearrangement

## Original State

The released version of the speech services settings page stacked TTS, STT, configuration profiles, provider parameters, cleanup rules, and explanatory content continuously in a single long list. After switching the TTS provider, low-frequency JSON parameters and commonly used playback parameters had no clear hierarchy.

## Goal

Without changing the released configuration data, routing, auto-save, or Provider parameter contracts, compress the page into TTS/STT tabs, single-line configuration profile management, compact playback parameters, and expandable low-frequency settings.

## Scope

- `SpeechServicesSettingsScreen.kt`: only adjust the Compose page structure and profile entry presentation.
- `SpeechServicesSettingsPreferences.kt` and Providers: do not modify the data model or runtime contracts.
- Keep all existing TTS/STT fields, profile operations, and test entry points.

## Result

- TTS and STT switch via in-page Tabs, avoiding scrolling through two complete configuration areas on the same screen.
- The current Tab only shows the corresponding configuration profile entry.
- Speech rate and pitch are merged into the same playback parameter area.
- TTS cleanup rules and HTTP low-frequency parameters support collapsing.
