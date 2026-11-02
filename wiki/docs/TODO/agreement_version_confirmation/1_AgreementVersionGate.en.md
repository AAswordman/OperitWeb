---
title: Step 1: Agreement Version Gate
status: completed
document_type: implementation-step
step: 1
depends_on: []
last_reviewed: 2026-07-15
---

# Step 1: Agreement Version Gate [DONE]

[Back to the overall plan](./index.en.md)

## Old Implementation

- `agreement_preferences` only stores the `agreement_accepted` boolean
- The startup flow only checks that boolean
- After the agreement resource text is modified, users who already accepted the old version are not asked to confirm again

## Expected New Implementation

- The app maintains a current agreement version constant
- Preferences store the agreement version the user has confirmed
- Only users who have confirmed the current version can enter the main app
- Old versions with no version confirmation record do not satisfy the current version's confirmation requirement
- The agreement screen displays the current version

## Scope of Changes

- `app/src/main/java/com/ai/assistance/operit/data/preferences/AgreementPreferences.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt`
- `app/src/main/res/values*/strings.xml`

## Acceptance

- Newly installed users save the current version after confirming the agreement
- Users on an installed old version see the agreement page again after upgrading
- When the current agreement version is raised, users who confirmed the old version see the agreement page again
- The in-app agreement viewing entry does not change the user's confirmed version

## Completion Record

Status: completed. Source references, version resources, and diff static checks have been completed; no compile, build, or test commands were executed.
