---
For_Agent: Restore DragonBones archive preparation after the avatar module relocation
---

# DragonBones CI Dependency Path

## Original State

After the character model module moved to `avator/dragonbones`, the locally ignored DragonBones runtime, RapidJSON, and stb still existed, so local builds worked normally. A clean CI workspace did not have these directories, and the full Android build failed from the relocation commit onward due to missing header files. PR path classification still used the pre-relocation module root directory.

## Changes

- Wire the repository's existing GitHub archive fetching helper function into `avator/dragonbones/CMakeLists.txt`
- Pin to the DragonBonesCPP commit consistent with the pre-relocation source, without introducing a submodule or a standalone download script
- Change PR Android module classification to the post-relocation `avator/` and `llm/` paths
- Add a scope-classification regression test

## Expected Outcome

Both local builds and a clean Candidate workspace obtain the DragonBones native source through the existing CMake archive mechanism, and the full Android build can continue.

[DONE]
