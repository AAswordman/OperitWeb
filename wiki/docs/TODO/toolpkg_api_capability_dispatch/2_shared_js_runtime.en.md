# Shared JS Runtime

## Goal

The ToolPkg registration bridge and the `Tools` facade share the same JS version-comparison and version-variant selection utility.

## Expected Behavior

- The runtime provides `namespace(publicName, members)` and `method().since(version, implementation)`
- `namespace` constructs the public API name from property keys, and methods check the current manifest API version at call time and select an implementation
- An API facade keeps only its own parameter validation and its own version variants
- When adding another version implementation of an API with the same name, append `.since(version, implementation)` to that API's local chained call
