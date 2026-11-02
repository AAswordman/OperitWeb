---
Fork: https://github.com/AAswordman/Operit.git
---

# Market Version Range Download State

The plugin market already displays the application version range declared by the publisher, but the list download entry does not change state according to that range, and the disabled download button on the detail page has no clear risk visual cue.

This change will use the application's current version and the latest plugin version's range to decide. When out of range, the list entry shows a warning unavailable state, and the detail page entry shows a warning-colored disabled state. The install flow, market interfaces, and range rules stay unchanged.

Scope:

- `ui/features/packages/market/`
- `ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt`

Related implementation: [Version Range Button State](1_VersionRangeButtonState.en.md)
