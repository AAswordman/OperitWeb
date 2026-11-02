---
title: Pin MNN Stable Dependency
For_Agent: Record the MNN native dependency pinning and PR merge process
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
---

# Pin MNN Stable Dependency

## Old Implementation

- `llm/mnn/CMakeLists.txt` used MNN `master`
- The CMake configuration phase resolved the commit from the remote branch's current target, so build inputs differed at different times
- The commit `d68305cf2476a7dc319643ba7c62f44e2bc5246b` resolved on 2026-08-13 was missing `qwenVideoProcess` at the `:mnn:buildCMakeDebug[arm64-v8a]` link stage

## Intent of the Change

- Use the official latest stable MNN `3.6.1`
- Use the immutable commit `d407447ed56c4121a11ccbd266dc184ca1ead0c2` behind the release tag
- Migrate the existing `master` and known-broken commit caches to the stable commit, to avoid Android Studio reusing old resolution results
- Force-sync the `OPERIT_MNN_GIT_REF` cache, to avoid the old `master` configuration continuing to take effect; subsequent upgrades are completed only via reviewed source submissions

## Scope

- `llm/mnn/CMakeLists.txt`
- `ci/README.md`
- `docs/TODO/native_dependency_fetchcontent/index.md`

## Acceptance Criteria

- The default CMake input no longer contains `master`
- The MNN version header is `3.6.1`
- The stable commit is recorded in the CI dependency notes and TODO
- No compile, build, or test commands were executed

[DONE]
