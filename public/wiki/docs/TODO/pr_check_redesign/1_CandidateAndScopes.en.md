---
title: Step 1: Candidate Tree and Scope Contract
status: completed
---

# Step 1: Candidate Tree and Scope Contract

## Old Implementation

The PR workflow checked out the contributor's head and compared the base tip and head tip in the event. When a contributor branch lagged behind, later upstream commits polluted the diff range, and the head did not include the fixes and build entry points in the final merge tree.

## New Implementation

The `pull_request` event only checks out `github.sha`. The check entry point verifies that this commit has exactly two parent commits, that the first parent commit equals the event base, and that the second parent commit equals the event head.

Path classification uses only:

```text
base = candidate^1
diff = base..candidate
workspace = candidate
```

Renames are classified as both deleting the old path and adding the new path, and path passing uses NUL separation. Classification rules are stored only in `ci/script/pr_check.py`.

## Acceptance

- A stale fork does not attribute newly added upstream documentation to contributor changes
- Fails directly when the candidate's parent commits do not match the event
- Translation, WebChat, JVM, native, ToolPkg, and documentation paths get a definite scope
- Renames and deletes do not miss the checks corresponding to the original path

[DONE]
