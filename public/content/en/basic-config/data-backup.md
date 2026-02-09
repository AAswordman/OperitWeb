### Data Backup & Restore

In Operit AI, go to `Settings` -> `Data Backup & Restore` to view all backup and restore options.

By default, backup files are stored under: `Download/Operit/backup/` (organized by subfolders per type).

#### Backup Type Comparison (Read This First)

| Backup Type | Main Content | Typical Files/Folders | Restore Impact | Cross-device Migration | Restart Required |
| --- | --- | --- | --- | --- | --- |
| Chat History | Conversation messages and chat content | `backup/chat`; export supports `JSON` / `Markdown` / `HTML` / `TXT` | Mainly affects chat data, does not fully overwrite app database | Strong (best for migration) | No |
| Character Cards | Character cards and related persona data | `backup/character_cards` | Mainly affects character data | Strong | No |
| Memory | Memory entries and memory content | `backup/memory` | Import supports `Skip / Update / Create New` strategies | Medium-Strong | No |
| Model Config | Model providers, parameters, API configuration (may include keys) | `backup/model_config` | Overwrites or updates model configuration | Medium (depends on service/network config) | Usually no |
| Room Database Backup | Core app data (chat history, character cards, memory, model config, etc.) | `backup/room_db`; auto: `room_db_backup_YYYY-MM-DD.zip`; manual: `room_db_manual_backup_yyyy-MM-dd_HH-mm-ss.zip` | **Overwrites current core data state**; create a temporary backup first | Weak (better for same-device rollback) | Yes (restart recommended) |
| Raw Snapshot Backup (Experimental) | Internal app runtime state (internal files, settings, database, etc.; excludes some very large terminal data by default) | `backup/raw_snapshot` | **Strongest restore power**, but overwrites more of current state; highest mistake cost | Weak (recommend same app/environment version) | Yes (restart recommended) |

#### Which Chat Export Format Should I Choose?

Export options:

- `JSON`: Structured, best for importing back into Operit; recommended for migration.
- `Markdown`: Exports multiple per-chat markdown files (zip package), good for reading/archive.
- `HTML`: Good for browser viewing.
- `TXT`: Plain text backup, most compatible but least structured.

Import options:

- `OPERIT`
- `CHATGPT`
- `CHATBOX`
- `MARKDOWN`
- `GENERIC_JSON`

If your goal is “continue chats on another device”, prefer `JSON` export + matching import format.

#### Memory Import Strategy Differences

| Strategy | Behavior | Best For |
| --- | --- | --- |
| Skip (Recommended) | Skip items that already exist; minimizes changes to current data | Add missing memories safely |
| Update | Update existing items with imported content | Sync to newer memory content |
| Create New | Keep existing items and add imported entries as new | Preserve old and new versions |

#### Room DB Backup vs Raw Snapshot Backup

- Room DB backup: focused on core app business data (chat history, character cards, memory, model config, etc.); usually smaller and better for routine rollback.
- Raw snapshot backup (experimental): captures multiple internal app directories; closer to a full app-state snapshot and not limited to advanced users.
- Larger restore scope usually means stronger state recovery, but also higher operation risk if used by mistake.

#### Practical Recommendations

- New phone / chat migration: use **Chat History backup** first.
- Share or move personas: use **Character Card backup**.
- Sync long-term memory: use **Memory backup**, and confirm strategy before import.
- Move model connections: use **Model Config backup**, and protect secrets.
- Prevent mistakes / quick rollback: enable Room auto backup and keep manual restore points.
- Before clearing app data or uninstalling: regular users should also create a **Raw Snapshot backup (experimental)** for maximum state recovery after reinstall.

#### Security Notes

- Model config backups may contain sensitive information (for example API keys); do not share through untrusted channels.
- Before Room DB or Raw Snapshot restore, create one more backup of the current state.
- If the app asks for restart after restore, restart immediately to ensure consistent state.
