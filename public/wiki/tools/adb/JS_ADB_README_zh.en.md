# ADB JavaScript Execution and Debugging Guide

This set of ADB JS scripts is not simply about "pushing a file to a phone and running it".
In the Operit repository, they are the primary **Android-side JavaScript running, debugging, and verification entry points**.

They are suitable for:

- Pushing JS directly to a real Android device and running it
- Debugging ordinary `.js` sandbox / package files without going through the full import flow
- Verifying exported functions' argument passing, return values, `complete(...)`, and structured results
- Reproducing runtime issues that only occur on the device side
- Running the JS bridge / script mode / smoke test assets under `app/src/androidTest/js`

If you want to execute "top-level script mode" directly instead of calling an exported function, use `run_sandbox_script.sh` / `run_sandbox_script.bat`.

## Division of Labor Among the Tools

### `tools/adb/execute_js.bat` / `tools/adb/execute_js.sh`

This is the most commonly used single-file runner.

What it does:

- Temporarily pushes a JS file to the device
- Calls an exported function in Operit's Android JS runtime
- Returns a structured result

Suitable for:

- Ordinary single-file JS debugging
- Quickly verifying the logic of a function
- Reproducing device-side bugs
- Doing a one-off verification when developing an ordinary `.js` package

### `tools/adb/execute_js_dir.bat` / `tools/adb/execute_js_dir.sh`

This is the directory-entry runner.

What it does:

- Executes an entry file, taking a directory as the unit
- Bundles first, then pushes to the device
- Supports local `require(...)` / multi-file dependencies

Suitable for:

- Entry points that depend on multiple local modules
- Running test entry points in `app/src/androidTest/js`
- Running directory-based tests such as browser / bridge / harness

### `tools/adb/run_sandbox_script.bat` / `tools/adb/run_sandbox_script.sh`

This is the script-mode runner.

What it does:

- Directly executes a top-level sandbox script
- Does not require an exported function
- Suitable for verifying the script mode contract

Suitable for:

- Quickly running a top-level script
- Verifying `emit(...)` / `complete(...)` / `return`
- Doing inline snippet / top-level behavior tests

## Real Test Assets

The [app/src/androidTest/js](/d:/Code/prog/assistance/app/src/androidTest/js) directory in the repository is not an ordinary example directory; it is one of the important use cases for this set of tools.

It includes:

- JS bridge contract tests
- JS bridge edge case tests
- Script mode contract tests
- Browser tool smoke / probe
- Runtime test assets such as utility / ffmpeg / ttscleaner

Typical directories:

- [bridge_contract](/d:/Code/prog/assistance/app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_contract)
- [bridge_edges](/d:/Code/prog/assistance/app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/bridge_edges)
- [script_mode_contract](/d:/Code/prog/assistance/app/src/androidTest/js/com/ai/assistance/operit/core/tools/javascript/script_mode_contract)
- [browser main.js](/d:/Code/prog/assistance/app/src/androidTest/js/com/ai/assistance/operit/core/tools/defaultTool/standard/browser/main.js)
- [ttscleaner.js](/d:/Code/prog/assistance/app/src/androidTest/js/com/ai/assistance/operit/util/ttscleaner/ttscleaner.js)

## Conclusions Up Front

If you just want to quickly decide "which one should I use now":

- To debug an exported function in an ordinary `.js` file, use `execute_js.*`
- If the entry file depends on other modules in the same directory, or you are running a directory-based test in `app/src/androidTest/js`, use `execute_js_dir.*`
- To verify top-level script mode behavior without writing an exported function, use `run_sandbox_script.*`
- If you changed a package / toolpkg in `examples/` and want to hot-update it into the package system on the device, then verify it in the UI or package management, use `tools/example_packages/sync_example_packages.py`
- If you changed a toolpkg debugging tool in `examples/`, such as `operit_editor`'s `debug_install_toolpkg`, the usual flow is to run `tools/example_packages/sync_example_packages.py` first, then use `execute_js.bat` to call that tool

## Quick Start

### Windows: Execute a Single-File Exported Function

```cmd
tools\adb\execute_js.bat path\to\your\script.js functionName @params.json
```

Example:

```cmd
tools\adb\execute_js.bat examples\operit_editor.js debug_install_toolpkg @params.json
```

### Linux/macOS: Execute a Single-File Exported Function

```bash
./tools/adb/execute_js.sh path/to/your/script.js functionName '{"param1":"value1"}'
```

### Execute a Whole Directory Entry (Supports `require(...)`)

Windows:

