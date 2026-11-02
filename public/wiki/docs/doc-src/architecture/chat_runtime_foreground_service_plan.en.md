# Plan for Moving the Dual-Session Chat Runtime up to the Foreground Service

## Plan Checklist

- [x] Create a foreground-service Runtime host responsible for holding the chat coroutine scope and Core slots
- [x] Add `ChatRuntimeSlot`, fixed to distinguish `MAIN` and `FLOATING`
- [x] Create two `ChatServiceCore` instances in the Runtime host
- [x] Make the `MAIN` Core follow the global current chat
- [x] Make the `FLOATING` Core maintain its local current chat, no longer overwritten by global switching
- [x] Change `ChatViewModel` to only connect to the `MAIN` Core, no longer assembling delegates itself
- [x] Change `FloatingChatService` to only connect to the `FLOATING` Core, no longer creating its own `ChatServiceCore`
- [x] Clean up the message sync / reload sync logic between the main UI and the floating window in `FloatingWindowDelegate`
- [x] Remove the companion shared loading state from `MessageProcessingDelegate`, replacing it with per-instance state
- [x] Delete the floating window's external message push entry, ensuring the main UI and the floating window each only read their own Core
- [ ] Verify that the main chat and the floating window can stay on different chats at the same time, and that chat execution in the background does not depend on the `ViewModel`

## Confirmed Premises

- The current version is not released.
- This change replaces the approach per the plan; old-plan documentation is not kept.
- No forward compatibility, no fallback code, and no long-term coexistence of two implementations.
- The user explicitly needs two large Sessions:
  - `MAIN`: used by the main chat page
  - `FLOATING`: used by the floating window
- The goal is not "the main chat and the floating window share one Core", but "they share one Runtime host, and the host holds two Cores".

---

## 1. The Real Problem This Change Solves

Currently, although the main chat and the floating window chat reuse some underlying delegates, their runtime entry points are still two separate sets:

- The main UI assembles the chat logic directly inside `ChatViewModel`.
- The floating window assembles another `ChatServiceCore` inside `FloatingChatService`.

This causes three direct problems:

1. The chat execution chain still strongly depends on the `ViewModel` lifecycle.
2. The main UI and the floating window rely on extra message syncing and state refreshing to "look consistent", which makes the structure more convoluted instead.
3. If the user wants the main chat and the floating window to operate on different sessions at the same time, the current structure is neither clean nor stable.

What this change does is not to merge the two sides into one Core, but to:

- Take the chat runtime out of `ChatViewModel`.
- Let it run under the foreground service lifecycle.
- Have a single Runtime host manage two `ChatServiceCore` instances.
- Have the main UI use the `MAIN` Core exclusively.
- Have the floating window use the `FLOATING` Core exclusively.
- Delete the hand-written message sync logic between the main UI and the floating window.

In one sentence:

> One Runtime, two Cores, serving the main chat and the floating window respectively.

---

## 2. Goals

The target version only pursues the following results:

- The chat core logic is no longer held by `ChatViewModel`.
- The chat core logic is instead held by the foreground service.
- The foreground service internally holds two `ChatServiceCore` instances.
- `ChatViewModel` only connects to the `MAIN` Core.
- `FloatingChatService` only connects to the `FLOATING` Core.
- The main chat and the floating window can be on different chats at the same time.
- Delete the main UI -> floating window message push sync, reload sync, and dual-data-source logic.

---

## 3. Explicit Non-Goals

This change does not:

- Merge the main chat and the floating window into one shared Core
- Rename `ChatServiceCore` to `ChatSessionContext`
- First build a large, complete `ChatSessionHost` / `SessionUiBridge` / `ChatSessionContext` system
- Introduce a whole complex host structure in advance for things that "might be useful later"

This change only accepts a very thin host layer, whose responsibilities are limited to:

- Holding two Cores
- Providing a per-slot entry point for obtaining a Core
- Owning the lifecycle

If this host starts carrying too much UI logic, that means it has gone back to the overweight approach of the old documentation.

---

## 4. Recommended Structure

## 1. One Runtime Host

It is recommended that the existing `AIForegroundService` hold it, or that it hold a very thin runtime holder.

Recommended minimum responsibilities:

