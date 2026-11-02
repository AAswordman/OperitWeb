# Chat History Management Entry and Progress

Old implementation:

- The session multi-select area only supported deletion and bulk adjustment of character card and group membership

Intent correction:

- Split bulk management and memory operations into two entries, to avoid laying out two classes of operations with different risk levels flat under the chat list
- After selecting chats, enter a unified action dialog; bulk categorization and deletion go into the management dialog, while memory building goes into a separate configuration confirmation dialog
- Under the list, only show the progress of running memory tasks and a cancel button

Expected results:

- Users can build memory for historical sessions directly from chat history management
- Status is visible and cancellation semantics are clear, and low-frequency operations do not interfere with chat history selection

[DONE]
