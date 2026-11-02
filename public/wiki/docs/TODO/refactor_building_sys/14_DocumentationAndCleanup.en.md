---
title: "Step 14: Documentation Sync and Legacy Path Cleanup"
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 14
depends_on:
  - 13_BuildPipelineContractAndAdapters.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 14: Documentation Sync and Legacy Path Cleanup

[Previous step: Build Pipeline Contract and Platform Adapters](./13_BuildPipelineContractAndAdapters.en.md) · [Back to master plan](./index.en.md)

## Legacy Implementation Status

- `BUILDING.md` still requires npm, global pnpm, and persistent environment variables
- `ci/README.md` already documents the current PR check parameters, inputs, and build layers, but does not yet cover the complete pipeline profiles in the plan
- The build documentation does not explain dependencies, permissions, and artifact handoff by pipeline stage
- MCP bridge documentation and script error messages still point to npm commands
- The repository has no guide for adding new packages and tools covering directory selection, dependency declaration, lockfiles, build tasks, and CI integration
- The existing ADB documentation mainly introduces the generic `EXECUTE_JS` receiver, without describing the registration specification for named debug interfaces
- Data rescue paths and internal Shell debug commands lack formal documentation
- The build documentation still contains `clone`, `nightly`, `assembleDebugClone`, and old APK paths
- `Repo_Arch_Basic.md` still describes development, debugging, build, and app built-in tools uniformly as `tools/`
- The TODO plan and formal development documentation have no clear archiving boundary

## Expected New Implementation Status

- `BUILDING.md` only describes the current pixi, pnpm, artifact preparation, and approved variant entry points
- `ci/README.md` documents all script responsibilities, parameters, outputs, permissions, and exit conditions
- CI documentation describes the mapping between stable stage IDs and local, visual CI, and GitHub Actions
- QA documentation separately describes debug full debugging, release debugging capability removal, and three ADB offline scenarios
- bridge, web-chat, and example error messages match the real commands
- Old npm and Gradle build entry points, old artifact paths, and migration notes are removed
- Architecture documentation separately describes the responsibilities of `ci/script/`, `ci/tools/`, and `tools_built-in/`
- The new package and tool guide provides copyable minimal examples, directory decisions, dependency declarations, asset inventories, and CI integration steps
- The debug interface guide describes the boundaries of QA debug, release support, and internal Shell, plus the registration schema, permissions, testing, and auditing methods
- The data rescue Shell documentation describes path viewing, snapshot export, output formats, and operations not exposed externally
- The release support documentation describes log reading, log following, data rescue, and shell-only call constraints
- Completion records, stable interfaces, experiment results, and verification evidence go into formal documentation

## Change Scope

Planned changes:

- `docs/doc-src/dev-core/BUILDING.md`
- `ci/README.md`
- `tools_built-in/mcp_bridge/README.md`
- `docs/doc-src/dev-core/ADDING_PACKAGES_AND_TOOLS.md`
- `docs/doc-src/dev-core/DEBUG_INTERFACES.md`
- `docs/doc-src/dev-core/DATA_RESCUE_SHELL.md`
- web-chat and example build error messages
- Patch release related documentation
- `Repo_Arch_Basic.md`
- `docs/TODO/refactor_building_sys/`

This step does not change:

- Already stable business implementations
- Already accepted module and variant models
- Build and patch algorithms

## Plan

1. Generate the task list from actual pixi tasks and script `--help` output; do not copy expired commands.
2. Update BUILDING, describing environment preparation, JS assets, external artifacts, variants, signing inputs, and artifact locations.
3. Update the CI README, describing the unified call boundary between local and external CI.
4. Update MCP bridge, web-chat, and example commands and error messages.
5. Remove npm mixed-use entry points, old build types, old task aliases, and old APK path descriptions.
6. Update the repository architecture documentation, recording the script, host tool, and app built-in tool directories separately.
7. Document build profiles, stage order, artifact handoff, permission boundaries, and platform adaptation methods.
8. Document the full QA debug debugging entry points, the release APK support allowlist, the removed generic execution entry point, and three ADB offline simulation commands.
9. Write the new package and tool guide, describing the following complete flows:
   - A repository-owned JS package joins the pnpm workspace, declares dependencies, updates the single lockfile, generates an assets inventory, and integrates into a pipeline stage
   - CI workflow scripts go into `ci/script/<intent>/`, host tools go into `ci/tools/<name>/`, and app built-in tools go into `tools_built-in/<name>/`
   - Local AAR, JAR, JNI, models, and subpacks are first registered in the artifact manifest with hash, license, and single consumer, then written as precise Gradle dependencies
   - New tools declare owner, inputs/outputs, permissions, build tasks, test tasks, artifact inventories, and documentation entry points
10. Write the debug interface guide, describing command ID naming, versions, type parameters, result schema, exposure scope, registration code, call scripts, logs, testing, and APK auditing.
11. In the debug interface guide, state clearly that QA debug allows external ADB generic execution, release only retains the `EXTERNAL_RELEASE_SUPPORT` command, and internal Shell is unaffected by either.
12. Write the data rescue Shell guide, documenting `data_rescue_paths`, `data_rescue_export`, shared path definitions, snapshot formats, output locations, and the release ADB shell call method.
13. Document the filtering, sensitive information scrubbing, read limits, follow duration, and shell output format of `support_logs_read` and `support_logs_follow`.
14. Rewrite the old `execute_js` and sandbox external broadcast documentation as QA debug-only documentation, and add the applicable scenarios for named interfaces and release support.
15. Add actual PRs, verification records, and stable interface links for all fourteen steps.
16. After all steps are complete, add `[DONE]` to the title, then archive this directory separately per the TODO specification.

## Acceptance

- A new collaborator can locate all current entry points by reading only BUILDING and the CI README
- Task names, parameters, and artifact paths in the documentation match the implementation
- Repository-owned documentation no longer directs readers to old npm or old Gradle paths
- A new collaborator can correctly add workspace packages, CI scripts, host tools, app built-in tools, and external artifacts by following the guides
- A new debug interface has a complete example from implementation, registration, invocation, testing, to APK auditing
- The documentation makes clear the permission boundaries of QA debug generic execution, the named command registry, release support, and the app internal Shell
- Release users can read logs and perform data rescue from an external ADB shell by following the documentation, without installing the QA package
- The data rescue Shell documentation matches the actual interfaces of `DataRescuePaths` and the snapshot export service
- All fourteen steps have completion evidence and corresponding documentation
- This directory remains in draft status until the user explicitly confirms archiving

## Completion Record

Status: Not started. Archiving requires the user's explicit confirmation.
