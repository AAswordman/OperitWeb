# CI checks

`script/` holds reproducible check entry points, `test/` holds the standard-library unit tests for the gate logic. GitHub Actions prepares the runner and invokes these entry points according to the change scope.

## Candidate contract

PR technical pre-review runs only on the merge candidate GitHub generates for the current PR and the latest target branch:

```text
base = candidate^1
head = candidate^2
changed paths = git diff base..candidate
workspace = candidate
```

`ci/script/pr_check.py` verifies that the two parent commits exactly match the base/head in the PR event. Path classification, static checks, tests, and builds all use the same candidate; the contributor head is not checked out, and base tip is not compared against a stale head.

## Local checks

Local checks require explicitly specifying the comparison boundaries. Run on a clean feature branch:

```bash
git fetch upstream dev
BASE_SHA="$(git merge-base upstream/dev HEAD)"
CANDIDATE_SHA="HEAD"

python3 -B -m unittest discover -s ci/test -p 'test_*.py'
python3 -B ci/script/check_repo_hygiene.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
python3 -B ci/script/check_markdown_links.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
python3 -B ci/script/check_localizations.py --base "$BASE_SHA" --candidate "$CANDIDATE_SHA"
```

A local branch is not a GitHub merge candidate, so local results are for pre-submit checking; only the `Candidate checks` on the PR page verify the actual tree after merging with the current `dev`.

## PR check lanes

Each PR keeps one aggregated `Candidate checks` technical status, and shows independent `Android build` and `Android JVM tests` jobs where applicable. Fast checks collect all diagnostics first, and do not start time-consuming phases after a failure.

- All changes: whitespace, conflict markers, JSON/XML syntax, and gate unit tests; when YAML changes, Psych AST and actionlint 1.7.12 are used for checks
- All changes: compare the base/candidate Git trees, blocking only newly added local broken links in the candidate; deletion of non-Markdown files referenced by documentation is also checked
- Localization: compare by locale, resource type, and key, blocking only errors introduced by or actually touched by the candidate
- Translation resources: run AAPT2 resource compile to check resource syntax, without running resource link or a full Android build
- Kotlin/Java and ordinary Android resources: run JVM unit tests
- Kotlin/Java and ordinary Android resources: the `Android JVM tests` job runs JVM unit tests
- Native, Gradle, and build inputs: the `Android build` job runs assemble alone; JVM unit tests in the same scope run in an independent job
- WebChat: run TypeScript typecheck and Vite build
- ToolPkg: rebuild and cross-check the GitHub examples, compile the WASM examples against an independent lockfile, then build the test collection and production allowlist collection; entry points declared by JSON manifests and WASM files must exist and be included in the archive

The root project, `web-chat`, and the standalone `examples/toolpkg_wasm_demo` each commit a `package-lock.json`; CI uses `npm ci` to install a deterministic dependency tree.

The PR workflow has only `contents: read` permission, does not read repository secrets, and does not upload APK/AAB. `Android Build` is a trusted main/manual build workflow responsible only for compiling and packaging, and `Android Tests` is separately responsible for trusted main/manual JVM unit tests.

## Diagnostics

Checkers summarize errors in logs by rule, and mark the first batch of file locations via GitHub annotations. The step summary records base, head, candidate, path scope, and fast-check results. Historical issues only show counts, and are not attributed to PRs that did not touch them.

## Android dependencies

MNN uses the official `3.6.1` release commit `d407447ed56c4121a11ccbd266dc184ca1ead0c2`, and does not follow `master`; other native source dependencies are still downloaded by each module as fixed GitHub archives via `cmake/operit_git_source.cmake`.

The JVM lane downloads only `libs.zip`; the full Android lane downloads all three fixed archives `libs.zip`, `subpack.zip`, and `jniLibs.zip`. `download_android_dependencies.sh` uses fixed Google Drive file IDs; `prepare_android_dependencies.py` limits member count, extracted size, compression ratio, and file types, rebuilds a fixed output root directory, validates only the files actually extracted this time, and rejects out-of-bounds paths, duplicate members, and symlinks. DragonBones and other native source dependencies are downloaded by each module as fixed GitHub archives via `cmake/operit_git_source.cmake`. `arsc.jar` has no remaining consumers, `smart-exception` is now provided by Maven Central, and duplicate native libraries of `android-gif-drawable` are not written from the archives into the build directory. Before app packaging, Gradle checks the externally built `liboperit_ripgrep.so`, as well as 10 arm64 native libraries in the local FFmpegKit AAR; missing or zero-length files fail packaging. The default local STT model no longer comes from Drive archives; Gradle fetches it per `app/config/stt-model-assets.properties` into the generated assets directory and verifies SHA-256.

These Drive archives currently have no content hashes. Archive content addressing and the license manifest continue to be tracked by the [external artifact manifest plan](../docs/TODO/refactor_building_sys/3_ExternalArtifactManifest.en.md); no speculative values are recorded before the real archives are obtained and audited. STT model assets already have per-file sources and hashes, but the Sherpa NCNN model upstream metadata has not yet declared a license, and the license audit still needs to be completed before release.
