---
scope: tools
---

# Category Layout and Entrypoint Migration

## Old Implementation

Multiple standalone tools sat directly in the `tools/` root directory. Some scripts derived the project root directory from their own location, so after moving they would point to the wrong location; documentation, tests, and in-app development script download addresses also referenced the old entrypoints.

## Modification Intent

- Move the ADB, ToolPkg, example package, Shower, Compose DSL, and native-ripgrep entrypoints to their respective places
- Let each moved script continue to correctly locate the repository root directory and same-directory resources
- Switch all in-repository calls to the new entrypoints

## New Layout

```
tools/
	adb/
	compose_dsl/
	example_packages/
	ffmpeg/
	github/
	hotbuild/
	mcp_bridge/
	native_ripgrep/
	shell_identity_launcher/
	shower/
	string/
	toolpkg/
	sandboxpackage_dev_install_or_update.js
```

## Expected Results

Except for fixed public installation scripts, the root directory no longer holds scattered executable tool files. Each new entrypoint has a single, traceable location, and no old-path compatibility scripts exist.

[DONE]
