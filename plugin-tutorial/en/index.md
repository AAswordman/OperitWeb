# Plugin Tutorial

> This section is a standalone developer documentation area for building `Operit / Assistance` script packages and ToolPkg bundles.  
> The primary source of truth is the repository itself, especially the `docs`, `examples`, and `examples/types` folders.  
> Most detailed chapters currently fall back to the Chinese version, but the structure and routing are the same.

## Start here

- If you want to understand where host APIs come from, begin with `examples/types/index.d.ts`.
- If you want to build a normal script package first, follow the JavaScript chapters, then move to TypeScript.
- If your target is a full bundle with resources, UI, and hooks, move from the JavaScript chapters to TypeScript, then continue into ToolPkg.

## Three plugin forms

| Form | Best for | Typical files |
|---|---|---|
| JavaScript script package | Fast prototyping | `my_tool.js` |
| TypeScript script package | Safer maintenance and larger codebases | `my_tool.ts` + `tsconfig.json` |
| ToolPkg bundle | Multi-package plugins with resources, UI, and hooks | `manifest.json` + `main.ts/js` + `packages/...` |

## Most important files in the repo

- `docs/SCRIPT_DEV_GUIDE.md`
- `examples/quick_start.ts`
- `examples/types/index.d.ts`
- `examples/types/core.d.ts`
- `examples/types/tool-types.d.ts`
- `examples/types/results.d.ts`
- `docs/TOOLPKG_FORMAT_GUIDE.md`

## Recommended route

1. Read `Environment & Repo Map`
2. Finish the JavaScript script package chapters
3. Read `TypeScript Type Basics`
4. Move on to `tsconfig`, structure, ToolPkg, then debugging

## Related guide pages

- [Sandbox Package](/#/guide/tools-and-features/ai-tools/sandbox-package)
- [Skill](/#/guide/tools-and-features/ai-tools/skill)
- [MCP](/#/guide/tools-and-features/ai-tools/mcp)
