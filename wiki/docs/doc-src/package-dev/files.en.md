# API Documentation: `files.d.ts`

`files.d.ts` describes the `Tools.Files` namespace. It is one of the most commonly used filesystem tools inside a package, responsible for reading, writing, searching, moving, and downloading files in both the `android` and `linux` execution environments.

## Purpose

The current definitions cover:

- Directory traversal and file reading.
- Text / binary writing.
- Deleting, moving, copying, and creating directories.
- File search, regex retrieval, and context retrieval.
- Getting file information, applying AI diffs, compressing/decompressing, opening/sharing, and downloading.

## Basic Types

### `FileEnvironment`

```ts
type FileEnvironment = 'android' | 'linux'
```

Most APIs support explicitly specifying the execution environment; the default environment is as stated in the comments in the type definitions, usually `android`.

### `ApplyFileType`

```ts
type ApplyFileType = 'replace' | 'delete' | 'create'
```

Used by `Tools.Files.apply()`.

## Runtime Entry Point

```ts
Tools.Files
```

## Main APIs

### Directories and Reading

#### `list(path, environment?)`

Lists directory contents, returning `DirectoryListingData`.

#### `read(path)` / `read(options)`

```ts
read(path: string): Promise<FileContentData>
read({ path, environment?, intent?, direct_image? }): Promise<FileContentData>
```

The second overload additionally supports:

- `intent?`: a description of the reading intent.
- `direct_image?`: whether to process as direct image output.

#### `readPart(path, startLine?, endLine?, environment?)`

Reads part of the content by line, returning `FilePartContentData`.

#### `readBinary(path, environment?)`

Reads a binary file, returning `BinaryFileContentData`, with the content field in Base64.

### Writing and Modification

#### `write(path, content, append?, environment?)`

Writes text, optionally appending.

#### `writeBinary(path, base64Content, environment?)`

Writes Base64-encoded binary content.

#### `apply(path, type, old?, newContent?, environment?)`

```ts
apply(path, 'replace' | 'delete' | 'create', old?, newContent?, environment?)
```

Notes:

- `replace` / `delete` usually require `old` to match exactly.
- `create` / `replace` usually require `newContent`.
- Returns `FileApplyResultData`, which contains `operation` and `aiDiffInstructions`.

#### `create(path, newContent, environment?)`

Creates a new file.

- Internally equivalent to `apply(path, 'create', undefined, newContent, environment)`.
- Returns `FileApplyResultData`.

#### `edit(path, oldContent, newContent, environment?)`

Edits an existing file.

- Internally equivalent to `apply(path, 'replace', oldContent, newContent, environment)`.
- Returns `FileApplyResultData`.

### Deleting, Moving, Copying

#### `deleteFile(path, recursive?, environment?)`

Deletes a file or directory.

#### `move(source, destination, environment?)`

Moves a file.

#### `copy(source, destination, recursive?, sourceEnvironment?, destEnvironment?)`

Supports cross-environment copying, which is an important point in `files.d.ts`.

#### `mkdir(path, create_parents?, environment?)`

Creates a directory.

### Search and Information

#### `exists(path, environment?)`

Checks whether a path exists, returning `FileExistsData`.

#### `info(path, environment?)`

Gets detailed file information, returning `FileInfoData`.

#### `find(path, pattern, options?, environment?)`

Searches by filename / pattern, returning `FindFilesResultData`.

#### `grep(path, pattern, options?)`

```ts
grep(path, pattern, {
  file_pattern?,
  case_insensitive?,
  context_lines?,
  max_results?,
  environment?
})
```

Performs regex-level content retrieval, returning `GrepResultData`.

#### `grepContext(path, intent, options?)`

Performs intent-based semantically relevant content retrieval, returning `GrepResultData`.

### Compression, Opening, Sharing, Downloading

#### `zip(source, destination, environment?, include_root_directory?)`

Compresses a file or directory.

- `include_root_directory` only takes effect when `source` is a directory.
- Default `true`: the archive retains the source directory name as the top-level directory.
- Passing `false`: only the directory contents themselves are compressed, without wrapping them in an extra top-level directory.

#### `unzip(source, destination, environment?)`

Extracts an archive file.

#### `open(path, environment?)`

Opens a file with the system handler.

#### `share(path, title?, environment?)`

Shares a file with other apps.

#### `download(url, destination, environment?, headers?)`

Downloads a file from a URL.

#### `download(options)`

```ts
download({
  url?,
  visit_key?,
  link_number?,
  image_number?,
  destination,
  environment?,
  headers?
})
```

This overload shows that downloading can be done not only by giving a URL directly, but also by continuing a download using the `visit_key` and link number from a `visit_web` result.

## Examples

### Reading a Text File

```ts
const file = await Tools.Files.read({
  path: '/sdcard/notes/todo.txt',
  environment: 'android'
});
console.log(file.content);
```

### Reading Partial Line Numbers

```ts
const part = await Tools.Files.readPart('/sdcard/app.log', 1, 80);
console.log(part.content);
```

### Cross-Environment Copying

```ts
await Tools.Files.copy(
  '/sdcard/input.txt',
  '/tmp/input.txt',
  false,
  'android',
  'linux'
);
```

### Searching Code

```ts
const matches = await Tools.Files.grep('/workspace', 'toolCall\\(', {
  file_pattern: '*.ts',
  context_lines: 2,
  max_results: 20,
  environment: 'linux'
});
```

### Applying a Replacement Patch

```ts
await Tools.Files.apply(
  '/sdcard/demo.txt',
  'replace',
  'old text',
  'new text'
);
```

## Return Values

This file mainly uses the following result types:

- `DirectoryListingData`
- `FileContentData`
- `BinaryFileContentData`
- `FilePartContentData`
- `FileOperationData`
- `FileExistsData`
- `FindFilesResultData`
- `FileInfoData`
- `FileApplyResultData`
- `GrepResultData`

## Related Files

- `examples/types/files.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
