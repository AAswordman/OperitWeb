# Native Dispatch Boundary

## Goal

Remove internal version fields from business parameters, so that underlying tool handlers are not aware of the ToolPkg API version.

## Expected Behavior

- `toolCall()` continues to carry the ToolPkg API context through the execution session
- The public facade declares and checks capability limits itself
- Native tool dispatch does not maintain a centralized mapping from tool names to public API names
- Business tool handlers do not receive `__operit_toolpkg_api_version`
