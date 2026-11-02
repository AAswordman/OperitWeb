# Instructions for Running JavaScript to an Android Device in VSCode

This project is configured to run JavaScript files directly to an Android device from VSCode. This lets you quickly develop and test JavaScript scripts without manually running command-line tools.

## Prerequisites

1. Make sure VSCode is installed
2. Make sure the Android device is connected and USB debugging is enabled
3. Make sure the ADB tool is available (added to the system PATH)
4. Make sure a compatible application is installed on the Android device

## Usage

### Method 1: Via the Debug Menu (Recommended)

1. Open the JavaScript file you want to run in VSCode
2. Press `F5` or click "Start Debugging" in the debug menu
3. In the input box that pops up, enter the following information:
   - The name of the JavaScript function to execute (e.g. `showMessage`)
   - The function arguments, in JSON format (e.g. `{"name": "张三", "message": "你好"}`)
4. The execution result will be displayed in the terminal window

### Method 2: Via the Task Menu

1. Open the JavaScript file you want to run in VSCode
2. Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (macOS)
3. In the input box that pops up, enter the function name and arguments, same as above

## Examples

The project includes the example script `examples/demo_script.js`, which defines the following functions:

### `main(params)`

The default function, which simply returns the provided arguments.

Example arguments: `{"message": "测试"}`

### `showMessage(params)`

Displays the message and the current time.

Example arguments: `{"name": "张三", "message": "欢迎使用"}`

### `calculate(params)`

Performs simple calculations.

Example arguments: `{"a": 10, "b": 5, "operation": "add"}`

Available operation types:
- `add`: addition
- `subtract`: subtraction
- `multiply`: multiplication
- `divide`: division

## Notes

1. Make sure JavaScript functions use the `complete()` function to return results — this is required
2. Arguments must be valid JSON
3. Script execution may take some time; please wait patiently for the result
4. If you run into problems, check the VSCode terminal output and the Android device logs

## Advanced Usage

If you need more complex execution options, you can use the following commands directly on the command line:

Windows:
```
.\tools\adb\execute_js.bat <JS文件路径> <函数名> <JSON参数或@参数文件>
```

Linux/macOS:
```
./tools/adb/execute_js.sh <JS文件路径> <函数名> <JSON参数或@参数文件>
```

For example:
```
.\tools\adb\execute_js.bat examples\demo_script.js calculate @params.json
```

Additional notes:
- `@params.json` is currently the most reliable way to pass arguments, especially on Windows / PowerShell
- If you use `run_sandbox_script.*` or the in-package `debug_run_sandbox_script` and pass `source_code`, the code will execute as a "top-level script"
- In such inline scripts, use `console.log(...)`, `emit(...)`, and `complete(...)`
- Do not write `params.xxx` or `intermediate(...)` directly


# Assistance Tool Packages

This directory contains tool packages that can be loaded by the AI assistant. These packages provide additional functionality to the assistant, allowing it to perform specialized tasks.

## Package Formats

Packages can be defined in two formats:

1. **JavaScript (.js)** - Preferred format with full support for Promise-based async execution
2. **HJSON (.hjson)** - Legacy format with limited functionality (maintained for backward compatibility)

## JavaScript Package Structure

A JavaScript package consists of a single JavaScript file with:

1. A **metadata block** at the top of the file
2. **Tool function definitions** that implement the functionality
3. Optional **exports** statements to make the functions available

### Example JavaScript Package:

```javascript
/*
METADATA
{
    "name": "example_package",
    "description": "An example package showing how to create tools",
    "tools": [
        {
            "name": "hello_world",
            "description": "A simple hello world tool",
            "parameters": [
                {
                    "name": "name",
                    "description": "Name to greet",
                    "type": "string",
                    "required": true
                }
            ]
        }
    ],
    "category": "FILE_READ"
}
*/

// Tool implementation
async function hello_world(params) {
    // Access parameters
    const name = params.name || "World";
    
    // Use async/await with other tools
    await Tools.System.sleep(1);
    
    // Return a result
    complete(`Hello, ${name}!`);
}

// Export the function
exports.hello_world = hello_world;
```

## TypeScript Support

You can also write your packages in TypeScript (.ts) with full type checking for all APIs. TypeScript packages are automatically compiled to JavaScript at runtime.

### Parameter Typing Rule

For tool packages under `examples`, Kotlin now converts tool params to strong types before invoking the TypeScript/JavaScript runtime, based on each tool's metadata.

- In TypeScript, parameter types should match metadata directly.
- Fields with `"required": false` should be modeled as optional `?`.
- Do not keep legacy TS-layer coercion such as `string -> number`, `string -> boolean`, `JSON string -> array/object`, or duplicate "required parameter" checks that only existed to compensate for old permissive passthrough behavior.
- Keep only validations that metadata cannot express well, such as enum/domain rules, cross-field constraints, and nested object/array shape checks.

### TypeScript Parameter Behavior