```cmd
tools\adb\execute_js_dir.bat app\src\androidTest\js com\ai\assistance\operit\core\tools\javascript\bridge_contract\bridge_contract_runner.js run @params.json
tools\adb\execute_js_dir.bat app\src\androidTest\js com\ai\assistance\operit\core\tools\defaultTool\standard\browser\main.js run "{}"
```

Linux/macOS:

```bash
./tools/adb/execute_js_dir.sh app/src/androidTest/js com/ai/assistance/operit/core/tools/javascript/bridge_contract/bridge_contract_runner.js run @params.json
```

### Execute a Top-Level Sandbox Script

Windows:

```cmd
tools\adb\run_sandbox_script.bat temp\probe.js @params.json
```

Linux/macOS:

```bash
./tools/adb/run_sandbox_script.sh temp/probe.js @params.json
```

## Viewing Results

These runners no longer rely on `adb logcat` to capture output; instead they wait for a structured result file on the device.
After execution finishes, a JSON result is printed, usually containing:

- `success`
- `result`
- `error`
- `events`
- `durationMs`

This is especially useful for runtime debugging and JS contract testing, because failure causes are more concentrated and there is no need to manually sift through large volumes of logs.

You can adjust the wait timeout with the following environment variable:

```cmd
set OPERIT_RESULT_WAIT_SECONDS=30
tools\adb\execute_js.bat examples\my_script.js main @params.json
```

### Debug / Release Dual-Package Selection

These four ADB execution scripts support both of the following Operit applicationIds:

- `com.ai.assistance.operit.debug`
- `com.ai.assistance.operit`

When nothing is configured, the scripts query the packages installed on the device and prefer the Debug package; if only the Release package is installed, the Release package is used. Each run prints the finally selected applicationId, and the file directory and receiver follow that value. The JS execution action is fixed as `com.ai.assistance.operit.EXECUTE_JS`, because it is the Receiver's cross-build protocol and does not gain a `.debug` suffix along with the applicationId.

If both APKs are installed at the same time, you can specify one explicitly:

```cmd
set OPERIT_APP_PACKAGE=com.ai.assistance.operit.debug
tools\adb\execute_js.bat examples\my_script.js main @params.json
```

Linux/macOS:

```bash
OPERIT_APP_PACKAGE=com.ai.assistance.operit.debug ./tools/adb/execute_js.sh examples/my_script.js main '{}'
```

The ToolPkg debug installer supports the same environment variable, and also supports `--app-package <applicationId>`; the example-package hot-update script supports a parameter of the same name. The specified package must already be installed on the selected device.

## What Each Tool Does and How to Call It

### 1. What `execute_js.*` Is For

It is the most direct "real Android device JS runner".

You give it:

- A JS file
- An exported function name
- A JSON parameter payload

It puts that file on the device and calls that function directly in Operit's JS runtime.

Suitable for:

- Single-file feature verification
- Debugging an exported function
- Reproducing device-side runtime errors
- Debugging a tool implementation inside a package

Most common call:

```cmd
tools\adb\execute_js.bat examples\operit_editor.js debug_install_toolpkg @params.json
```

When writing a new script, the minimum runnable requirements are:

- The file is valid JS, not raw TS
- The target function is already exported
- Parameters are passed in as JSON

For example:

```javascript
function main(params) {
  return {
    success: true,
    echo: params
  };
}

exports.main = main;
```

### 2. What `execute_js_dir.*` Is For

It is the "directory-entry executor".

If your entry file is not an isolated file, but also does `require("./xxx")` and depends on tool modules, test tools, runners, or helpers in the same directory, stop using the single-file executor and switch to this one.

Suitable for:

- Test entry points under `app/src/androidTest/js`
- Directory-based tests such as bridge contract / browser smoke / harness
- A new multi-file test directory you added yourself

Most common call:

```cmd
tools\adb\execute_js_dir.bat app\src\androidTest\js com\ai\assistance\operit\core\tools\javascript\bridge_contract\bridge_contract_runner.js run @params.json
```

Call format:

```cmd
tools\adb\execute_js_dir.bat <root directory> <entry relative path> <function name> [JSON parameter|@parameter file]
```

The most important points here are:

- The first argument is the "test root directory"
- The second argument is the "entry file relative to that root directory"
- The third argument is usually the `run` exposed by the runner

### 3. What `run_sandbox_script.*` Is For

It does not call an exported function; it directly runs a "whole top-level script".

Suitable for:

- Verifying the script mode contract
- Quickly trying `emit(...)`
- Quickly trying `complete(...)`
- Quickly running a temporary probe script

Most common call:

```cmd
tools\adb\run_sandbox_script.bat temp\probe.js @params.json
```

If your code is naturally "top-level execution", this is more convenient than first wrapping it in `exports.main = ...`.