- Hold two `ChatServiceCore` instances
- Hold the chat-related coroutine scope
- Provide a `getCore(slot)` entry point
- Be responsible for creating and releasing the runtime within the service lifecycle

Recommended minimum identifiers:

```kotlin
enum class ChatRuntimeSlot {
    MAIN,
    FLOATING
}
```

Notes:

- Here, `slot` is only a runtime slot identifier.
- It is not the large, complete state-domain model from the old plan.
- It is only used to tell the host "I want the main chat's Core, or the floating window's Core".

## 2. Two `ChatServiceCore` Instances

Keep the name `ChatServiceCore`; do not rename it or move its directory.

The Runtime host internally holds:

- `mainCore`
- `floatingCore`

Or:

- `Map<ChatRuntimeSlot, ChatServiceCore>`

These two Cores must each independently hold:

- `ChatHistoryDelegate`
- `MessageProcessingDelegate`
- `MessageCoordinationDelegate`
- `AttachmentDelegate`
- `TokenStatisticsDelegate`

In other words:

- What is shared is "the host and the lifecycle"
- What is not shared is "the session state and the runtime instances"

## 3. Selection Strategies Must Be Separate

To truly let the main chat and the floating window stay on different chats at the same time, the upper layers must allow the two Cores to have different current chat selections.

Minimum requirements:

- The `MAIN` Core follows the global current chat
- The `FLOATING` Core only maintains its own local current chat

This does not require building a large naming system first, but the logic must hold.

Two acceptable minimum implementations:

1. Add a simple configuration to `ChatHistoryDelegate`, e.g. `followGlobalCurrentChat: Boolean`
2. Or add a very small enum, e.g.:

```kotlin
enum class ChatSelectionMode {
    FOLLOW_GLOBAL,
    LOCAL_ONLY
}
```

Either way, the goal is the same:

- `MAIN` uses the global current chat
- `FLOATING` is not overwritten by global chat switching

---

## 5. Responsibilities of Each Layer

## 1. `ChatViewModel`

Kept responsibilities:

- Page UI state
- Permission requests
- Strongly UI-bound behaviors such as WebView / Workspace / pickers / read-aloud
- Forwarding UI operations to the `MAIN` Core

Removed responsibilities:

- Directly newing `ChatHistoryDelegate`
- Directly newing `MessageProcessingDelegate`
- Directly newing `MessageCoordinationDelegate`
- Directly acting as the chat logic host

## 2. `FloatingChatService`

Kept responsibilities:

- Floating window lifecycle
- WindowManager
- Foreground notification
- Wake lock
- Input focus and mode switching
- Forwarding floating window UI operations to the `FLOATING` Core

Removed responsibilities:

- Newing its own `ChatServiceCore`
- Maintaining its own independent message source

## 3. `FloatingWindowDelegate`

Kept responsibilities:

- Starting the service
- Binding the service
- Stopping the service
- Mode switching

Removed responsibilities:

- Pushing main UI messages to the floating window
- Having the floating window notify the main UI to reload
- Binder two-way syncing of the message list

---

## 6. Two Additional Points to Watch

## 1. `MessageProcessingDelegate` Must Not Keep Using Companion Shared State

If the Runtime really holds two Cores at the same time, then the following shared states should not continue to be mixed across instances:

- `sharedIsLoading`
- `sharedActiveStreamingChatIds`

Otherwise:

- Main chat loading will affect the floating window
- Floating window loading will affect the main chat

Therefore this part must be changed to per-instance state.

If a globally aggregated loading state is genuinely needed later, the Runtime host should compute it explicitly.

## 2. `ChatHistoryDelegate` Must Not Keep Following the Global Chat by Default

If `FLOATING` keeps subscribing to the global `currentChatId`, then it is not truly independent.

So although this change is not a large refactoring, it must at least add:

- `MAIN` follows the global chat
- `FLOATING` keeps its local chat

Otherwise, "two Cores" would only mean two instances on the surface, while chat selection would still be crossed in practice.

---

## 7. Implementation Plan

## Phase 1: Build the Dual-Core Runtime Host

Goals:

- Hold two `ChatServiceCore` instances in the foreground service
- Neither `ChatViewModel` nor `FloatingChatService` news a Core itself anymore

Recommended steps:

