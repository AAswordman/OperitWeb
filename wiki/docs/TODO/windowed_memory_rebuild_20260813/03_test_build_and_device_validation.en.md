# Testing and Device Validation

Acceptance criteria:

- The window planner covers empty messages, summary exclusion, window boundaries, and multi-window scenarios
- The memory graph protocol covers named objects, standalone operations without `main`, legacy location arrays, and missing required fields
- Android JVM unit tests pass
- The Debug APK builds successfully, installs onto a connected device, and can reach the chat history management page

Validation record:

- `ChatMemoryWindowPlannerTest` covers empty messages, summary exclusion, window boundaries, imported chats' `assistant` senders, and dense-summary scenarios. A session of 2,000 turns, each with a summary, is still split into 84 windows by 48 raw messages only, and does not issue requests based on the number of summaries
- `:app:testDebugUnitTest --tests "com.ai.assistance.operit.api.chat.library.ChatMemoryWindowPlannerTest" :app:assembleDebug` succeeded, and the final Debug APK was generated
- Overlaid installation onto device `V2055A`'s isolated package `com.ai.assistance.operit.debug`, with an installation update time of 2026-08-13 08:33:11. The official package `com.ai.assistance.operit` was not modified
- The isolated package's leftover Room 21 data could not be opened directly by the current Room 20, so only the isolated package's data was cleared before continuing validation; the database migration logic was not modified
- Entered "Settings - Chat History Management". An empty chat list also shows the "Build memory library by window" section, the default window is 32 messages, the window-size dropdown options are 16, 24, 32, and 48 messages, and the "Build memory for 0 selected chats" button is disabled
- The isolated package had no selectable chat history, so the secondary confirmation dialog could not be opened on the device. No model requests were issued, and nothing was written to the memory library
- Added `MemoryAnalysisProtocolTest`; no Gradle tests or builds were run in this round, following the default constraints in `AGENTS.md`
- The latest device logs showed long windows had once been inflated to 8,198/14,273 input tokens by assistant thinking text and duplicated history, and short-question retrieval hit irrelevant candidates; thinking text has been removed and bounded window context included in candidate retrieval, and no Gradle tests or builds were run in this round
