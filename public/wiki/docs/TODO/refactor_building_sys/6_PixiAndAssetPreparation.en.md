---
title: Step 6: Pixi and Asset Preparation Entry Points
status: draft
document_type: implementation-step
For_Agent: Do not execute compile, build, test, or publish commands without the user's explicit authorization
step: 6
depends_on:
  - 5_ToolingDirectoryMigration.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 6: Pixi and Asset Preparation Entry Points

[Previous step: Tooling Directory Migration](./5_ToolingDirectoryMigration.en.md) · [Back to master plan](./index.en.md) · [Next step: Android Capability Contracts](./7_AndroidCapabilityContracts.en.md)

## Previous Implementation

- The repository has no `pixi.toml`
- `ci/README.md` already documents the current candidate checks and Android dependency preparation flow, but does not yet provide pixi task entry points
- web-chat, toolpkg, and MCP bridge have no unified assets production entry point
- JS assets have no path, size, SHA-256, or production task list
- Development documentation requires globally installing tools and modifying persistent environment configuration

## Expected New Implementation

- pixi pins Node.js, pnpm, JDK, Python, and stably manageable host tools
- `ci/script/` provides environment report, frozen install, JS assets production, and artifact verification entry points
- Before an Android build starts, it must pass JS assets manifest and external artifact manifest verification
- Scripts do not modify shell profiles, the registry, or system-level environment variables
- External CI only calls the same pixi tasks as local builds
- Each pixi task keeps a single responsibility, and provides a stable command, exit code, and structured report

## Change Scope

Planned changes:

- `pixi.toml` and its corresponding lockfile
- `ci/script/`
- `ci/README.md`
- `package.json`
- `web-chat/scripts/`
- `tools/example_packages/sync_example_packages.py`
- `tools_built-in/mcp_bridge/`

This step does not change:

- Android feature modules
- Gradle variant identity
- APK publishing and patch logic

## Plan

1. Have pixi provide the host tool versions confirmed in step 1.
2. Implement the `env-report`, `js-install`, `js-webchat`, `js-toolpkg`, `js-bridge`, and `artifact-verify` entry points.
3. Establish `js-assets.json`, recording production tasks, relative paths, sizes, and SHA-256 values.
4. Add `js-assets-check`, reporting differences between the generation results and the Git working tree and assets manifest.
5. Define the prerequisite order for Android orchestration: verify JS assets and external artifacts first, then invoke Gradle.
6. Provide `--help`, explicit parameters, outputs, and exit conditions for each script.
7. Reserve stable task names for the subsequent pipeline contract, rather than hiding multiple independent stages inside one opaque command.

## Acceptance

- Local and external CI use the same pixi tasks
- All JS assets can be traced back to source, lockfile, and production tasks
- Gradle files do not install Node or Python dependencies, nor directly call npm, pnpm, or artifact downloads
- Scripts do not change persistent host configuration after finishing
- Tasks explicitly terminate on inconsistent inputs or hashes

## Completion Record

Status: Not started. Before completion, dependency installation and assets build results need to be recorded.
