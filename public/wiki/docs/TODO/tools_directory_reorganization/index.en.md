---
feature: tools_directory_reorganization
scope: assistance
---

# Tools Directory Reorganization

## Current State

The `tools/` root directory simultaneously held ToolPkg debugging, ADB script execution, example package synchronization, Shower helper scripts, Compose DSL debugging, and native-ripgrep build entrypoints, with files of similar responsibilities scattered apart from each other.

## Intent

Move the root directory entrypoints into existing or new subdirectories according to tool responsibility, and update script relative paths, code, tests, and development documentation. Old entrypoints are not retained.

## Expected Results

- The `tools/` root directory only retains directories and fixed public installation scripts
- Each tool entrypoint sits in the same responsibility directory as its configuration, state files, and documentation
- All in-repository calls use the new paths
- No old-path forwarding scripts are added

## Steps

1. [Category Layout and Entrypoint Migration](./1_CategoryLayoutAndEntrypoints.en.md)
