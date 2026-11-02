---
For_Agent: ToolPkg AssemblyScript WASM enterprise core module integration record
---

# ToolPkg AssemblyScript WASM Module Integration

## Current Status
- The ToolPkg main runtime is still executed by QuickJS running JavaScript.
- Enterprise plugin core algorithms can be declared as AssemblyScript `.wasm` modules, published encrypted with the `.toolpkg` protection format.
- The Android side has integrated a native WAMR runtime, executing WASM through a standalone `toolpkgwasm` so.

## Intent
- Keep the existing JS plugin entry points, `exports`, and external interface call conventions stable.
- Allow enterprise plugins to compile core algorithms into `.wasm` using AssemblyScript.
- Let the manifest explicitly declare `.wasm` module IDs, paths, exported function names, and the ABI.
- Let `.wasm` files enter the existing protection format as `.toolpkg` resources, with the runtime reading the plaintext bytes of encrypted resources according to module metadata.
- Provide a `ToolPkg.wasm.call(moduleId, exportName, args)` JS bridge; JS is only responsible for entry dispatch and argument organization, while core logic runs in native WAMR.
- Provide a TS-first example project, so authors write `src/main.ts` and `src/wasm/*.ts`, and the packaging stage generates the `main.js` the host needs.

## Scope
- The `ToolPkgManifest.wasmModules` manifest field
- `ToolPkgWasmModuleRuntime` runtime metadata
- Display of the WASM module count in package details
- The AssemblyScript delivery specification in the ToolPkg format documentation
- The native WAMR runtime, Kotlin module cache, JS bridge, and TS declarations

## Steps

1. Manifest and detail models
   - Parse `wasm_modules`
   - Validate module IDs, `.wasm` paths, and export names
   - Display the WASM module count in package details
   - [DONE]

2. Android WASM runtime selection
   - Compare wasm3, WAMR, and Wasmtime Android integration costs
   - Confirm the QuickJS backend call boundary, memory parameter-passing approach, and threading model
   - Select the WAMR native so, avoiding a JVM WASM runtime on the execution hot path
   - [DONE]

3. `ToolPkg.wasm` JS bridge
   - Design the `call` API
   - Only allow access to module IDs declared in the current container's manifest
   - Use typed JSON to explicitly define numeric parameter and return-value boundaries
   - Current ABI: `i32`, `i64`, `f32`, `f64`
   - [DONE]

4. AssemblyScript + TS-first template
   - Provide `src/wasm/core.as.ts`
   - Provide `src/wasm/core.ts` typed facade
   - Provide `src/main.ts`
   - Provide `asconfig.json`
   - Provide a manifest example and packaging script
   - Example location: `examples/toolpkg_wasm_demo`
   - [DONE]
