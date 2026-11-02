---
For_Agent: Consolidate the local large-model modules into the llm directory
---

# LLM Module Directory Migration

## Old State

- `llama` and `mnn` were scattered at the repository root
- Gradle, CMake, CI, and architecture docs used root-directory paths directly

## Intent of the Change

- Move both modules as a whole to `llm/llama` and `llm/mnn`
- Keep the Gradle module names `:llama` and `:mnn`; do not change the app dependency interface
- Sync CMake shared script paths, CI trigger paths, and repository architecture docs

## Scope

- `llm/llama/`
- `llm/mnn/`
- `settings.gradle.kts`
- `.github/workflows/android-build.yml`
- `Repo_Arch_Basic.md`
- `docs/TODO/native_dependency_fetchcontent/index.md`

## Status

[DONE]
