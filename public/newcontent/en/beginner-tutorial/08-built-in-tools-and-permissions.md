# 08. Built-in Tools & Permissions

Finally, we've arrived at the chapter on tools. In this section, we'll cover the software's tool architecture, built-in core tools, and tool authorization in detail. This is one of the most important parts — future articles will continue to expand on tools, going into as much detail as possible.

## Overview

Before diving in, I want to emphasize one thing again: **context caching**. Without context caching or if you're paying per request, invoking tools can be extremely expensive. For example, on the first submission you send 5,000 tokens and receive 200; on the second submission you send 7,000 tokens and receive 100. Without context caching, the input keeps snowballing to 12,000 tokens. With context caching, only the incremental tokens are counted — just 5,000 + 2,000 — which is much cheaper.

If you don't have context caching, check out the two earlier tutorials on context management to learn how to make the most of the software's context compression mechanism.

The AI's chained tool invocation flow roughly looks like: submit user question → AI invokes a tool → submit tool result → AI invokes another tool... until no new tools are called. This is a standard Agent loop.

So, let's get back to the tools themselves. Given the mechanism above, the AI needs to know which tools it has available so it can analyze problems and invoke them. But loading all tools upfront is a waste of context. Based on the context caching we discussed earlier, the best approach is **dynamic, on-demand tool loading** — group tools into packages, write a brief description for each package, and let the AI activate packages on the fly based on those descriptions.

This approach is also called **progressive tool loading**, and it's reflected in the design of Skills.

Operit designed its own package mechanism that's compatible with three major types of tools: MCP, Skills, and Sandbox Packages. Sandbox Packages are exclusive to Operit.

You can see all three types in the package management interface — the three tabs correspond to the three categories. When the AI needs a package, it uses a built-in tool called `use_package` to activate it, then calls tools inside using the `package_name:tool_name` format.

Of course, that's not the whole story. Some tools should be available without activation — `use_package` itself is one of these. These are the regular tools that don't belong to any package.

This tutorial will cover these regular tools (built-in tools) in detail. Package tools will be covered in a future tutorial.

## Managing Built-in Tools

Before we go into the details of each built-in tool, let's talk about how to manage them.

If you want to **enable or disable** a specific built-in tool, there are two ways:

1. **Chat menu**: In the chat interface menu, find "Disabled items" — here you can manage tools and set any built-in tool to disabled.

![Tool prompt management](</manuals/assets/tools/tool_prompt_management.jpg>)

2. **Character card advanced options**: In the character card editing interface's advanced options, you can set a **tool whitelist** to precisely control which tools are allowed for that character card.

![Character card tool whitelist](</manuals/assets/tools/character_card_tool_whitelist.jpg>)

## Built-in Tools in Detail
This section goes into detail. AI hallucinations are normal, and when they happen, you need to guide the AI to correctly invoke the built-in tools.

### File Reading

#### read_file — Read File

One of the most fundamental tools. It can read the contents of **text files** and also handle **media files** (images, audio, etc.) — the latter will be sent to a backend recognition model for analysis.

Paths work in two environments:
- **Android**: Default environment, paths like `/sdcard/Download/xxx.txt`
- **Linux**: Local Ubuntu environment, paths like `/home/user/xxx`

It also supports the `repo:<repository_name>` format for reading files from attached local storage repositories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path |
| `environment` | string | No | Execution environment: `"android"` (default) / `"linux"` / `"repo:<repo_name>"` |
| `intent` | string | No | Question about the media file (used for backend model analysis) |

#### read_file_part — Read File by Line Numbers

Similar to `read_file`, but lets you specify a **start line** and **end line**. Useful for reading a portion of a large file, like only lines 10 through 50.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path |
| `start_line` | number | No | Start line number (from 1), default 1 |
| `end_line` | number | No | End line number (inclusive), default start_line + 99 |
| `environment` | string | No | Same as `read_file`'s `environment` |

### File Editing

#### apply_file — Edit File

The most commonly used file modification tool. It finds content in a file via **fuzzy matching**, then performs an operation:

- **replace**: Replace matched content with new content
- **delete**: Delete matched content
- **create**: Create a new file when it doesn't exist

One thing to note: if you want to **rewrite an entire existing file**, don't overwrite it directly with `apply_file`. Instead, delete it with `delete_file` first, then create it using `apply_file`'s `create` mode.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path |
| `type` | string | Yes | Operation type: `"replace"` / `"delete"` / `"create"` |
| `old` | string | Conditional | Content to match (required for replace/delete) |
| `new` | string | Conditional | New content to insert (required for replace/create) |
| `environment` | string | No | Execution environment |

