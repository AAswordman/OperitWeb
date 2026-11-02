---
fork: local workspace
---

# Paste Long Text as File

The chat input box directly keeps all pasted text. A large amount of text makes the editor hard to use and may also affect UI responsiveness.

This change only handles the paste delta of the chat input box: when a plain-text paste exceeds the user-configured threshold in length, a UTF-8 text attachment is created and the input content produced by that paste is cleared. Manual attachments, ordinary input, and pastes below the threshold keep their existing behavior.

The scope includes the chat input control, persisted settings, temporary attachment creation, and Chinese/English resources. It does not involve replacing the message protocol or the existing attachment handling flow.

- [01-settings-and-paste-conversion.md](01-settings-and-paste-conversion.en.md)
- [02-localization-and-verification.md](02-localization-and-verification.en.md)