1. Add Runtime holding capability to `AIForegroundService`.
2. Add `ChatRuntimeSlot`.
3. Create inside the service:
   - The `MAIN` Core
   - The `FLOATING` Core
4. Expose a per-`slot` entry point for obtaining a Core.
5. Make it explicit that the Runtime lifecycle follows the foreground service, not the `ViewModel`.

## Phase 2: Complete Chat Selection Isolation

Goals:

- `MAIN` and `FLOATING` can stay on different chats.

Recommended steps:

1. Modify `ChatHistoryDelegate` to support "follow global" or "keep local".
2. The `MAIN` Core continues to follow the global `currentChatId`.
3. The `FLOATING` Core does not automatically follow the global chat; it only responds to its own switching.
4. If needed, provide an explicit sync method that writes the `FLOATING` current chat back to the global chat.

## Phase 3: Connect the Main UI to the `MAIN` Core

Goals:

- `ChatViewModel` only coordinates UI, no longer assembling the chat runtime.

Recommended steps:

1. Change `ChatViewModel` to connect to the Runtime host.
2. Expose all chat state from the `MAIN` Core instead.
3. Forward `sendUserMessage`, `cancelMessage`, `createNewChat`, `switchChat`, etc. directly to the `MAIN` Core.
4. Delete the delegate initialization code inside `ChatViewModel`.

## Phase 4: Connect the Floating Window to the `FLOATING` Core

Goals:

- `FloatingChatService` no longer creates its own Core.

Recommended steps:

1. Delete `chatCore = ChatServiceCore(...)` in `FloatingChatService`.
2. Change the floating window to obtain the `FLOATING` Core.
3. Have the floating window UI directly observe the `FLOATING` Core's:
   - `chatHistory`
   - `currentChatId`
   - `isLoading`
   - `attachments`

## Phase 5: Delete the Two-Way Sync Logic

Goals:

- Let the main UI and the floating window each only read their own Core.

Directions for cleanup:

- `setReloadCallback` in `FloatingWindowDelegate`
- `setChatSyncCallback` in `FloatingWindowDelegate`
- Main UI `chatHistoryFlow -> floatingService.updateChatMessages(...)`
- The logic where the floating window notifies the main UI to reload after a turn completes
- External message push entries such as `FloatingChatService.updateChatMessages(...)`

After completion, message sources must be unique:

- The main UI only reads the `MAIN` Core
- The floating window only reads the `FLOATING` Core

---

## 8. Files Expected to Be Involved

Core changed files are expected to include:

- `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt`
- `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt`
- `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/FloatingWindowDelegate.kt`

If necessary, a very thin runtime holder may be added, e.g.:

- `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt`

But it may only be responsible for:

- Holding two Cores
- Providing access entry points
- Managing the lifecycle

It must not keep growing into the large host from the old plan.

---

## 9. Cleanup Principles

Because the current version is not released, this cleanup is executed as a complete replacement:

- Delete the old documentation
- Delete the old sync logic
- Delete binder callbacks that are no longer needed
- Delete the floating window's external message push entry
- Delete the runtime assembly code in `ChatViewModel` that is no longer needed

Not kept:

- Compatibility shims
- Coexistence of two implementations
- Transitional fallback branches

---

## 10. Acceptance Criteria

After completion, the following must hold:

1. `ChatViewModel` no longer holds chat core assembly logic.
2. `FloatingChatService` no longer creates an independent `ChatServiceCore`.
3. The foreground service internally holds two Cores: `MAIN` and `FLOATING`.
4. The main chat and the floating window can stay on different chats at the same time.
5. The main chat and the floating window can each send messages at the same time, with loading states not crossing over.
6. The hand-written message sync logic between the main UI and the floating window is deleted.
7. After the app goes to the background, chat execution no longer depends on the `ViewModel` lifecycle.

---

## 11. Conclusion

Consider building a Runtime that holds two Cores.

And this is currently the plan closest to the requirements, with the most controllable change surface:

- Not one Core forcibly holding both sides' state
- Not both sides continuing to assemble things on their own in a messy way
- Not jumping straight to the overweight multi-session system from the old documentation

The final direction should converge on:

> `AIForegroundService` holds a Runtime, and the Runtime internally holds the `MAIN` Core and the `FLOATING` Core.
