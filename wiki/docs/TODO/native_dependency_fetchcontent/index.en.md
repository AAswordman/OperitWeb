---
For_Agent: native dependency FetchContent migration notes
---

# Native Dependency FetchContent

## Previous Situation

- `ufbx`, `Bullet3`, `Saba`, `ncnn`, `llama.cpp`, `sherpa-ncnn`, WAMR, QuickJS, and MNN were pinned to repository paths via Git submodules
- MNN's KleidiAI sub-dependency was originally downloaded by MNN CMake into a deep build directory
- `sherpa-ncnn`'s built-in `ncnn.cmake` used a fixed zip package

## Intent of This Change

- Change these native dependencies to CMake `FetchContent`
- Use each dependency's declared stable version or immutable commit by default; MNN is pinned to the official 3.6.1 release commit `d407447ed56c4121a11ccbd266dc184ca1ead0c2`
- On each configure, first resolve the remote ref's commit, then download the corresponding GitHub archive
- Keep the `OPERIT_*_GIT_REF` parameters so CI or release builds can specify a ref
- FetchContent source and build directories land in each module's `.cxx/operit_deps`, reducing Windows native build path lengths

## Scope

- `.gitmodules`
- `avator/fbx/CMakeLists.txt`
- `avator/mmd/CMakeLists.txt`
- `llm/llama/CMakeLists.txt`
- `quickjs/src/main/cpp/CMakeLists.txt`
- `llm/mnn/CMakeLists.txt`
- `cmake/operit_git_source.cmake`
- `app/src/main/cpp/cmake/ncnn.cmake`
- `app/src/main/cpp/CMakeLists.txt`
- Development build documentation

## Status

[DONE]
