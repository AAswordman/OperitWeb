---
For_Agent: ToolPkg release-time AST minification change record
---

# ToolPkg AST Minification

## Current Status

ToolPkg packages and standalone scripts are published, downloaded, and imported as ordinary files.

## Intent

- At release time, optionally use an AST minifier to minify executable JavaScript
- Preserve the METADATA block, external call interfaces, and export names
- ToolPkg manifests and resource files keep their original content
- A minified ToolPkg continues to be used as an ordinary ZIP, without changing marketplace downloads or external imports

## Scope

- `ToolPkgArtifactMinifier` release-time minifier
- `ToolPkgJsAstMinifier` AST minifier
- The plugin marketplace release switch and explanatory copy

## Completion Criteria

- Executable JavaScript entries of scripts and ToolPkg packages are minified at release time
- Minified output can be loaded directly through the existing marketplace path, file picker, and debug installation

[DONE]
