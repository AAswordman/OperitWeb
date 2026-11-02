---
based_on: test_example/chat_import_markdown_example.md
---
# Markdown Chat History Import Format Specification

This document describes the new Markdown-format chat history import specification supported by the Operit app.

> **Note**: Operit uses a concise parsing model based on HTML comments. **Each Markdown file corresponds to a single, independent conversation**. Splitting multiple conversations within a single file using `---` is no longer supported.

## 📋 Format Overview

The new format uses simple key-value comments to store metadata, with no need to write complex JSON.

- ✅ **Simple to write**: uses the `key=value` format, with shorthand supported
- ✅ **Generous defaults**: only the necessary information needs to be specified; the rest is generated automatically
- ✅ **Precise splitting**: messages are split based on comments, keeping content cleaner
- ✅ **Batch support**: batch import/export is supported via Zip archives

## 🔧 Basic Structure (Single File)

Each `.md` file represents one conversation.

```markdown
<!-- chat-info: title=My Conversation -->

# My Conversation

<!-- msg: user -->
## 👤 User

Hello

<!-- msg: ai, model=gpt-4 -->
## 🤖 Assistant

Hello!
```

## 📝 Detailed Specification

### 1. Global Metadata (`chat-info`)

The file header contains a `chat-info` comment.

**Format**:
```html
<!-- chat-info: key=value, key=value -->
```

**Supported fields** (all optional):
| Field | Description | Default |
|------|------|--------|
| `title` | Conversation title | "Imported from Markdown" |
| `created` | Creation time | Current import time |
| `id` | Unique identifier | Auto-generated UUID |
| `group` | Group name | "从 Markdown 导入" |

**Example**:
```markdown
<!-- chat-info: title=Python Study Notes, group=Programming -->
```

### 2. Message Metadata (`msg`)

Each message begins with a `msg` comment.

**Format**:
```html
<!-- msg: role, key=value... -->
```

**Supported shorthand**:
The role name can be written directly, without the `role=` prefix.
- `<!-- msg: user -->` is equivalent to `<!-- msg: role=user -->`
- `<!-- msg: ai -->` is equivalent to `<!-- msg: role=ai -->`

**Supported fields**:
| Field | Description | Default |
|------|------|--------|
| `role` | Role (user/ai) | user |
| `model` | Model name | markdown |
| `timestamp` | Timestamp | Auto-generated in sequence |

**Examples**:
```markdown
<!-- msg: user -->
<!-- msg: ai, model=gpt-4 -->
<!-- msg: user, timestamp=1700000000000 -->
```

### 3. Message Content

The content immediately following the `msg` comment is the message body.
If a `## User` or `## Assistant` heading is written immediately after the comment, that line is automatically ignored on import (treated as decoration).

## 📦 Batch Import/Export (Zip)

Operit supports managing multiple conversations via **Zip archives**.

### Export
When multiple conversations are exported in Markdown format, the system generates a `.zip` file.
- The archive contains multiple `.md` files.
- Each `.md` file corresponds to one conversation, named after the conversation title.

### Import
You can pack multiple Markdown files conforming to the above specification into a `.zip` file for a one-time import.
- The system automatically extracts the archive and reads all `.md` files inside.
- Each file is imported as an independent conversation record.

## ⚠️ FAQ

### Q: Can different conversations be mixed in a single file?
**A:** **No longer supported**. Save each conversation as a separate `.md` file. If `---` is used in a single file, it is treated as part of the body content.

### Q: Can I write this format manually?
**A:** Yes. Just make sure the file extension is `.md` and that it contains `<!-- msg: ... -->` comments.

### Q: Why can't my file be imported?
**A:** Please check:
1. Whether the file contains `<!-- msg: ... -->` comments.
2. If it is a Zip package, make sure it contains `.md` files.
