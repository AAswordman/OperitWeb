---
fork: local
status: completed
---

# Dialogue Review Customization and Collapsible Editor

## Original State

After summary generation, `AIMessageManager` programmatically appends the dialogue review at the end of the summary. Users could not disable this module or adjust its title. The four sections of the summary structure also always stayed expanded, and editing one section meant going through the complete editors of the rest.

## Goal

Dialogue review can be enabled or disabled per model configuration, and supports a custom title. The user, assistant, tool-call, and result entries of the review continue to be generated programmatically. The four sections of the summary structure and the dialogue review editor are collapsed by default.

## Scope

- Model configuration and summary configuration passing
- Dialogue review appending
- Context summary settings page
- Localization resources and unit tests

## Steps

- [DONE] 1_dialogue_review_config.md