#### delete_file — Delete File or Directory

Deletes the specified file or directory. If the target is a non-empty directory, set `recursive` to `true` for recursive deletion.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Target path |
| `recursive` | boolean | No | Whether to delete recursively, default `false` |
| `environment` | string | No | Execution environment |

#### make_directory — Create Directory

Creates a directory. If parent directories don't exist, set `create_parents` to `true` to automatically create all missing parent directories (similar to `mkdir -p`).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Directory path |
| `create_parents` | boolean | No | Whether to create parent directories, default `false` |
| `environment` | string | No | Execution environment |

### File Search

#### list_files — List Directory Contents

Lists files and subdirectories under a specified directory. Similar to the `ls` command on a computer, it shows file size, modification time, and other information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Directory path, e.g. `"/sdcard/Download"` |
| `environment` | string | No | Execution environment |

#### find_files — Search Files by Pattern

Searches for files matching a pattern in a specified directory. For example, searching `*.jpg` will find all image files. Supports controlling **search depth** and **path pattern matching**.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Search path |
| `pattern` | string | Yes | Search pattern, e.g. `"*.jpg"` |
| `max_depth` | number | No | Subdirectory search depth, `-1` for unlimited |
| `use_path_pattern` | boolean | No | Whether to use path pattern matching, default `false` |
| `case_insensitive` | boolean | No | Whether to ignore case, default `false` |
| `environment` | string | No | Execution environment |

#### grep_code — Regex Code Search

Searches for content matching a **regular expression** in files and returns matched results with **context**. Suitable for precise code snippet searches. Supports file pattern filtering (e.g., only search `.ts` files).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Search path |
| `pattern` | string | Yes | Regular expression pattern |
| `file_pattern` | string | No | File filter, e.g. `"*.ts"`, default `"*"` |
| `context_lines` | number | No | Context lines around matches, default 3 |
| `max_results` | number | No | Maximum number of matches, default 100 |
| `case_insensitive` | boolean | No | Whether to ignore case, default `false` |
| `environment` | string | No | Execution environment |

#### grep_context — Semantic Search

A more advanced search tool with two modes:
- **Directory mode**: Pass a directory path to find the most relevant files
- **File mode**: Pass a file path to find the most relevant code segments within it

It's based on **semantic relevance scoring** — it doesn't need exact keyword matches, but understands your intent to find content. For example, if you're looking for "routing-related code," it will rank routing files higher.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Directory or file path |
| `intent` | string | Yes | Intent or context description string |
| `file_pattern` | string | No | File filter in directory mode, default `"*"` |
| `max_results` | number | No | Maximum number of results, default 10 |
| `environment` | string | No | Execution environment |

### Network

#### visit_web — Visit Web Page

Visits a URL and extracts page information. The returned results contain a `Results` section with numbered links — you can use these numbers to continue visiting sub-links.

Also supports extracting **image links** by setting `include_image_links` to `true`.

Note: This tool is for **browsing and reading only** — it cannot perform interactive operations like logging in, clicking, or filling forms.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | No | Web page URL to visit |
| `visit_key` | string | No | visitKey returned by the previous visit_web call |
| `link_number` | number | No | Link number to continue visiting (from 1) |
| `include_image_links` | boolean | No | Whether to extract image links, default `false` |
| `user_agent` | string | No | Full custom User-Agent |
| `user_agent_preset` | string | No | UA preset: `"desktop"` / `"android"` |
| `headers` | string | No | Custom request headers, JSON string |

#### download_file — Download File

