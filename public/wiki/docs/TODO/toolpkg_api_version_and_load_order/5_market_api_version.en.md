---
title: ToolPkg Market API Version
status: completed
---

# ToolPkg Market API Version

## Goal

Let the `api_version` in the ToolPkg manifest flow along the publishing chain into the market version object, and keep its display consistent across the publishing UI, market list, details, and version history.

## Conventions

- The manifest field uses `api_version`.
- The market publish request and response version objects use `apiVersion`.
- `apiVersion` describes the host ToolPkg API; it does not represent the package's own `version` or the archive format `formatVer`.
- Non-ToolPkg versions do not set `apiVersion`.
- `apiVersion` in market responses must be optional; when existing `PACKAGE` type data lacks this field, the client interprets it as `1.0.0` but does not rewrite market data.

## Completion Status

- The local ToolPkg publish source reads the manifest API version.
- New publish and publish-new-version requests carry `version.apiVersion`.
- The publishing UI displays the API version as a read-only field.
- The market list cards, details, version history, and publish preview display the API version.

[DONE]