### 4. What `tools/example_packages/sync_example_packages.py` Is For

It is not simply a "copy files script"; it is the synchronization entry point when developing packages in `examples/`.

Its most important roles are:

- First precompiling the relevant TS in `examples/` into JS
- Packaging directories with a `manifest.json` / `manifest.hjson` into `.toolpkg`
- Synchronizing ordinary `.js` or `.toolpkg` files to `app/src/main/assets/packages`
- If a device is connected, hot-updating changed packages to the device

So it is suitable for:

- You changed a formal package in `examples/`
- You want package management / the sandbox package list / built-in loading logic to see the latest result
- You want to verify the folder -> `.toolpkg` -> debug install chain

Most common call:

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --include sidebar_bing_action
```

If you want to test all synchronizable items in examples in full, you can use:

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --mode test
```

If you only want to update local assets and do not want to touch device hot-updates:

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --include sidebar_bing_action --no-hot-reload
```

## How to Add Tests

The easiest thing to confuse here is: not every "test" should go in the same place.

### 1. Add a Single-File Function Test

If you just want to verify whether a function's logic is correct, the lightest-weight approach is:

- First write an ordinary JS file
- Export a `main` or `run`
- Call it directly with `execute_js.*`

This approach is suitable for:

- Small logic verification
- Parameter parsing verification
- Return structure verification
- A minimal reproduction of a bug

### 2. Add a Directory-Based Runtime Test

If your test references multiple local modules, it is recommended to put it directly under [app/src/androidTest/js](/d:/Code/prog/assistance/app/src/androidTest/js), organized as a small directory.

Recommended organization:

- One entry runner file, e.g. `xxx_runner.js`
- Several test files / helper files
- The runner exposes `run(params)`

That way you can run it directly with:

```cmd
tools\adb\execute_js_dir.bat app\src\androidTest\js <your entry relative path> run "{}"
```

This kind of test is best suited for:

- Bridge contract
- Multi-module collaboration
- Real runtime smoke tests
- Tests that need local `require(...)`

### 3. Add a Script Mode Test

If what you want to test is:

- Top-level `return`
- `emit(...)`
- `complete(...)`
- Differences between script mode and function mode

then do not force it into an exported-function test; write it directly as a script mode file and run it with `run_sandbox_script.*`.

### 4. Add Verification for a Package / Toolpkg in `examples/`

If you are adding something that is genuinely meant to be loaded by the package system, the point is not only "the JS can run"; you also need to verify that "the package can be synchronized, refreshed, installed, and recognized".

In that case, the recommended approach is:

- Add or modify your `.ts` / `.js` / manifest directory under `examples/`
- If it is a directory-based package, make sure it has a `manifest.json` or `manifest.hjson`
- Synchronize with `tools/example_packages/sync_example_packages.py`
- Then call the relevant debugging tool with `execute_js.bat`, or verify the loading result directly in the app

In other words:

- The runners test "whether this JS can execute in the Android runtime"
- `tools/example_packages/sync_example_packages.py` tests "whether this examples package can enter the real package loading chain"

## How to Work Together with `tools/example_packages/sync_example_packages.py`

### Scenario 1: You Changed an Ordinary JS Script

In this case, syncing first is usually unnecessary.

Directly:

```cmd
tools\adb\execute_js.bat path\to\script.js main @params.json
```

Because you are only verifying the script logic, not package loading.

### Scenario 2: You Changed a Package in `examples/`

Recommended order:

1. Change `examples/...`
2. Run `tools/example_packages/sync_example_packages.py`
3. Check whether it synchronized the output to `app/src/main/assets/packages`
4. If a device is connected, also verify whether the hot-update succeeded
5. Then verify the feature in the app or with a debugging tool

This is suitable for:

- Ordinary `.js` packages
- Examples that are to enter the packages list
- Changes to package descriptions, manifests, or dependency structures

### Scenario 3: You Changed a Directory-Based Toolpkg

This is the scenario that most needs to work together with `tools/example_packages/sync_example_packages.py`.

Recommended order:

1. Change `examples/<toolpkg directory>`
2. Run `tools/example_packages/sync_example_packages.py --include <directory name>`
3. Let it package the directory into a `.toolpkg`
4. Let it synchronize the generated artifact to assets and the device
5. Then use `operit_editor`'s `debug_install_toolpkg` or a related debugging entry point to verify the installation result

That way you test the complete chain:

- Whether the directory contents can be packaged correctly
- Whether the `.toolpkg` can be hot-updated to the device
- Whether debug install can recognize this package
- Whether the package really enters the loading list after refresh

### Scenario 4: You Changed a Debugging Tool Such as `operit_editor` Itself

Recommended order:

1. First run `tools/example_packages/sync_example_packages.py` to update `operit_editor` itself
2. Then prepare a package / toolpkg to be installed
3. Use `execute_js.bat` to call `operit_editor.js`'s debugging function
4. Look at the success, failure, and related warnings in the structured result

For example:

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --include operit_editor --include sidebar_bing_action
tools\adb\execute_js.bat examples\operit_editor.js debug_install_toolpkg @params.json
```

