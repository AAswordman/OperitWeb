# Operit Contribution Guide

Thank you for submitting issues, documentation, scripts, plugins, or code to Operit. This document describes the current repository collaboration workflow; for build details, see the [Android Build Guide](./BUILDING.en.md), and for script and ToolPkg development, see the [Script Development Guide](../../SCRIPT_DEV_GUIDE.en.md).

## Contribution Types

- Android app, tool calls, workflows, data, and UI: mainly under `app/`
- WebChat: under `web-chat/`, with build output synced into Android assets
- Scripts, Skills, Plugins, MCP, and example packages: under `examples/`, with format details in the [ToolPkg Guide](../../TOOLPKG_FORMAT_GUIDE.en.md)
- Documentation and collaboration materials: under `docs/`
- Build, check, and repository automation: under `.github/`, `ci/`, and `tools/`

## Submitting an Issue

First search the [Issues section](https://github.com/AAswordman/Operit/issues) for the same problem, then choose the corresponding Issue Form:

- Bug report: errors, crashes, and abnormal behavior
- Feature request: feature and behavior suggestions
- Plugin, Skill or MCP report: external package, tool, and MCP service issues
- Question: usage, configuration, and behavior inquiries

When submitting, please fill in the complete version number, runtime environment, main problem, reproduction steps, and relevant configuration. The screenshot or log fields are for supplementary evidence; text descriptions are also fine. Do not submit API Keys, Tokens, Cookies, personal information, or other sensitive content.

Issues with only a title and no body or comments are automatically closed. Feature, bug, and tool issues should reference existing discussions where possible to avoid duplicate follow-ups.

## Before Developing

The project is an Android main app that also includes native submodules, WebChat, and script build steps. The full environment requirements are governed by the [Android Build Guide](./BUILDING.en.md); the main versions currently used by CI include:

- JDK 21
- Node.js 22, npm, and pnpm
- Python 3
- Android SDK 34/36, Build Tools 34/35
- NDK 25.1.8937393 and CMake 3.22.1

After forking and cloning the repository, it is recommended to keep an `upstream` remote:

```bash
git clone https://github.com/<your-account>/Operit.git
cd Operit
git submodule update --init --recursive terminal
git remote add upstream https://github.com/AAswordman/Operit.git
git fetch upstream
git switch -c fix/short-description upstream/dev
```

Do not commit `local.properties`, local secrets, manually downloaded models, or binary dependencies. When modifying WebChat or example packages, first prepare the root directory and `web-chat` dependencies as described in the build guide.

## Development Principles

- Read the relevant modules and existing tests before starting modifications
- Keep PRs focused; do not mix unrelated formatting, renaming, and feature changes together
- When changing persisted data, configuration formats, tool parameters, or public behavior, explain compatibility and migration impact
- When adding user-facing text, prefer resource strings or the project's existing multilingual mechanisms
- When UI, behavior, or documentation changes, provide verification results and any necessary screenshots, logs, or comparison information in the PR
- Do not modify third-party submodule contents to fix main repository problems; when a change is needed, separately explain its source and synchronization method

## Local Checks

The main quick checks can be reproduced from the repository root:

```bash
git fetch upstream dev
BASE_SHA="$(git merge-base upstream/dev HEAD)"
CANDIDATE_SHA="HEAD"

python3 -B -m unittest discover -s ci/test -p 'test_*.py'
python3 -B ci/script/check_repo_hygiene.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
python3 -B ci/script/check_markdown_links.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
python3 -B ci/script/check_localizations.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
npm --prefix web-chat run typecheck
```

Choose additional checks based on the scope of your changes:

```bash
# WebChat
npm --prefix web-chat ci
npm --prefix web-chat run build

# Example packages or ToolPkg
npm ci
npm run build:examples:github
git diff --exit-code -- examples/github.js
npm --prefix examples/toolpkg_wasm_demo ci
npm --prefix examples/toolpkg_wasm_demo run pack:toolpkg
python3 ./tools/example_packages/sync_example_packages.py --mode test --no-hot-reload
python3 ./tools/example_packages/sync_example_packages.py --no-hot-reload

# Android JVM unit tests and build
./gradlew :app:testDebugUnitTest
./gradlew assembleDebug
```

When a local build requires manual dependencies, download and place `subpack.zip`, `jniLibs.zip`, and `libs.zip` as described in the [Android Build Guide](./BUILDING.en.md), and do not commit these files to Git. The default local STT model is automatically prepared by the Android build according to `app/config/stt-model-assets.properties`.

## Creating a Pull Request

The default upstream target branch for day-to-day development PRs is the long-term integration branch `dev`; the old `pr-branch` workflow is no longer used. `main` is only for stable releases and release synchronization performed by maintainers. `dev` is the repository's maintained target branch and is not subject to the contribution branch naming rules. New contribution branches must use the following prefixes plus a short description:

- `feat/`: new features
- `fix/`: bug fixes
- `docs/`: documentation
- `ci/`: build and automation
- `refactor/`: refactoring that does not change behavior
- `test/`: test changes

Branch names describe the change; do not use agents, models, or personal identities as prefixes. For example, a CI change uses `ci/skip-android-lint`, not `codex/skip-android-lint`. Existing branches keep their original names; this rule applies only to newly created branches.

Push your personal branch and create a PR:

```bash
git fetch upstream
git rebase upstream/dev
git push --set-upstream origin fix/short-description
```

The PR page automatically loads the [PR template](../../../.github/PULL_REQUEST_TEMPLATE.en.md). Please keep and fill in the following:

- Change background, motivation, and scope
- Related Issue; for purely documentation, CI, or maintenance changes, state `N/A` and its background
- Compatibility, data, configuration, performance, and security impact
- Commands run, test environment, build variants, and results
- Necessary screenshots, screen recordings, logs, or build artifacts
- Self-check against the checklist before submitting; inapplicable items can be explained in "Verification method"

When a draft PR is converted to Ready, the technical pre-review runs again. The title, body, Issue references, and checklist are jointly reviewed by contributors and maintainers, and are not pass conditions for automated technical checks.

PR titles are recommended to use the Conventional Commits format, for example:

```text
fix(chat): preserve scroll position
feat(tools): add package description
docs: update contribution guide
ci: add localization checks
```

Feature, fix, and performance changes are recommended to reference an existing Issue or discussion. Do not write API Keys, Tokens, private URLs, or local paths into PRs.

## CI Checks

PRs enter the [PR Check workflow](../../../.github/workflows/pr-check.yml), which keeps a `Candidate checks`
aggregation of technical status; where applicable, independent `Android build` and `Android JVM tests` jobs are also shown. Checks run on
the merge candidate GitHub generates for the PR against the current `dev`:

- Quick checks: diff whitespace, conflict markers, JSON/XML/YAML, Actions, local Markdown links, and gated unit tests
- Localization: locale and resource key attribution types, duplicates, placeholders, and locale configuration errors
- Translation resources: runs AAPT2 resource compile without starting a full Android build
- Kotlin/Java: JVM unit tests run by the `Android JVM tests` job
- Native, Gradle, and build inputs: the `Android build` job runs assemble, while JVM unit tests run in a separate job
- WebChat and ToolPkg: dedicated checks run when the corresponding paths change, and the full Android lane also prepares final packaging inputs

Quick checks collect fixable diagnostics in a single job, and `Candidate checks` then aggregates the results of all applicable jobs.
Pre-existing issues not touched by this PR are shown only as count hints. Please review the step summary, job results, and file annotations, then update the PR.

## Community and Derivative Projects

Derivative projects based on Operit are welcome. Please publish the source code on a public code hosting platform, and state Operit's origin in the project documentation with a link back to this repository, so the community can review, learn, and continue contributing.
