# AI Tool Permissions

This document describes the new AI tool permission mechanism, to help you quickly understand how "global default + per-tool exception" works, along with some recommended usages.

---

## 1. Permission Model Overview

The system provides 3 permission levels for AI tools:

- **Allow (ALLOW)**: executes directly, without asking again.
- **Ask every time (ASK)**: shows a confirmation dialog before every call.
- **Forbid (FORBID)**: rejects execution directly; the tool is not called.

On top of this, permissions are determined by two layers working together:

1. **Global default permission**: determines the default behavior for all tools.
2. **Per-tool exception configuration**: sets special rules for a specific tool, overriding the global default.

Which permission level a given tool actually uses is determined by the rules below.

---

## 2. Global Default Permission

The "global default permission" is the base policy for the whole system, applying to **all tools that have no individual configuration**.

On the settings page, you can set the global default to:

- **Allow**: all tools execute automatically by default.
- **Ask every time**: a dialog pops up before every tool call by default.
- **Forbid**: all tools are forbidden from executing by default.

> As long as a tool has no "per-tool exception" configured, it follows the global default exactly.

---

## 3. Per-Tool Exception Configuration

Beyond the global default, you can set "exception rules" for individual tools.

On the settings page, under each permission group (Allow / Forbid), you can manually add tools:

- Putting a tool in the **Allow** group means: "no matter how the global setting is configured, this tool is always allowed to execute automatically."
- Putting a tool in the **Forbid** group means: "this tool is always forbidden from executing."

When a tool has an exception configuration:

> **Effective permission = the per-tool exception level**, not the global default.

If you want a tool to **go back to following the global default**, you can:

- Click the tool again in its group, or
- Uncheck the tool in the tool selection dialog.

The tool's exception configuration is then cleared, and it executes according to the global default again.

---

## 4. Recommended Usage Scenarios

Below are a few common, easy-to-understand permission combination examples:

### Scenario 1: Generally Conservative, Trusting Only a Few Tools

- Global default: **Ask every time (ASK)**
- Add the read-only / side-effect-free tools you fully trust (such as code search, calculator, etc.) to the **Allow (ALLOW)** group.

Effect:

- Most tools show a confirmation dialog before use;
- Only the tools you explicitly added to the "Allow" group execute silently.

### Scenario 2: Extreme Security Mode, Only a Few Allowlisted Tools

- Global default: **Forbid (FORBID)**
- Add the tools you trust to the **Allow / Ask every time** groups as needed.

Effect:

- All tools are off by default;
- Only the tools you named in a group have a chance to be called, and they execute at the permission level you chose.

---

## 5. Summary

- Global default = the baseline policy, determining how all tools behave "when there is no exception".
- Per-tool exception = the override policy, letting you exercise finer-grained control over a few tools.
- Tools that do not appear in any group are treated as having "no exception configuration" and follow the global default entirely.

If you encounter behavior that does not match your expectations while configuring, first check:

1. What is the global default currently set to?
2. Does the tool appear in some group, with an exception rule set?

With these two pieces of information, you can basically determine the cause of the current behavior.
