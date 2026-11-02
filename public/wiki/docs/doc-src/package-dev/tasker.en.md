# API Documentation: `tasker.d.ts`

`tasker.d.ts` defines only a small but very practical set of Tasker integration APIs: actively triggering Tasker-side events via `Tools.Tasker`.

## Purpose

- Let in-package scripts send results, status, or context to Tasker.
- Suitable for connecting Assistance's tool chain with existing Tasker automation flows.

## Namespace

Type namespace:

```ts
Tasker
```

Runtime entry point:

```ts
Tools.Tasker
```

## Type Definitions

### `Tasker.TriggerTaskerEventParams`

Available fields:

- `task_type: string`: the event identifier configured on the Tasker side, required.
- `arg1?: string` ~ `arg5?: string`: up to 5 simple string parameters.
- `args_json?: string`: for complex data, arrays, or objects, pass them as a JSON string.

## Runtime API

### `Tools.Tasker.triggerEvent(params)`

```ts
triggerEvent(params: TriggerTaskerEventParams): Promise<string>
```

Notes:

- Sends an event to Tasker.
- The return value is a status string returned by the native layer, not a structured result object from `results.d.ts`.

## Examples

### Sending a Simple Event

```ts
await Tools.Tasker.triggerEvent({
  task_type: "sync_notes",
  arg1: "daily",
  arg2: "force"
});
```

### Sending Structured Parameters

```ts
await Tools.Tasker.triggerEvent({
  task_type: "import_payload",
  args_json: JSON.stringify({
    source: "assistance",
    timestamp: Date.now(),
    items: ["a", "b", "c"]
  })
});
```

## Usage Recommendations

- For simple parameters, prefer `arg1` ~ `arg5`.
- Put complex parameters uniformly into `args_json`, to avoid doing secondary concatenation in Tasker.
- `task_type` must exactly match the event name listened for in Tasker.

## Related Files

- `examples/types/tasker.d.ts`
- `examples/types/index.d.ts`
- `docs/doc-src/package-dev/index.md`
