# Issue Triage Report

## Overall summary (counts by category, quick highlights)
**Total issues:** 45 (status: open)

**Counts by category:**
*   **Bug:** 7 (including 3 P0)
*   **Accessibility/Permissions:** 6 (including 2 P1)
*   **User Interface (UI):** 11 (including 2 P1)
*   **Tool/Feature Management:** 9 (all P1/P2)
*   **Tool/Automation:** 6 (including 2 P1)
*   **Model/API Integration:** 3 (including 1 P1)
*   **Internationalization (i18n):** 1 (P1)
*   **Configuration/Sync:** 1 (P1)
*   **Model / AI Core:** 2 (including 1 P1)
*   **Data Import/Export:** 1 (P2)
*   **App Distribution:** 1 (P2)
*   **Terminal:** 1 (P1, overlapping UI category #237)

**Quick highlights:**
*   **High-priority bugs (P0):** There are 3 critical bugs, all causing core UI information retrieval/automation features to fail completely on specific systems (#125, #101, #67).
*   **Permissions and compatibility issues stand out:** Multiple P1 issues involve Android systems (especially ColorOS, MIUI, HarmonyOS) with permission grant failures, service connection anomalies, or file access problems (#306, #283, #317).
*   **Feature suggestions concentrated:** Many P1/P2 issues propose suggestions around **UI/UX optimization**, **automation feature enhancement**, **AI execution efficiency improvements** (such as quiet mode, variable storage), and **configuration management** (such as model binding per conversation, configuration sync).
*   **Model integration problems:** There are failures calling Zhipu models via oneAPI (#277) and local llama.cpp connection problems (#258), affecting model availability.

## Top priorities (P0 then P1)

**P0 (critical bugs, investigate immediately):**
1.  **#125**: UI information is always that of the Operit AI app - When the AI operates other apps, it retrieves its own UI information, causing core automation features to fail.
2.  **#101**: [bug] UI debugging tool cannot retrieve current screen content - On ColorOS, it triggers a system back action and cannot retrieve screen content.
3.  **#67**: MIUI 14.0.4 cannot retrieve page elements in either debugger or root mode - On MIUI, UI data retrieval fails completely.

**P1 (high-priority features/bugs):**
1.  **#306**: [BUG] ColorOS cannot lift permission restrictions because the accessibility app has not requested any permissions - The permission flow is blocked, affecting core feature enablement.
2.  **#312**: English selected but large parts of UI still in Chinese - Incomplete internationalization, affecting the experience of non-Chinese users.
3.  **#266**: After switching characters, history conversations do not display on the main UI, only in the floating window - Inconsistent data display, affecting usage coherence.
4.  **#283**: Bug: Accessibility service is enabled but the AI assistant interface service shows as not connected - Incorrect service status indication, misleading users.
5.  **#317**: [bug] On Android 8, the app cannot read or modify files on the Android device itself - Basic file features fail on specific systems.
6.  **#277**: Calling the Zhipu code model via oneAPI integration fails - Third-party model integration failure, affecting feature availability.
7.  **#321**: Add configuration sync feature - An important user experience enhancement with high design complexity.
8.  **#237**: Suggestions (comprehensive UI/feature suggestions, including terminal SSH ideas)
9.  **#10**: Ten suggestions (a collection of basic feature and UI improvement suggestions)
10. **#248**: Minor feature expansion suggestions (auto screenshots, continuous conversation, scheduled reminders, etc.)
11. **#35**: Please add image recognition/search... (supplementing UI automation capabilities)
12. **#216**: Local llm implementation cpu/gpu/npu (support local LLMs)
13. **#165**: code_runner code display bug (display format error)

## By category (each category heading, list issues)

### Bug
*   **#125 (P0)**: UI information is always that of the Operit AI app - When the AI operates other apps, the UI information retrieved is wrong (always this app), causing features to fail. **Action: Investigate**
*   **#101 (P0)**: [bug] UI debugging tool cannot retrieve current screen content - On specific systems (Android 10 ColorOS), calling the UI debugging tool triggers a system back action and cannot retrieve content. **Action: Investigate**
*   **#67 (P0)**: MIUI 14.0.4 cannot retrieve page elements in either debugger or root mode - On MIUI systems, UI data retrieval fails completely. **Action: Investigate**
*   **#165 (P1)**: code_runner code display bug - When code_runner displays code, it includes surrounding tags instead of pure code. **Action: Fix**
*   **#27 (P2)**: Screen recognition fails to recognize anything in a certain app - The screen recognition feature fails in specific apps. **Action: Investigate**
*   **#291 (P2)**: Importing chat history reports an error - Importing chat history fails, reporting "No valid chat history found" or "Format conversion failed". **Action: Investigate**
*   **#263 (P2)**: Search engine result extraction problem - After searching with Baidu, extracting the detail page content of search results frequently encounters 404 errors. **Action: Investigate**

### Accessibility/Permissions
*   **#306 (P1)**: [BUG] ColorOS cannot lift permission restrictions because the accessibility app has not requested any permissions - On ColorOS, because the app has not requested regular permissions, permission restrictions cannot be lifted in Settings, preventing accessibility permission from being granted. **Action: Fix**
*   **#283 (P1)**: Bug: Accessibility service is enabled but the AI assistant interface service shows as not connected - The accessibility service is enabled, but the app shows the AI assistant interface service as not connected. **Action: Investigate**
*   **#317 (P1)**: [bug] On Android 8, the app cannot read or modify files on the Android device itself - On Android 8 (HarmonyOS 2) devices, the app cannot read or write device-local files (although `code_runner` and `shell` are available). **Action: Investigate**
*   **#316 (P2)**: About the app being associated-launched - The app is associated-launched while closed and pops up a notification that cannot be swiped away, affecting user experience; seeking a way to turn it off. **Action: Investigate**
*   **#307 (P2)**: Low usability of the voice assistant feature - The voice assistant has multiple problems: gesture launch does not allow direct voice input, high recognition failure rate, suggestion to call system interfaces, and low icon recognizability. **Action: Investigate**
*   **#250 (partial content) (P2)**: Automation tasks cannot recognize and select dual-app prompts or system permission popups. **Action: Design**

### User Interface (UI)
*   **#266 (P1)**: After switching characters, history conversations do not display on the main UI, only in the floating window - After switching character cards, the main UI cannot load the corresponding history conversations, only the floating window shows part of them, and data is out of sync. **Action: Fix**
*   **#320 (P1)**: 1. You ask a question in one conversation... - Contains multiple UI interaction problems: multi-conversation lag, abnormal table display in waifu mode, window mode switching conflicts, and insufficient color picker visualization. **Action: Investigate**
*   **#237 (P1)**: Suggestions - Contains multiple UI improvement suggestions, such as dialog backgrounds, permission management, etc. **Design**
*   **#10 (P1)**: Ten suggestions - Contains multiple basic feature and UI improvement suggestions, such as input interaction, navigation, themes, etc. **Design**
*   **#268 (P2)**: Full screen
