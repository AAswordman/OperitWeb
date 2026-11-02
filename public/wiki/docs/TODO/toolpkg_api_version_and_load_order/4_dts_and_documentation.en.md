# DTS and Documentation

## Goal

- Mark the corresponding ToolPkg API introduction version on DTS declarations for new or existing ToolPkg APIs.
- Supplement the manifest field, API support scope, dependency, and load order descriptions.
- Keep field naming consistent between the format documentation and the development documentation.

## Maintenance Conventions

- `examples/types/toolpkg.d.ts` keeps a single up-to-date declaration; do not hand-write multiple DTS files split by version.
- When adding a new public capability, mark `@since ToolPkg API x.y.z` on the relevant types, registration functions, and underlying NativeInterface declarations.
- The manifest's `api_version` and the host registration bridge are responsible for actual availability; DTS is only responsible for development-time hints and as a documentation source.

[DONE]
