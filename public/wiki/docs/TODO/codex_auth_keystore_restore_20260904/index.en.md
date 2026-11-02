---
For_Agent: Codex OAuth encrypted prefs use Android Keystore and must not be restored without the original device key.
---

# Codex Auth Keystore Restore Crash

## Previous State

`CodexAuthPreferences` uses `EncryptedSharedPreferences` to store OAuth tokens. Android Auto Backup and device migration copy the `shared_prefs` XML, but the Android Keystore key remains bound to the original device. The restored Tink keyset fails validation against the new device key, throwing `AEADBadTagException` when the model settings page is opened.

## Scope

- `app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt`
- `app/src/main/res/xml/backup_rules.xml`
- `app/src/main/res/xml/data_extraction_rules.xml`

## Expected Outcome

- Android Auto Backup and device migration no longer carry `codex_oauth_credentials.xml`
- An already corrupted Codex OAuth encrypted store is cleaned up in a scoped way; the user returns to the logged-out state and can log in again
- Other SharedPreferences, DataStore, and databases are unaffected
