# API Documentation: `workflow.d.ts`

`workflow.d.ts` describes the `Workflow` type namespace and the runtime entry `Tools.Workflow`. It covers workflow nodes, connections, CRUD, and trigger execution.

## Purpose

The current definitions cover:

- Workflow node and connection types.
- Create, read, update, partial patch, delete, trigger.
- Workflow detail and list result types.

## Type Namespace and Runtime Entry

Type namespace:

```ts
Workflow
```

Runtime entry:

```ts
Tools.Workflow
```

Note: `Tools.Workflow` exposes the methods of the `Workflow.Runtime` interface.

## Core Types

### Node Types

`Workflow.Node` is one of the following union members:

- `Workflow.Trigger`
- `Workflow.Execute`
- `Workflow.Condition`
- `Workflow.Logic`
- `Workflow.Extract`

### `Workflow.NodeInput`

This is the most important input type when creating or updating a workflow. Common fields include:

- `id?`
- `type: 'trigger' | 'execute' | 'condition' | 'logic' | 'extract'`
- `name?`
- `description?`
- `position?`

Depending on the node type, additional fields may apply:

- Trigger: `triggerType`, `triggerConfig`
- Execute node: `actionType`, `actionConfig`, `jsCode`
- Condition node: `left`, `operator`, `right`
- Extract node: `source`, `mode`, `expression`, `group`, `defaultValue`, etc.
- Logic node: expressed via `type: 'logic'` and an operator

### `Workflow.ParameterValueInput`

An input value can be either:

- A direct literal: `string | number | boolean | null`
- A reference object: `{ value?, nodeId?, ref?, refNodeId? }`

### Connection Types

#### `Workflow.ConnectionInput`

- `id?`
- `sourceNodeId?`
- `targetNodeId?`
- `condition?: ConnectionCondition | null`

#### `Workflow.ConnectionCondition`

Supported keywords:

- `true`
- `false`
- `on_success`
- `success`
- `ok`
- `on_error`
- `error`
- `failed`

Regex condition strings are also supported.

### Patch Types

Partial updates support:

- `PatchOperation = 'add' | 'update' | 'remove'`
- `NodePatch`
- `ConnectionPatch`
- `PatchParams`

## Runtime API

### `Tools.Workflow.getAll()`

Gets all workflows, returning `WorkflowListResultData`.

### `Tools.Workflow.create(name, description?, nodes?, connections?, enabled?)`

Creates a workflow, returning `WorkflowDetailResultData`.

### `Tools.Workflow.get(workflowId)`

Reads a workflow's details by ID.

### `Tools.Workflow.update(workflowId, updates?)`

Updates a workflow as a whole; accepts:

- `name?`
- `description?`
- `nodes?`
- `connections?`
- `enabled?`

### `Tools.Workflow.patch(workflowId, patch?)`

Partially updates a workflow via patch operations; accepts:

- `name?`
- `description?`
- `enabled?`
- `node_patches?`
- `connection_patches?`

### `Tools.Workflow.delete(workflowId)`

Deletes a workflow, returning `StringResultData`.

In the type definitions this member is written as `'delete'(...)`; in scripts you can write either `Tools.Workflow.delete(id)` or, more safely, `Tools.Workflow['delete'](id)`.

### `Tools.Workflow.trigger(workflowId)`

Manually triggers a workflow, returning `StringResultData`.

## Examples

### Create a Minimal Workflow

```ts
const created = await Tools.Workflow.create(
  'demo-workflow',
  '文档同步示例',
  [
    {
      id: 'trigger_1',
      type: 'trigger',
      name: '手动触发',
      triggerType: 'manual',
      position: { x: 80, y: 80 }
    },
    {
      id: 'exec_1',
      type: 'execute',
      name: '发送通知',
      actionType: 'send_notification',
      actionConfig: {
        message: '工作流已执行'
      },
      position: { x: 320, y: 80 }
    }
  ],
  [
    {
      sourceNodeId: 'trigger_1',
      targetNodeId: 'exec_1',
      condition: 'on_success'
    }
  ],
  true
);
```

### Read Details

```ts
const detail = await Tools.Workflow.get(created.id);
console.log(detail.nodes.length);
console.log(detail.connections.length);
```

### Partially Append a Node

```ts
await Tools.Workflow.patch(created.id, {
  node_patches: [
    {
      op: 'add',
      node: {
        id: 'exec_2',
        type: 'execute',
        name: '写日志',
        actionType: 'write_file',
        actionConfig: {
          path: '/sdcard/workflow.log',
          content: 'workflow finished'
        },
        position: { x: 560, y: 80 }
      }
    }
  ]
});
```

### Trigger and Delete

```ts
await Tools.Workflow.trigger(created.id);
await Tools.Workflow['delete'](created.id);
```

## Return Values

This file mainly uses the following result types:

- `WorkflowResultData`
- `WorkflowListResultData`
- `WorkflowDetailResultData`
- `StringResultData`

## Related Files

- `examples/types/workflow.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
