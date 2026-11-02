# 03 Delivery

## Current State

`sync_example_packages.py` compiles TypeScript ToolPkg under `examples/` that contain a `manifest.json` and generates `.toolpkg` files.

## Changes

- Add the example manifest, TypeScript configuration, and runtime files.
- Make the Runtime directory and network listening rules explicitly visible in the package description.

## Expected Result

The example can enter the existing ToolPkg packaging pipeline, without modifying the OpenCode container.

## Current Verification

- `com.operit.sidebar_deepseek_harness` has been reinstalled using the debug install broadcast, without uninstalling the existing container.
- It has been confirmed in the phone's Linux container that the `node-pty` ARM64 build artifact can be loaded by Node 24.
- It has been reinstalled with the fixed `dist`; the sidebar enters the DSH official API Key configuration page, and `dsh web` listens on `127.0.0.1:3081`.
