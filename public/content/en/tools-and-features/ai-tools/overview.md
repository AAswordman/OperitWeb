# AI Tools Overview: Built-in + Dynamic

If you remember one thing:

**Operit AI tools have two layers: built-in default tools and dynamic tool packages.**

- Built-in default tools: ready immediately (files, web/network, system, device info, etc.)
- Dynamic tools: enabled on demand, with one unified entry via `use_package`

## Why Two Layers

From a user perspective, this keeps things practical:

- Common tasks work out of the box (built-in tools)
- Specialized capabilities are added only when needed (dynamic tools)
- No matter where a dynamic tool comes from, activation is unified (`use_package`)

## Calling Model (Key Point)

### 1) Built-in tools

Call directly. No package activation is required.

### 2) Dynamic tools

Unified flow:

1. Activate first: `use_package(package_name)`
2. Call tools inside that package (if executable tools are provided)

Executable tools usually follow:

- `packageName:toolName`

Examples (illustrative):

- `daily_life:get_current_date`
- `playwright:navigate`

> Note: if the model already outputs `packageName:toolName`, the system may try auto-activation. But the recommended mental model is still “activate first, then call”.

## Three Dynamic Categories (Unified Entry, Different Sources)

Dynamic tools are grouped by source:

1. **Sandbox Package (Package)**
   - Script-based capability package (commonly `.js`)
   - Includes built-in packages and user-imported packages
2. **Skill**
   - Capability package based on `SKILL.md`
   - Good for structured rules, workflows, and role-like behavior
3. **MCP**
   - Tool collection exposed by an MCP server
   - Good for external ecosystem integration and remote capabilities

All three can be activated through `use_package(package_name)`.

## How to Read the UI

In `Package Management`, you will see three sections:

- `Packages` (called “Sandbox Package” in this doc set)
- `Skills`
- `MCP`

As a user, you mainly decide:

- Do I need out-of-box tools or extension tools?
- If extension tools are needed, which type fits best (Sandbox Package / Skill / MCP)?

## Continue by Type

- [Sandbox Package](/#/guide/tools-and-features/ai-tools/sandbox-package)
- [Skill](/#/guide/tools-and-features/ai-tools/skill)
- [MCP](/#/guide/tools-and-features/ai-tools/mcp)
