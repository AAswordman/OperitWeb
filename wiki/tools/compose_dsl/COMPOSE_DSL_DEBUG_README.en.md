# Compose DSL UI Dump

## Purpose

`dump_current_compose_dsl_ui.bat` is used to capture a runtime snapshot of the `compose_dsl` page currently being displayed, making it easier to investigate:

- Whether the component tree output by the script is correct
- Whether the tree parsed by the host is consistent
- Whether the layout coordinates and sizes match expectations
- Whether the current page's `state` / `memo` is abnormal

This toolset is well suited to investigating problems where "the structure looks right, but the interface displays incorrectly".

## Usage

1. Open the `compose_dsl` page you want to debug with the host.
2. Wait until the page reaches the state you want to observe.
3. Run:

```bat
d:\Code\prog\assistance\tools\compose_dsl\dump_current_compose_dsl_ui.bat
```

## Prerequisites

- `adb` is installed and usable
- At least one debuggable device is connected
- The host version on the device already includes the current debug export logic
- `com.ai.assistance.operit.debug` or `com.ai.assistance.operit` is installed on the device; when the script does not specify one, the Debug package is preferred

If multiple devices are connected, the script prompts you to select a target device.

If both the Debug and Release APKs are installed, you can specify the target with an environment variable:

```bat
set OPERIT_APP_PACKAGE=com.ai.assistance.operit
d:\Code\prog\assistance\tools\compose_dsl\dump_current_compose_dsl_ui.bat
```

## Export Location

The script pulls the files back to the local directory:

```text
d:\Code\prog\assistance\debug_output\compose_dsl_dump\<时间戳>\
```

For example:

```text
d:\Code\prog\assistance\debug_output\compose_dsl_dump\20260425-153457\
```

## File Descriptions

- `dump_manifest.json`
  Basic information about the current page, including package name, module name, phase, and whether it is still loading / dispatching.

- `source_script.js`
  The UI script source actually executed by the current page.

- `raw_render_result.txt`
  The text form of the JS raw render return value.

- `raw_render_result.json`
  If the raw return value can be parsed as JSON, the formatted version is saved here.

- `parsed_render_result.json`
  The complete render result after host parsing.

- `compose_tree.txt`
  The parsed component tree, for quickly checking the structure.

- `compose_tree.json`
  The JSON form of the component tree.

- `layout_nodes.txt`
  Real layout information for each node, including `x / y / width / height`.

- `layout_nodes.json`
  The JSON form of the layout information.

- `compose_layout_tree.txt`
  A readable merged version of "component tree + layout information".

- `state.json`
  The current page state.

- `memo.json`
  The current page memo.

## Recommended Investigation Order

1. First look at `dump_manifest.json`
   Confirm whether what was captured is the current page, and whether the page has stabilized.

2. Then look at `compose_tree.txt`
   Judge whether the script output structure is correct.

3. Then look at `layout_nodes.txt` or `compose_layout_tree.txt`
   Judge whether the real layout is where the problem lies.

4. If you suspect a state anomaly, then look at `state.json`
   Confirm whether the page display problem is caused by script state.

5. If you suspect a deviation in host parsing, then compare:
   `raw_render_result.json` and `parsed_render_result.json`

## Common Scenarios

- Text, icons, or buttons are not centered
- `weight`, `fillMaxWidth`, or `padding` did not take effect as expected
- Page state after `onLoad` does not match expectations
- The tree written by the script differs from the tree ultimately understood by the host

## Notes

- This toolset captures a "snapshot of the page currently being displayed", not a historical page.
- If the page is still recomposing frequently or loading asynchronously, it is recommended to wait until it stabilizes and capture again.
- If the host debug export logic is updated, the host needs to be reinstalled before the new exported fields can be seen.
