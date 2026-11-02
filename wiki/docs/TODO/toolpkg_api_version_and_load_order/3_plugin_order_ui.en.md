# Plugin List Order

## Previous Implementation

The plugin list already has a drag-to-sort UI, but the order only affects list display.

## Goal

Reuse the current sort UI and save mechanism, so that the user order becomes the base order for resolving the ToolPkg load order; the `requires` dependency relationships in the manifest take higher priority.

[DONE]