Parameters passed to `.ts` example packages rely on Kotlin’s metadata-driven conversion. The Kotlin bridge reads each tool’s `type`/`required` flags and converts values _before_ they arrive in JavaScript/TypeScript, which means the TS layer should trust the metadata typing and focus on higher-level business rules. Please do not add string→number/boolean/array coercion or re-check `required` fields that Kotlin already enforces, and treat `required: false` parameters as optional (`?`) with their actual primitive types.

### Example TypeScript Package:

```typescript
/*
METADATA
{
    "name": "typescript_example",
    "description": "A TypeScript example package",
    "tools": [
        {
            "name": "hello_world",
            "description": "A simple hello world tool with TypeScript",
            "parameters": [
                {
                    "name": "name",
                    "description": "Name to greet",
                    "type": "string",
                    "required": true
                }
            ]
        }
    ],
    "category": "FILE_READ"
}
*/

/**
 * Simple hello world function with TypeScript
 * @param params Tool parameters with name property
 */
async function hello_world(params: { name: string }): Promise<void> {
    // Access parameters with type checking
    const name = params.name || "World";
    
    // Use async/await with proper typing
    await Tools.System.sleep(1);
    
    // Return a result
    complete(`Hello, ${name}!`);
}

// Export the function
exports.hello_world = hello_world;
```

## Promise-Based Async API

All tool calls now return Promises, allowing for async/await pattern usage:

```javascript
async function chain_example(params) {
    try {
        // Chain multiple tool calls with await
        const fileList = await Tools.Files.list("/some/path");
        const fileContents = await Tools.Files.read("/some/path/file.txt");
        
        // Do work with the results
        const result = `Found ${fileList.length} files. First file contents: ${fileContents}`;
        
        complete(result);
    } catch (error) {
        complete(`Error: ${error.message}`);
    }
}
```

## Available Tools API

The following utility namespaces are available in all package scripts:

### Tools.Files
- `list(path)` - List files in a directory
- `read(path)` - Read file contents
- `write(path, content)` - Write content to file
- `deleteFile(path)` - Delete a file or directory
- `exists(path)` - Check if file exists
- `move(source, target)` - Move file from source to target
- `copy(source, target)` - Copy file from source to target
- `mkdir(path)` - Create a directory
- `find(path, pattern)` - Find files matching a pattern
- `info(path)` - Get information about a file
- `zip(source, target)` - Zip files/directories
- `unzip(source, target)` - Unzip an archive
- `open(path)` - Open a file with system handler

### Tools.Net
- `httpGet(url)` - Perform HTTP GET request
- `httpPost(url, data)` - Perform HTTP POST request
- `visit(query)` - Perform web search

### Tools.System
- `exec(command)` - Execute a system command
- `sleep(seconds)` - Sleep for specified seconds

### Other Utilities
- `Tools.calc(expression)` - Calculate mathematical expression
- `_` - Lodash-like utility library
- `dataUtils` - Data processing utilities

## Creating a New Package

1. Create a new `.js` or `.ts` file in this directory
2. Add a METADATA block at the top with package details
3. Define your tool functions
4. Export the functions using the CommonJS pattern
5. Use the Promise-based API for any asynchronous operations

## Testing Your Package

You can test your package by using the `use_package` tool in the assistant chat:

```
<tool name="use_package">
  <param name="package_name">your_package_name</param>
</tool>
```

After the package is loaded, you can use any of its tools:

```
<tool name="your_package_name:your_tool_name">
  <param name="param1">value1</param>
</tool>
```

## Function Name Duplication Issue

Currently, these example scripts have a common issue: they contain duplicate function names across different files, even though the scripts are designed to operate independently. This can cause problems if:

1. Multiple scripts are imported into the same project
2. The scripts are executed in an environment where name collisions matter
3. Future integration of these scripts is planned

### Recommended Solutions:

#### 1. Namespace Pattern

Wrap all functions in a namespace object to avoid global namespace pollution:

```javascript
// Instead of:
function get_history(params) { /* ... */ }

// Use:
const QQTools = {
  get_history: function(params) { /* ... */ },
  reply: function(params) { /* ... */ }
};

// Then call as:
QQTools.get_history(params);
```

#### 2. Module Pattern (IIFE)

Use the module pattern to encapsulate functions:

```javascript
const QQIntelligent = (function() {
  // Private functions
  function close_keyboard() { /* ... */ }
  
  // Public API
  return {
    get_history: function(params) { /* ... */ },
    reply: function(params) { /* ... */ }
  };
})();
```

#### 3. ES6 Modules (For TypeScript files)

Convert the scripts to proper ES6 modules:

```typescript
// In qq_intelligent.ts
export function get_history(params) { /* ... */ }
export function reply(params) { /* ... */ }

// In another file that needs these functions
import { get_history, reply } from './qq_intelligent';
```

#### 4. Function Prefix

If modifying the code structure is difficult, prefix all functions with a unique identifier:

```javascript
function qq_get_history(params) { /* ... */ }
function qq_reply(params) { /* ... */ }
```

Adopting one of these approaches would resolve the function name duplication issue while maintaining the independence of each script. 
