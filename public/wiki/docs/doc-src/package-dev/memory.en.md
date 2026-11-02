# API Documentation: `memory.d.ts`

`memory.d.ts` describes the `Tools.Memory` namespace, used to query, create, update, and organize memory library contents, and to manage link relationships between memories.

## Purpose

The current definitions cover:

- Semantic retrieval of memories.
- Reading a specific memory's content by title.
- Creating, updating, deleting, and moving memories.
- Creating, querying, updating, and deleting memory links.

## Runtime Entry Point

```ts
Tools.Memory
```

## Main APIs

### Memory Query and Reading

#### `query(query, folderPath?, limit?, startTime?, endTime?, snapshotId?, threshold?)`

```ts
query(
  query: string,
  folderPath?: string,
  limit?: number,
  startTime?: string,
  endTime?: string,
  snapshotId?: string,
  threshold?: number
): Promise<MemoryQueryResultData>
```

Notes:

- `query` supports natural-language questions, space-separated phrases, or multiple keywords separated by `|`; within a single keyword, `*` can be used as a fuzzy wildcard placeholder, for example `error*timeout`; passing `*` returns all memories.
- `limit` is an optional result cap, with a value `>=1` and a default of `20`; when `limit > 20`, it enters truncated-result mode.
- `startTime` / `endTime` are local time string filter conditions, supporting only the `YYYY-MM-DD` and `YYYY-MM-DD HH:mm` formats.
- `startTime` uses a start boundary: by day it starts at `00:00:00.000`, and by minute it starts at second `00` of that minute.
- `endTime` uses an inclusive end boundary: by day it goes to `23:59:59.999`, and by minute it goes to second `59.999` of that minute.
- When `snapshotId` is omitted or passed empty, a new query snapshot is automatically created, and its `snapshotId` is returned in the result.
- When `snapshotId` is passed as any non-empty string, that id is used directly; if the snapshot does not yet exist, it is created under that id, rather than requiring it to already exist.
- When the same `snapshotId` is reused serially or concurrently for subsequent queries, memories already returned in that snapshot are automatically excluded, and newly returned memories in this round are recorded into the snapshot.
- `threshold` is an optional relevance threshold, requiring `>= 0`; only memories whose score is not below that threshold are returned. The default threshold of `query_memory` is `0`.
- The returned structure contains `memories[]`, each item having `title`, `content`, `source`, `tags`, and `createdAt`; document-type memories may also carry `chunkInfo` and `chunkIndices`.
- The returned structure also contains `snapshotId`, `snapshotCreated`, and `excludedBySnapshotCount`, for paginated deduplicated retrieval.

#### `getByTitle(title, chunkIndex?, chunkRange?, query?, limit?)`

Reads a memory by exact title; when the target is a document-type memory, it can be combined with:

- `chunkIndex?`
- `chunkRange?`, for example `"3-7"`
- `query?`, used to further retrieve within the document, supporting natural language, space-separated phrases, multiple keywords separated by `|`, and using `*` as a fuzzy wildcard within a single keyword
- `limit?`, which only takes effect when using `query` to retrieve document chunks, indicating the maximum number of chunks to return, default `20`

The return value is `Promise<string>`.

### Creation and Update

#### `create(title, content, contentType?, source?, folderPath?, tags?)`

Creates a new memory, with default annotation values including:

- `contentType` defaults to `text/plain`
- `source` defaults to `ai_created`
- `folderPath` defaults to an empty string

The return value is `Promise<string>`.

#### `update(oldTitle, updates?)`

```ts
update(oldTitle: string, updates?: {
  newTitle?,
  content?,
  contentType?,
  source?,
  credibility?,
  importance?,
  folderPath?,
  tags?
}): Promise<string>
```

### Deletion and Moving

#### `deleteMemory(title)`

Deletes a single memory, returning `Promise<string>`.

#### `move(targetFolderPath, titles?, sourceFolderPath?)`

Moves memories in bulk:

- `titles` can be passed as a string array.
- It can also be passed as a comma-separated string.
- When `sourceFolderPath` is an empty string, it means the uncategorized directory.

## Memory Link APIs

### `link(sourceTitle, targetTitle, linkType?, weight?, description?)`

Creates a memory link, returning `MemoryLinkResultData`.

### `queryLinks(linkId?, sourceTitle?, targetTitle?, linkType?, limit?)`

Queries links, returning `MemoryLinkQueryResultData`.

### `updateLink(linkId?, sourceTitle?, targetTitle?, linkType?, newLinkType?, weight?, description?)`

Updates an existing link, returning `MemoryLinkResultData`.

### `deleteLink(linkId?, sourceTitle?, targetTitle?, linkType?)`

Deletes a link, returning `Promise<string>`.

## Return Value Characteristics

`memory.d.ts` has two return styles:

- `query()` returns the structured result `MemoryQueryResultData`.
- Most read/write operations on the memory body return `Promise<string>`.
- Link-related operations use structured results: `MemoryLinkResultData` and `MemoryLinkQueryResultData`.

## Examples

### Semantic Query

```ts
const result = await Tools.Memory.query(
  '最近关于网络请求的笔记',
  'dev/network',
  20,
  undefined,
  undefined,
  undefined,
  0
);
console.log(result.snapshotId);
console.log(result.memories.map(item => item.title));
```

### Query with a Time Range

```ts
const result = await Tools.Memory.query(
  '最近关于网络请求的笔记',
  'dev/network',
  5,
  '2026-03-01',
  '2026-03-27 18:30',
  undefined,
  0.1
);
console.log(result.memories.length);
```

### Using a Snapshot to Exclude Already Returned Results

```ts
const firstPage = await Tools.Memory.query('最近关于网络请求的笔记');
const secondPage = await Tools.Memory.query(
  '最近关于网络请求的笔记',
  undefined,
  5,
  undefined,
  undefined,
  firstPage.snapshotId || undefined,
  0
);
console.log(secondPage.excludedBySnapshotCount);
```

### Custom Snapshot Id to Support Concurrent Queries

```ts
const snapshotId = 'network-audit-batch-1';
const threshold = 0.05;

const [recent, historical] = await Promise.all([
  Tools.Memory.query('最近关于网络请求的笔记', 'dev/network', 5, '2026-03-20', undefined, snapshotId, threshold),
  Tools.Memory.query('历史上的网络超时案例', 'dev/network', 5, undefined, '2026-03-19 23:59', snapshotId, threshold)
]);

console.log(snapshotId, recent.snapshotCreated, historical.snapshotCreated);
```

### Creating a Memory

```ts
await Tools.Memory.create(
  'OkHttp 使用记录',
  '记录了常用请求写法',
  'text/plain',
  'manual',
  'dev/http',
  'android,http'
);
```

### Updating a Memory

```ts
await Tools.Memory.update('OkHttp 使用记录', {
  content: '补充了拦截器与超时配置说明',
  importance: 0.9,
  tags: 'android,http,okhttp'
});
```

### Creating a Memory Link

```ts
const link = await Tools.Memory.link(
  'OkHttp 使用记录',
  '网络请求排错',
  'related',
  0.8,
  '两者都与 Android 网络层有关'
);
complete(link);
```

## Related Files

- `examples/types/memory.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
