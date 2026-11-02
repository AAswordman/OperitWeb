# Quick Configuration Validation and UI [DONE]

## Old Implementation

Quick configuration treated any non-empty text as an API Key, and hid the onboarding via session-level boolean state. The custom entry was a low-recognizability text button.

## Change Scope

- Extract network-independent API Key normalization and format determination
- Before saving, reject Chinese characters, whitespace, control characters, and invisible characters
- Change the custom entry to a full-width outlined button with an adjustment icon
- Update the first-time configuration copy and input error states
- Make the onboarding display state follow the actual conversation configuration

## Completion Criteria

A legal printable half-width API Key can be saved, incorrect input gets a clear prompt, and quick configuration and other model configurations have a clear primary/secondary operation hierarchy.
