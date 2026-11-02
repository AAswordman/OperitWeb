# JS API Declaration Syntactic Sugar

## Goal

Version declarations are written next to the properties of the JS facade. Kotlin does not generate public API descriptors, nor does it maintain the correspondence between tool names, registration names, or public API names.

## Expected Behavior

- Call sites use chained declarations such as `ToolPkgApi.namespace("Tools.Chat", { call: ToolPkgApi.method().since("1.0.1", implementation) })`
- The runtime automatically determines the public API name from the namespace and property key
- Version restrictions are checked at public API call time; Kotlin only validates whether the manifest's `api_version` is a version supported by the host
- No centralized equivalence mapping from tool names or registration names to public APIs is maintained
