---
title: ToolPkg API Version and Load Order
status: completed
---

# ToolPkg API Version and Load Order

## Original State

The ToolPkg manifest currently only has the package's own `version`, with no field declaring the host ToolPkg API version. Package loading also has no unified model for inter-package dependencies and load order; the relationship between the installed package list order and the startup load order has not been clearly established.

## Intent of the Change

Add a stable, recognizable host API version convention for ToolPkg, and support packages declaring required packages and load order constraints. Old packages missing `api_version` are interpreted as `1.0.0`; Operit starts supporting `1.0.1` in `1.12.1+4`.

Dependencies and ordering are resolved only during the host load phase; runtime state or persisted state is not brought into the ToolPkg API. The plugin list reuses the existing drag-to-sort entry, and the sort result feeds into the load order when there are no manifest ordering constraints.

## Scope

- Manifest API version field and compatibility checks
- Operit version to ToolPkg API support declarations
- `requires` object list, package version constraints, and dependency load order
- ToolPkg startup load order resolution and error messages
- Plugin list order saving and load order integration
- DTS API introduction-version annotations
- ToolPkg format and developer documentation

## Step Records

- [DONE] 1_manifest_and_compatibility.md
- [DONE] 2_package_dependencies_and_order.md
- [DONE] 3_plugin_order_ui.md
- [DONE] 4_dts_and_documentation.md
- [DONE] 5_market_api_version.md
