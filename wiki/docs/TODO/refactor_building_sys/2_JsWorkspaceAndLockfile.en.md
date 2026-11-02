---
title: Step 2: pnpm workspace and lockfile
status: draft
document_type: implementation-step
For_Agent: Without the user's explicit authorization, do not run compile, build, test, or release commands
step: 2
depends_on:
  - 1_BaselineAndContracts.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 2: pnpm workspace and lockfile

[Previous step: Baseline and build contracts](./1_BaselineAndContracts.en.md) · [Back to the overall plan](./index.en.md) · [Next step: External artifact manifest](./3_ExternalArtifactManifest.en.md)

## Previous implementation

- The root project and `web-chat` used npm as their build entry points
- `tools/example_packages/sync_example_packages.py` already called pnpm directly, so the repository had two package management entry points at the same time
- `pnpm-workspace.yaml` had no packages list
- The original repository ignored `pnpm-lock.yaml` and `package-lock.json`; the PR gate refactoring had temporarily committed three npm lockfiles for `npm ci` to use
- `tools/mcp_bridge` used npm to chain its own build, bundle, and copy scripts

## Expected new implementation

- The root `package.json` pins an exact pnpm version via `packageManager`
- The root `pnpm-lock.yaml` is the single lockfile for the repository's own JavaScript packages
- The workspace contains only `web-chat`, `tools/mcp_bridge`, and `examples/github`
- Managed packages are installed and have their scripts invoked only via pnpm
- Third-party source code, submodules, user templates, and standalone examples are not managed by the root workspace

## Scope of changes

Planned changes:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.gitignore`
- `web-chat/package.json`
- `tools/mcp_bridge/package.json`
- `examples/github/package.json`
- `tools/example_packages/sync_example_packages.py`

This step does not change:

- Package manifests and lockfiles inside third-party code and Git submodules
- Android Gradle dependencies
- The pixi orchestration of JS assets

## Plan

1. Confirm the exact Node.js LTS version and the exact pnpm version, and write them into the toolchain configuration from step 1.
2. Add three explicit package paths to the workspace, without using wildcards covering the whole repository.
3. Generate and commit the single root lockfile.
4. Remove npm script invocations within the managed scope, while keeping the original semantics of the runtime protocol fields.
5. Check the real dependency behind each import, and add any missing declarations to the package that actually uses them.
6. Add a static check that blocks lockfiles from other package managers from appearing in managed directories.

## Acceptance criteria

- The workspace scope matches the plan exactly
- A frozen install does not modify the lockfile
- Managed packages have no implicitly visible dependencies
- Managed build entry points do not call npm or yarn
- Third-party code, templates, and submodules are not taken over by the workspace

## Completion record

Status: partially prepared. The PR gate already uses npm lockfiles to freeze the current install; migration to a single pnpm workspace lockfile has not yet started, and the frozen-install and package-build verification results still need to be recorded before completion.
