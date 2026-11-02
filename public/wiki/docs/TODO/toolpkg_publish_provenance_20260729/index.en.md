---
For_Agent: ToolPkg publish provenance injection and protected archiving
---

# ToolPkg publish processing

## Current state

Direct uploads in the past only processed scripts when obfuscation was enabled; with obfuscation disabled they were uploaded as-is, so no marketplace provenance was written. The `src/` directory and source maps in ToolPkg archives were also retained along with the package.

## Changes

- Direct uploads always write the currently logged-in user's marketplace provenance.
- With obfuscation disabled, executable source code is kept, and only the script `METADATA` or the ToolPkg main entry point is rewritten.
- With obfuscation enabled, build a reachable entry set along the manifest entry point and static relative module references, keeping only the manifest, the main entry point, subpackage entry points, declared resources/WASM, and the modules those entries depend on; unreachable `src/`, source maps, tests, and build files are all excluded.
- Multiple subpackages are still handled separately, and marketplace provenance is ToolPkg container-level information carried by the main entry point.

Existing GitHub Release assets are external immutable references; loading that mode does not rewrite remote files; to obtain provenance injection, publish the processed assets via direct upload.

## Scope

- `app/src/main/java/com/ai/assistance/operit/util/ToolPkgArtifactMinifier.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/GitHubForgePublishService.kt`

[DONE]
