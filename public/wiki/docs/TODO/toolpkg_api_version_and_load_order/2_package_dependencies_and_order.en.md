# Package Dependencies and Load Order

## Old Implementation

The ToolPkg container loaded packages sorted by package name, with no manifest-level required packages or load order constraints.

## Goals

- A `requires` declaration must reference a dependency object that exists and is enabled, and also determines that the dependency package loads before the declaring package.
- Each dependency includes an `id`, a user-facing `description`, and optional `min_version` / `max_version`.
- When a dependency does not exist, is not enabled, is declared repeatedly, or forms a cycle, the current package does not enter the execution phase and the reason is reported.
- When there are no relationship constraints, the user order in the plugin list is used, with package ID as the final deterministic tiebreaker.

[DONE]
