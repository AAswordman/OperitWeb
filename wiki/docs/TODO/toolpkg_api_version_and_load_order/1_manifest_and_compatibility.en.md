# Manifest API Version and Compatibility

## Previous Implementation

The manifest only declares package metadata and resource structure, so the host cannot know which version of the ToolPkg API a package uses.

## Goals

- Add `api_version`.
- Manifests missing this field use `1.0.0`.
- `1.12.1+4` supports `1.0.0` and `1.0.1`.
- Unsupported API versions are explicitly reported, with the package name, declared version, and host-supported versions, before the package enters the execution phase.

[DONE]
