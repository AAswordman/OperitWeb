---
title: Step 12: QA ADB Offline Simulation
status: draft
document_type: implementation-step
For_Agent: Do not run compile, build, test, or release commands without the user's explicit authorization
step: 12
depends_on:
  - 11_ApkAuditAndPatch.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 12: QA ADB Offline Simulation

[Previous step: APK Audit and Patch Chain](./11_ApkAuditAndPatch.en.md) · [Back to the master plan](./index.en.md) · [Next step: Build Pipeline Contract and Platform Adapters](./13_BuildPipelineContractAndAdapters.en.md)

## Previous Implementation

- The plugin market directly uses the official API and static resource addresses in `MarketStatsApiService`
- Delta updates read GitHub Releases through `UpdateManager`, and `PatchUpdateInstaller` downloads, rebuilds, and verifies the APK
- In-app popup announcement delivery pulls the pointer and payload through `RemoteAnnouncementRepository`, and `RemoteAnnouncementDialog` displays them
- The three online paths have no unified QA debug endpoint configuration, ADB trigger protocol, or offline fixture
- The current plan previously treated in-app popup announcement delivery and Android `NotificationListenerService` as the same test target
- The existing debug receiver lives in the main Manifest and has not yet formed a QA-debug-only boundary

## Expected New Implementation

- `qaFullDebug` is the main test build for the three ADB offline simulations, and `qaLiteDebug` can verify that basic capabilities behave in the lite combination
- The three fixed simulations are triggered through named registration interfaces; QA debug still keeps the external ADB general execution capability for extended and exploratory automation scenarios
- QA debug accesses the host fixture via `adb reverse`, and reuses the production HTTP, parsing, caching, state management, download, and UI implementations
- `qa-market-offline` verifies the plugin market
- `qa-patch-offline` verifies delta updates
- `qa-announcement-offline` verifies in-app popup announcement delivery
- Each scenario has a fixed fixture, explicit ADB steps, a structured result, and an independent diagnostic log
- `qaFullRelease` contains no ADB arbitrary execution or offline endpoint switching, and only uses a fixed official-test configuration for verification close to the production environment
- In-app popup announcement delivery tests only cover remote announcement fetching and popup display, not the system notification listener service

## Change Scope

Planned changes:

- `ci/script/qa/`
- `ci/tools/qa_fixture/`
- `app/src/debug/`
- `app/src/qa/`
- Plugin market endpoint configuration and `MarketStatsApiService`
- Update endpoint configuration, `UpdateManager`, and `PatchUpdateInstaller`
- Announcement endpoint configuration, `RemoteAnnouncementRepository`, `RemoteAnnouncementPreferences`, and `RemoteAnnouncementDialog`
- QA scenario report schema and fixed fixture data

This step does not change:

- The official endpoints of the prod release
- The system notification listening logic of `NotificationListenerService`
- The production data models of the plugin market, delta updates, and announcement popups

## Plan

### ADB and Fixture Common Entry

1. Set up a host fixture server with a fixed listen address, port range, data directory, and access log format.
2. Establish an endpoint configuration interface for QA debug; the three features continue to use their respective production clients and parsing models.
3. Use `adb reverse` to map a fixed device-side port to the fixture server.
4. Register the three scenario command IDs through the step 10 debug-only ADB gateway, and use type parameters to perform state cleanup, trigger actions, and export results.
5. Keep the full scripts, commands, and ToolPkg debugging capabilities of the in-app Shell and the QA debug external ADB; the three fixed scenarios use named interfaces to guarantee reproducible results.
6. Each scenario generates a structured report containing requests, responses, state changes, UI results, and error logs.

### Plugin Market Offline Simulation

1. The fixture provides list, category, detail, search, sorting, and plugin asset responses consistent with the official market API and static resource paths.
2. `qa-market-offline` starts the fixture, sets up ADB reverse, clears the market cache, and triggers a real market refresh.
3. The scenario verifies list and detail parsing, search and sorting, resource downloads, installation results, and local state changes.
4. Assert that all requests reach the fixture and that the official market service is not accessed during the test.

### Delta Update Offline Simulation

1. The fixture provides GitHub Releases-compatible responses, patch metadata, patch ZIPs, and target APK information.
2. Prepare the baseline APK and target APK with the same QA applicationId and a fixed QA debug signature, with the target versionCode strictly increasing.
3. `qa-patch-offline` installs the baseline APK, sets up ADB reverse, and triggers a real update check and patch download.
4. The scenario verifies the baseline APK hash, patch hash, rebuilt target APK hash, installation request, and post-install version.
5. The result report records the baseline and target build manifests, patch metadata, and device installation status.

### In-App Popup Announcement Offline Simulation

1. The fixture provides a `latest.json` pointer and announcement payload, with field formats consistent with the current model of `RemoteAnnouncementRepository`.
2. `qa-announcement-offline` clears the announcement read state, sets up ADB reverse, and triggers a real announcement fetch.
3. The scenario verifies versionCode, channel, language, time range, enabled state, and countdown filtering.
4. The scenario asserts the title, body, confirm text, and countdown shown by `RemoteAnnouncementDialog`, and verifies read persistence after confirmation.
5. The result report explicitly marks the scenario as an in-app remote announcement and does not collect `NotificationListenerService` results.

## Acceptance

- The three pixi tasks can run separately, without sharing undeclared state
- `qaFullDebug` can complete offline end-to-end verification of the plugin market, delta updates, and in-app popup announcement delivery via ADB
- The three scenarios reuse the production clients, parsing models, state management, and UI, and do not build a second business implementation
- QA debug supports free-form debugging through a general entry, and also yields stable, auditable end-to-end results through the three named scenarios
- Fixture request logs prove that the offline scenarios did not access official services
- The rebuilt APK hash from delta updates is exactly identical to the target APK, and the post-install versionCode is recorded
- The announcement scenario verifies `RemoteAnnouncementDialog` and the read state, and does not treat the system notification listener as a pass condition
- `qaFullRelease` and `prodFullRelease` contain no debug-only scenario entries, ADB arbitrary execution, or offline endpoints

## Completion Record

Status: Not started. Before completion, the three offline scenarios, the QA release restrictions, and the official-test device verification results need to be recorded.
