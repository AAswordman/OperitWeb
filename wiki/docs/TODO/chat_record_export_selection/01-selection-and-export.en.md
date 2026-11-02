# Chat Record Selection and Export

## Current State

The export button in Settings directly exports all chat records. The message totals and long-text progress for HTML and TXT exports are also calculated over all sessions.

## Changes

- Before exporting, show a multi-select list of chat records, supporting single select, multi-select, select all, and clear
- After selection, reuse the existing format-selection dialog
- The export layer writes only the selected sessions, and computes text-export statistics over the selected sessions
- When the selected set is empty, no export runs, and it is not expanded into a full export
- JSON keeps the existing `operit_chat_archive` v2 structure

## Expected Outcome

Users can select one or more sessions to export from "Settings > Data Backup & Restore > Chat Records"; select all still exports all chat records.

## Verification

- `git diff --check` passes
- New resource keys cover all 8 language resource sets
- No build or test was run, following the repository's default execution guidelines

[DONE]
