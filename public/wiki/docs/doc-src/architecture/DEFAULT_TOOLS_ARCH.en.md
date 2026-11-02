# Default Tools Architecture and Parameter Change Checklist

This document describes the overall architecture of this project's "default tools" and, when you want to **change a tool's parameters/signature**, which files and locations need to be updated in sync.

Goal: avoid changing only the execution logic while forgetting to update the schema / JS wrapper / examples / docs, which would cause runtime tool-call failures or inconsistent types on the script side.

---

## 1. What Default Tools Consist Of (Top-to-Bottom Data Flow)

The default tool chain is roughly as follows:

1. **Tool Prompt / Schema** (the tool's "manual" for the LLM)
2. **Tool registration** (binding toolName -> executor)
3. **Tool execution implementation** (the Kotlin-side logic that actually does the work)
4. **Script-side wrapper (JS Tools)** (a more convenient API for JS/TS scripts)
5. **Examples and type definitions** (examples/types and examples/**)
6. **Documentation** (docs/doc-src/package-dev, etc.)
7. **Packaged resources / artifacts** (app/src/main/assets/packages/*.js, etc.)

Of these, (1)(4)(5)(6) are the "external contract", and (2)(3) are the "implementation".

---

## 2. Which Files Must Be Changed When Changing Parameters (Checklist)

Grouped below by "must change / commonly missed / optional verification".

### 2.1 Must Change: Tool Schema / Prompt

- **File**: `app/src/main/java/com/ai/assistance/operit/core/config/SystemToolPrompts.kt`
- **What to do**:
  - Modify the corresponding tool's `parametersStructured` (add/delete/rename/required)
  - Update `description` / `details` (especially rules, examples, and parameter explanations)
  - If there are both Chinese and English descriptions, be sure to update both

Why it must be changed:
- This is the basis on which the LLM generates tool calls; if it is not changed, the LLM will keep calling with the old parameters.


### 2.2 Must Change: Tool Registration (toolName -> executor)

- **File**: `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`
- **What to do**:
  - When the tool name is unchanged, registration generally does not need to change, but confirm that the executor being called has not changed
  - If the tool name/grouping changes, adjust the registration entries in sync

Why it must be checked:
- If you changed the tool name or split a tool and registration was not updated in sync, you will get "tool does not exist / cannot execute".


### 2.3 Must Change: Kotlin Execution Implementation (Parameter Reading and Validation)

- **Common directories**:
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/*`
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/debugger/*`
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/admin/*`
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/root/*`
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/*`
  - `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/ToolGetter.kt` (selects the concrete implementation by permission level)
- **What to do**:
  - Replace the old parameter reading logic with the new parameters (`tool.parameters.find { it.name == "..." }`)
  - If a tool has an override / alternative implementation under the `debugger/root/admin/accessibility` directories: those implementations must likewise be updated in sync for parameter reading and validation
  - Add validation for new parameters: required, mutually exclusive, defaults, compatibility strategy
  - Update error messages (they should guide correct usage)

Why it must be changed:
- Even if the schema is changed, if this is not changed the execution layer will not get the parameters or will behave incorrectly.


### 2.4 Must Change: JS-Side Tool Wrapper (Tools.*)

- **File**: `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt`
- **What to do**:
  - Update the corresponding JS wrapper function signature
  - Update the field names of the `params` object constructed inside the wrapper
  - Pay attention to handling of `undefined/null` (a common issue with JS parameter passing)

Why it must be changed:
- Many scripts call `Tools.Files.xxx` rather than calling toolCall directly.


### 2.5 Must Change: TypeScript Type Definitions (Contract for Script Authors)

- **File**: `examples/types/*.d.ts` (especially `examples/types/files.d.ts`, `examples/types/chat.d.ts`, `examples/types/core.d.ts`, `examples/types/system.d.ts`, etc.)
- **What to do**:
  - Update function signatures and parameter types
  - If new enum/union types were added (e.g. `"replace" | "delete" | "create"`), add the type definitions
  - Confirm that return types and field names are still correct

Why it must be changed:
- This is the source of type hints for script authors writing TS.


### 2.6 Must Change: Example Code (TS/JS)

- **Directory**: `examples/**`
- **What to do**:
  - Update the call parameters for `Tools.*` in the examples (usually prioritize changing the `*.ts` source)
  - If the repository contains `*.ts -> *.js` compiled artifacts: generally only the TS needs to be changed and the artifacts rebuilt; manually modifying the `*.js` is not recommended
  - If the project has "compiled JS artifacts / packaged single files", ensure the artifacts are also updated after rebuilding (see the next section)

Why it must be changed:
- Examples are actual usage and will directly mislead users; they may also be packaged into the app.

Supplementary note (advice-only tools):
- If a tool is only used for explanation/prompts (e.g. `usage_advice`), add `advice: true` in the examples metadata.
- Tools marked `advice: true` are not required to have a real runtime implementation and may skip the "tool does not exist" check.


### 2.7 Must Change: Packaged Resources / Artifact Files

- **Common locations**:
  - `app/src/main/assets/packages/*.js`
  - `examples/*.js` (may be build artifacts or distribution bundles)

What to do:
- If these files are generated by build scripts: they should be **rebuilt** to generate them (preferred)
- If the current repository commits artifacts directly: the call signatures in these artifacts need to be manually updated in sync

Supplementary note (packages sync convention):

- `examples/*.ts` usually serve as the **source code** of script packages
- `examples/*.js` serve as **compiled artifacts / distribution artifacts** (manual editing not recommended)
- `app/src/main/assets/packages/*.js` serve as the package files loaded by the App at runtime
- The repository provides `tools/example_packages/sync_example_packages.py`: it copies `examples/*.js` to `app/src/main/assets/packages/*.js` according to `tools/example_packages/packages_whitelist.txt`

Sync execution convention (important):

- When syncing packages, only this one command needs to be executed: `python tools/example_packages/sync_example_packages.py`
- Do not additionally manually copy `examples/*.js` to `assets/packages/`, to avoid source/artifact inconsistency

Therefore:

- When modifying script package functionality, prioritize changing `examples/<package>.ts`, then generate the corresponding `examples/<package>.js` via build/compile
- Finally, use `tools/example_packages/sync_example_packages.py` to sync to `assets/packages/`
- **Directly manually modifying** `examples/*.js` or `assets/packages/*.js` is **not recommended** (to avoid being overwritten by later builds or causing source/artifact inconsistency)

Why it must be changed:
- The App may directly load the JS packages in assets at runtime; if you only changed the TS and not the assets, it will still call with the old parameters.


### 2.8 Must Change: Documentation

- **Common locations**:
  - `docs/doc-src/package-dev/*.md`
  - `docs/doc-src/**/*.md`
- **What to do**:
  - Update API descriptions, parameter descriptions, and examples
  - Update "key rules / notes"

Why it must be changed:
- Documentation is the external explanation; many problems actually come from documentation being inconsistent with the implementation.

---

## 3. Strongly Recommended: Globally Search for Old Parameter Names (Find Omissions)

When you change a parameter `content` to `old/new/type`, it is recommended to perform these searches (adjust keywords as needed):

- Search `"apply_file"` (tool name)
- Search the old parameter name `"content"` (confirm nothing remains in toolCall, schema, examples, or assets)
- Search the new parameter names `"old"` / `"new"` / `"type"` (confirm all usage locations are complete)

Note: if you have wrapped the same tool interface in Kotlin/TS/JS all three, a leftover in any one of them will cause inconsistency.

---

## 4. Compile/Run-Level Self-Checks (Avoid Explosions Only After Submitting)

### 4.1 Kotlin Compile Self-Check (Recommended)

- Run `:app:compileDebugKotlin` (or an equivalent task)
- Purpose: catch signature/reference errors in `JsTools.kt`, `ToolRegistration.kt`, and `Standard*Tools.kt`

### 4.2 Example/Script-Side Checks (As Needed)

- If examples have a TypeScript build process: run a build once (e.g. `npm run build` or a build script in the repository)
- If assets are generated by a build: regenerate assets by repackaging

---

## 5. Summary of Common Pitfalls

- **Only changed the execution layer, not the prompt**: the LLM still calls with the old parameters
- **Only changed the prompt, not the JS wrapper**: scripts still assemble `params` with the old parameters
- **Only changed the TS, forgot the bundle in assets**: the App still loads the old bundle at runtime
- **Parameter names changed but error messages not updated**: users do not know the correct usage and keep trying and failing

---

## 6. Extension: When You Add a New Tool (Short Version)

When adding a new tool, you usually need:

- `SystemToolPrompts.kt`: add a ToolPrompt
- `ToolRegistration.kt`: register the executor
- `Standard*Tools.kt`: implement the logic
- `JsTools.kt`: expose it to the script side (if needed)
- `examples/types/*.d.ts`: type definitions (if needed; for `Tools.System.*`, remember to sync `examples/types/system.d.ts`)
- `docs/doc-src/`: add documentation
