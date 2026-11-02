---
title: "Step 3: Workflow and Build Lanes"
status: completed
---

# Step 3: Workflow and Build Lanes

## Old Implementation

A single translation file would trigger a full Android build. PR builds also inherited secrets, initialized already-deleted submodules, called pre-migration ToolPkg paths, and uploaded build artifacts on failure.

## New Implementation

PRs keep the `Candidate checks` aggregation job, and run the following specialized jobs by scope:

1. Candidate contract, gate unit tests, and fast checks
2. AAPT2 syntax compile of translation resources
3. WebChat and ToolPkg specialized checks
4. JVM test and Android lint for Kotlin/Java changes
5. Standalone Android assemble and JVM test for native, Gradle, and build-input changes

After a fast check fails, the time-consuming stages do not start. The PR workflow has only `contents: read` permission, reads no secrets, and uploads no APK/AAB. Trusted main and manual Android builds keep separate workflows.

## Acceptance

- The PR page keeps one aggregated technical red light, and shows the specific failure reason of each specialized job
- Pure translation changes do not start a full assemble
- Fork PR logs and artifacts contain no repository secrets
- Android builds only initialize public submodules that currently exist and are actually needed
- ToolPkg uses `tools/example_packages/sync_example_packages.py`
- WASM ToolPkg runs AssemblyScript, TypeScript, and archive builds against a standalone lockfile
- Entry points and WASM files declared in the ToolPkg manifest must exist, be non-empty, and actually be written into the archive
- The GitHub TypeScript example must be rebuilt and match the committed `examples/github.js`
- YAML uses AST syntax parsing and actionlint, so legal scalars do not trigger object deserialization false positives
- Trusted Android builds isolate concurrency by event, and force OAuth input validation before Gradle
- Gradle Wrapper download content must match the official Gradle 8.13 SHA-256

[DONE]
