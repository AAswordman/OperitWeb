# 02 Sidebar Surface

## Current State

ToolPkg already supports `main_sidebar_plugins` routing and the JavaScript WebView.

## Changes

- Register the DeepSeek Harness sidebar route and navigation entry.
- The page shows Runtime initialization and WebView loading status, and displays diagnostic information when startup fails.
- Do not inject Android or ToolPkg native capabilities into the DSH page.

## Expected Result

The user enters DeepSeek Harness from the Operit main sidebar and uses its native Web UI.
