---
title: MNN schema Generation and Android Build Gate Fix
For_Agent: Record the native build fix process for PR #926
---

# MNN schema Generation and Android Build Gate Fix

## Current State

PR #926's JVM unit tests already passed, but the full Android gate failed at `:mnn:buildCMakeDebug[arm64-v8a]`. The MNN commit fetched from the cloud updated `schema/default/MNN.fbs` and `source/core/OpCommonUtils.cpp`, but carried an out-of-sync `schema/current/MNN_generated.h`, so it was missing `FusedLinearParam`-related declarations.

## Intent and Scope

- Add a real schema generation step in `llm/mnn/CMakeLists.txt`
- Build a host `flatc` from the FlatBuffers source bundled with the fetched MNN
- Regenerate `schema/current/*.h` before `add_subdirectory(MNN)`
- Document the host compiler requirements and troubleshooting entry points in the Android build guide
- Keep the existing Git wiring and normal merge flow, without changing plugin marketplace business interfaces

## Expected Outcome

The MNN source and generated headers come from the same fetched revision, a clean CI workspace can compile `:mnn`, and PR #926 is merged only after all `Candidate checks` pass.

## Related

- Branch: `fix/jvm-json-test-runtime`
- PR: [#926](https://github.com/AAswordman/Operit/pull/926)
- Kept: `origin/fix/withdrawn-entry-republish`