This is suitable for verifying:

- Whether the debug install call is correct
- Whether a folder packaged into a `.toolpkg` can be installed correctly
- Whether the warnings / errors returned to the caller after installation completes are complete

## Recommended Call Checklist

### 1. Run an Ordinary Exported Function

```cmd
tools\adb\execute_js.bat examples\my_script.js main @params.json
```

### 2. Run an `androidTest/js` Directory Test Entry

```cmd
tools\adb\execute_js_dir.bat app\src\androidTest\js com\ai\assistance\operit\core\tools\javascript\bridge_contract\bridge_contract_runner.js run @params.json
```

### 3. Run a Top-Level Script Mode Probe

```cmd
tools\adb\run_sandbox_script.bat temp\probe.js @params.json
```

### 4. Synchronize an `examples/` Package to Assets and the Device

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --include sidebar_bing_action
```

### 5. Call the Debug Install Tool After Synchronizing

```cmd
d:\Code\prog\assistance\.venv\Scripts\python.exe d:\Code\prog\assistance\tools\example_packages\sync_example_packages.py --include operit_editor --include sidebar_bing_action
tools\adb\execute_js.bat examples\operit_editor.js debug_install_toolpkg @params.json
```

## Script Mode Notes

When you use `run_sandbox_script.sh` / `run_sandbox_script.bat`, or take the `source_code` path of `debug_run_sandbox_script` in a package tool, the code executes as a **top-level script**, not as `function(params) { ... }`.

This means:

- Use `console.log(...)` / `console.info(...)` / `console.warn(...)` / `console.error(...)` for logging
- Use `emit(...)` to send intermediate events
- Use `return result` or `complete(...)` to finish execution
- Do not assume `params` will appear directly in the top-level scope
- Do not use `intermediate(...)`; the current convention is `emit(...)`

Recommended top-level snippet:

```javascript
console.log("inline debug start");
emit({ stage: "inline", ok: true });
complete({
  success: true,
  message: "inline debug finished"
});
```

## JS File Requirements

### For `execute_js.*`

- The file must be valid JavaScript
- The target function must be exported, e.g. `exports.myFunction = myFunction`
- The function receives `params`
- It can `return result`, or call `complete(result)`

Example:

```javascript
function myFunction(params) {
  const name = params.name || "default";
  return {
    success: true,
    result: `Result: ${name}`
  };
}

exports.myFunction = myFunction;
```

### For `run_sandbox_script.*`

- No exported function is required
- Runs in top-level script mode
- Better suited to script mode verification and quick probes

## Technical Path

1. The script pushes the JS file to a temporary directory on the device
2. `execute_js_dir.*` first bundles the directory entry into a single file
3. JSON parameters are first written to a temporary file, then pushed to the device, to avoid command-line quoting issues
4. The execution request is sent via ADB broadcast
5. The app's `ScriptExecutionReceiver` receives the request
6. `JsEngine` executes the function or script in the app runtime
7. The execution result is written to a JSON file on the device side
8. The executor waits for that result file and prints it

Related receivers:

- [ScriptExecutionReceiver.kt](/d:/Code/prog/assistance/app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt)
- [ToolPkgDebugInstallReceiver.kt](/d:/Code/prog/assistance/app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgDebugInstallReceiver.kt)

## Troubleshooting

### 1. ADB Not Found

Confirm that the Android SDK's `platform-tools` has been added to PATH.

### 2. No Device Detected

- Confirm the device is connected
- Confirm USB debugging is enabled
- Confirm the computer has been granted debugging authorization

### 3. Broadcast Sent but Nothing Executed

- Confirm the app is installed
- Confirm the target Receiver is registered
- Look at `error` / `events` in the structured result

### 4. JS Syntax Error

- Do not feed TypeScript syntax directly to the runner
- Check whether the exported function exists
- Check whether the parameter JSON is correct

### 5. Multi-File Dependencies Won't Run

Prefer switching to `execute_js_dir.*`; do not keep forcing `require(...)` scenarios through the single-file executor.

## Security Notes

- This set of tools is mainly for development, debugging, and verification
- They rely on Receivers inside the app receiving external broadcasts
- In production environments, be cautious about exposing such debugging entry points
