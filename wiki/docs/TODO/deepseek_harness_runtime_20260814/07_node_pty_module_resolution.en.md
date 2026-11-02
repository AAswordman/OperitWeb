---
title: DeepSeek Harness node-pty module resolution
status: in_progress
---

# DeepSeek Harness node-pty Module Resolution

## Original State

The local `node-gyp` build of `node-pty` had completed successfully, but the load check passed `node_modules/.pnpm/.../node-pty` directly to Node's `require()`. Since that value does not start with `./` or `/`, Node treated it as a package name rather than a file path, causing `MODULE_NOT_FOUND`.

## Change

- Change the load check's argument to a runtime-relative path starting with `./`.
- Keep the existing local build, symlink dereferencing, and load-failure diagnostics.

## Acceptance Criteria

- After `gyp info ok`, `require()` can load the compiled `node-pty`.
- `Cannot find module 'node_modules/.pnpm/.../node-pty'` no longer appears.