Downloads a file from the internet to local storage. Two usage modes:
- Provide `url` + `destination` directly
- Use `visit_key` + `link_number` or `image_number` from a previous `visit_web` result to download by number

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destination` | string | Yes | Save path |
| `url` | string | No | File URL |
| `visit_key` | string | No | visitKey from the previous visit_web call |
| `link_number` | number | No | Link number from Results |
| `image_number` | number | No | Image number from Images |
| `headers` | string | No | Custom request headers, JSON string |
| `environment` | string | No | Execution environment |

### Memory

#### query_memory — Search Memory

Searches for relevant memories and document chunks from the **memory bank**. Supports natural language questions, space-separated phrases, or `|`-separated multiple keywords. Supports time range filtering and pagination (via `snapshot_id` to exclude previously returned results).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query, supports natural language / keywords / `*` wildcard |
| `folder_path` | string | No | Specific folder path to search |
| `limit` | number | No | Maximum number of results, default 20 |
| `threshold` | number | No | Minimum relevance score, default 0 |
| `snapshot_id` | string | No | Snapshot ID for pagination, excludes already returned results |
| `start_time` | string | No | Start time filter, format `YYYY-MM-DD` |
| `end_time` | string | No | End time filter, format `YYYY-MM-DD` |

#### get_memory_by_title — Get Memory by Title

Retrieves a memory by its **exact title**. Can read full content or specific document chunks. Also supports searching for matching chunks within a document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Exact title of the memory |
| `chunk_index` | number | No | Read a specific chunk by number |
| `chunk_range` | string | No | Chunk range, e.g. `"3-7"` |
| `query` | string | No | Search for matching chunks within the document |
| `limit` | number | No | Maximum chunks returned when using query, default 20 |

### System

#### sleep — Delay / Wait

A demo tool for pausing. Makes the AI wait for a specified number of milliseconds. Typically used when you need to give the system some reaction time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `duration_ms` | number | No | Wait time in milliseconds, default 1000, ≥ 0 |

#### use_package — Activate Package

Used to activate extension packages. Just pass the `package_name` parameter. Once activated, the tools inside the package can be called via `package_proxy`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `package_name` | string | Yes | Name of the package to activate |

#### package_proxy — Package Proxy Call

Once a package is activated by `use_package`, you can use this tool to call specific tools inside the package. The call format is `package_name:tool_name`, with parameters placed in `params`.

This is why we said the AI uses `use_package` to "open" a tool package, then calls tools using `package_name:tool_name` — `package_proxy` is the middleman proxy.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool_name` | string | Yes | Target tool name, e.g. `package_name:tool_name` |
| `params` | object | Yes | Parameters to pass to the target tool (JSON object) |


## Tool Authorization

The permission system follows a "global default + per-tool override" pattern, which can be understood as two layers:

-   **Global default permission**: Sets a baseline policy for all tools;
-   **Per-tool override**: Specifies individual rules for specific tools, overriding the global default.

Both global and per-tool settings use the same set of labels:

-   **Allow**: Execute directly without confirmation;
-   **Ask every time**: Show a confirmation dialog before each invocation;
-   **Deny**: Completely block execution; the tool call is immediately rejected.

### Global Default Permission

In "Tool Permission Settings," you can first choose a **global default permission**. It applies to **all tools without individual configuration**:

-   For example, setting the global default to **Ask every time** means: any tool **without individual configuration** will prompt for confirmation before each invocation;
-   If you set the global default to **Deny**, no unconfigured tools can be called at all.

The "Auto-approve" toggle in the chat interface menu corresponds to **Ask every time (off)** and **Allow (on)** in these settings.

### Per-tool Override

On the same settings page, you'll see three groups: **Allow / Ask every time / Deny**. You can assign specific tools to these groups to set **override rules** for them:

-   Adding a tool to the **Allow** group: This tool always executes automatically regardless of the global default;
-   Adding a tool to the **Ask every time** group: This tool always prompts for confirmation;
-   Adding a tool to the **Deny** group: This tool is completely blocked.

As long as a tool appears in any group, it's considered to have a **per-tool override**, which takes **precedence** over the global default.

If you want a tool to revert to "follow the global default" behavior, simply remove it from its group in the permission management interface.

### Recommended Configurations

Here are a few common, easy-to-understand configuration combinations — choose based on your preference:

-   **Conservative approach, only trust a few tools**
    -   Global default: **Ask every time**;
    -   Add fully trusted read-only / side-effect-free tools (e.g., code search, calculator) to the **Allow** group.
    -   Effect: Most tools prompt before execution; only tools you've explicitly added to "Allow" run silently.

-   **Maximum security mode, only allow a whitelist of tools**
    -   Global default: **Deny**;
    -   Only add trusted tools to the appropriate groups (Allow / Ask every time).
    -   Effect: All tools are disabled by default; only tools you've specifically added to groups can be invoked, and they follow the permission level you've set.


### Authorization Request Dialog

When the AI needs to perform an action that requires approval, a dialog like this will appear:

![Permission request dialog](</manuals/assets/permission/60a4d8ccc51c010cedd98dbdf5fd842d.jpg>)

The dialog clearly shows the **tool**, **operation**, and **parameters** the AI wants to use. You can choose:

-   **Deny**: Block this operation.
-   **Allow**: Allow this operation only once.
-   **Always allow**: Allow this operation and add the tool to the "Allow list" so it executes automatically in the future (i.e., added to the Allow list in settings, and never prompted again).
