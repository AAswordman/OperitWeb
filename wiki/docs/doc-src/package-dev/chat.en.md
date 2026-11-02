# API Documentation: `chat.d.ts`

`chat.d.ts` describes the `Tools.Chat` namespace, used to manage sessions, switch sessions, send messages, and read message history.

## Purpose

The current definition covers:

- Starting the chat service.
- Creating, querying, switching, and deleting chat sessions.
- Sending regular messages and advanced messages.
- Enumerating character cards and reading chat messages.

## Runtime Entry Point

```ts
Tools.Chat
```

## Main APIs

### `startService(options?)`

```ts
startService(options?: {
  initial_mode?: 'WINDOW' | 'BALL' | 'VOICE_BALL' | 'FULLSCREEN' | 'RESULT_DISPLAY' | 'SCREEN_OCR'
  auto_enter_voice_chat?: boolean
  wake_launched?: boolean
  timeout_ms?: number
  keep_if_exists?: boolean
}): Promise<ChatServiceStartResultData>
```

Starts the chat service or floating window.

Optional parameters:

- `initial_mode?`
- `auto_enter_voice_chat?`
- `wake_launched?`
- `timeout_ms?`
- `keep_if_exists?`

### `createNew(group?, setAsCurrentChat?, characterCardId?)`

```ts
createNew(group?: string, setAsCurrentChat?: boolean, characterCardId?: string): Promise<ChatCreationResultData>
```

Creates a new chat session.

### `listAll()`

Returns the full chat list.

### `listChats(params?)`

Lists chats with filter conditions:

- `query?`
- `match?: 'contains' | 'exact' | 'regex'`
- `limit?`
- `sort_by?: 'updatedAt' | 'createdAt' | 'messageCount'`
- `sort_order?: 'asc' | 'desc'`

### `findChat(params)`

```ts
findChat({ query, match?, index? }): Promise<ChatFindResultData>
```

Finds a chat by title or ID.

### `agentStatus(chatId)`

Checks whether a given chat is currently processing.

### `switchTo(chatId)`

Switches the current chat.

### `updateTitle(chatId, title)`

Updates a chat title.

### `deleteChat(chatId)`

Deletes a chat.

### `sendMessage(message, chatId?, roleCardId?, senderName?, options?)`

Sends a regular message.

`options` supports:

- `runtime?: 'main' | 'floating'`
- `persist_turn?: boolean`
- `notify_reply?: boolean`
- `hide_user_message?: boolean`
- `disable_warning?: boolean`
- `timeout_ms?: number`

Where:

- `runtime` specifies which chat runtime this message is sent to; when unspecified, it defaults to `floating`
- `timeout_ms` controls the maximum wait time for this send, in milliseconds

### `call(options)`

Available since ToolPkg API `1.0.1`.

```ts
call(options: {
  functionType:
    | 'CHAT'
    | 'SUMMARY'
    | 'TITLE_GENERATION'
    | 'MEMORY'
    | 'UI_CONTROLLER'
    | 'TRANSLATION'
    | 'GREP'
    | 'ROLE_RESPONSE_PLANNER'
    | 'IMAGE_RECOGNITION'
    | 'AUDIO_RECOGNITION'
    | 'VIDEO_RECOGNITION'
  turns: ToolPkg.PromptTurn[]
  recordTokenUsage?: boolean
  enableThinking?: boolean
}): Promise<ChatCallResultData>
```

Calls the specified function model, passing context using the project's unified `PromptTurn` structure. This interface does not write to chat history, nor does it execute tool calls returned by the model.

Return values:

- `text`: the assistant text after stripping protocol metadata and tool XML
- `turns`: the model output split into `PromptTurn` shape, which may contain `ASSISTANT` and `TOOL_CALL`
- `finishReason`: `stop` or `tool_call`
- `metadata`: structural information extracted by the host from protocol tags; currently `protocolMeta` is an array, each item containing `provider` and the original `payload`

### `listCharacterCards()`

Lists the available character cards.

### `getMessages(chatId, options?)`

```ts
getMessages(chatId: string, options?: { order?: 'asc' | 'desc'; limit?: number }): Promise<ChatMessagesResultData>
```

Reads the message history of a given chat.

### `getMessagesRange(chatId, options)`

```ts
getMessagesRange(chatId: string, options: { order?: 'asc' | 'desc'; start: number; end: number }): Promise<ChatMessagesResultData>
```

Reads the message history of a given chat by a message index range starting from 0, where both `start` and `end` are inclusive bounds.

## Return Values

The return values of `chat.d.ts` are all defined in `results.d.ts`. Common ones include:

- `ChatServiceStartResultData`
- `ChatCreationResultData`
- `ChatListResultData`
- `ChatFindResultData`
- `AgentStatusResultData`
- `ChatSwitchResultData`
- `ChatTitleUpdateResultData`
- `ChatDeleteResultData`
- `MessageSendResultData`
- `ChatCallResultData`
- `ChatMessagesResultData`
- `CharacterCardListResultData`

## Examples

### Create a Session and Send a Message

```ts
const created = await Tools.Chat.createNew('work', true);
const chatId = created.chatId;

await Tools.Chat.sendMessage('帮我总结今天的待办', chatId, undefined, undefined, {
  timeout_ms: 60000
});
```

### Find and Switch Chats

```ts
const found = await Tools.Chat.findChat({
  query: '日报',
  match: 'contains'
});

if (found.chat) {
  await Tools.Chat.switchTo(found.chat.id);
}
```

### Read Recent Messages

```ts
const messages = await Tools.Chat.getMessages('chat_123', {
  order: 'desc',
  limit: 20
});
console.log(messages.toString());
```

### Read Messages by Range

```ts
const messages = await Tools.Chat.getMessagesRange('chat_123', {
  order: 'asc',
  start: 200,
  end: 399
});
console.log(messages.messages.length);
```

### Call the Translation Function Model

```ts
const result = await Tools.Chat.call({
  functionType: 'TRANSLATION',
  turns: [
    {
      kind: 'SYSTEM',
      content: 'Translate the user message into Chinese. Return only the translated text.'
    },
    {
      kind: 'USER',
      content: originalText,
      metadata: { targetLanguage: 'Chinese' }
    }
  ],
  recordTokenUsage: false
});

if (result.finishReason === 'tool_call') {
  console.warn(result.turns);
} else {
  console.log(result.text);
}
```

## Related Files

- `examples/types/chat.d.ts`
- `examples/types/results.d.ts`
- `examples/types/index.d.ts`
