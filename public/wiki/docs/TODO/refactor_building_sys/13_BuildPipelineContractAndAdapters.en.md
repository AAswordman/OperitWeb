---
title: Step 13: Build Pipeline Contract and Platform Adapters
status: draft
document_type: implementation-step
For_Agent: Do not execute compile, build, test, or publish commands without the user's explicit authorization
step: 13
depends_on:
  - 12_QaAdbOfflineSimulation.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 13: Build Pipeline Contract and Platform Adapters

[Previous step: QA ADB Offline Simulation](./12_QaAdbOfflineSimulation.en.md) · [Back to master plan](./index.en.md) · [Next step: Documentation Sync and Legacy Path Cleanup](./14_DocumentationAndCleanup.en.md)

## Previous Implementation

- `ci/README.md` already documents the current PR technical pre-review and Android build entry points
- The repository already has GitHub Actions workflows, but still has no platform-independent, complete pipeline definition
- The pixi and `ci/script/` plans only list task names, with no unified stage IDs or dependency relationships
- Inputs, outputs, caches, permissions, secrets, network access, device requirements, and QA scenarios have no structured description
- When wiring up visual CI or GitHub Actions, the script order and artifact handoffs have to be reinterpreted

## Expected New Implementation

- `ci/pipeline/` holds the platform-independent stage list and build profiles
- `config/build-system/schema/` holds the single pipeline schema
- Each stage has a stable ID, its section, a display name, a single responsibility, explicit dependencies, and one pixi command entry point
- The stage list declares inputs, outputs, artifacts, caches, permissions, secrets, network, device, and success reports
- Visual CI reads the stage list directly to generate a task view
- GitHub Actions jobs are only responsible for preparing the runner, invoking stage commands, and uploading declared artifacts
- The platform adapter layer does not duplicate Gradle, pnpm, test, audit, or publishing logic
- Pipeline profiles retain the complete stages, and do not read `For_Agent` metadata to decide whether to execute compilation, builds, or tests
- `qa_verify` explicitly includes the three offline scenario IDs: market, patch, and announcement
- Pipeline static checks include the QA debug command, release support command, and APK external entry audit

## Change Scope

Planned changes:

- `ci/pipeline/`
- `ci/script/pipeline/`
- `config/build-system/schema/`
- `pixi.toml`
- `ci/README.md`
- `.github/workflows/`
- Build manifest and stage report schema

This step does not change:

- Business implementations inside each stage
- Android features, modules, and variant semantics
- External artifact and patch formats

## Plan

1. Define the stage schema in `config/build-system/schema/`, with fields including `id`, `section`, `display_name`, `description`, `needs`, `command`, `workdir`, `inputs`, `outputs`, `artifacts`, `caches`, `permissions`, `secrets`, `network`, `device`, `timeout`, and `report`.
2. Establish stable stage IDs for source validate, environment prepare, dependency prepare, asset prepare, artifact verify, static verify, test execute, Android assemble, package audit, QA verify, patch prepare, and publish.
3. Define the `verify`, `build`, `qa`, and `release` profiles. Each profile explicitly lists its stages and approved variants, and does not infer paths at runtime.
4. Have each stage call one pixi task, and output a structured stage report and an explicit exit code.
5. Define artifact names and hashes between stages; later stages only consume upstream artifacts declared in the manifest.
6. Set minimum permissions for secrets, network, device, and publishing rights, and stage logs must not output secret values.
7. Implement a local pipeline entry point that reads the same stage list by profile.
8. Define a read interface for future visual CI, so it can display stages, dependencies, status, logs, and artifacts.
9. Add a lean GitHub Actions adapter, where each job maps to one stage ID and contains no business build commands.
10. Add static consistency checks to ensure that the stage IDs, dependencies, and artifacts referenced by platform adapters match the manifest.
11. Verify that the `verify`, `build`, `qa`, and `release` profiles cover the complete stages each of them needs, unaffected by agent session permissions.
12. Have `qa_verify` output the market, patch, and announcement scenario statuses separately, rather than hiding individual failures behind one overall status.
13. In `package_audit`, separately report the QA debug allowlist, release support allowlist, variant assertions for generic execution entries, and internal Shell non-regression results.

## Acceptance

- Every build stage has a stable ID, its section, explicit dependencies, and a single pixi command
- The stage composition of the `verify`, `build`, `qa`, and `release` profiles is fixed and auditable
- Visual CI can generate a stage view without parsing shell scripts
- GitHub Actions workflows do not duplicate business build logic
- Local, visual CI, and GitHub Actions use the same stage input and artifact contract
- The publish stage requires explicit authorization, and permissions do not spread to other stages
- A stage failure explicitly terminates later stages that depend on it

## Completion Record

Status: Not started. Before completion, local pipeline, build, test, and platform adapter verification results need to be recorded.
