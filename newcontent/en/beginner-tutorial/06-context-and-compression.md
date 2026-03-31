# Context, Compression, and Truncation

The **context summary feature** can automatically generate summaries when the conversation context gets too long, reducing `Token` consumption. When context usage exceeds the configured ratio or the message count reaches the threshold, the system will automatically trigger summarization.

For details, please refer to Tutorial 4 for what `context` is, what `max mode` is, how to manually insert compression into context, how to configure context size, and how to configure compression. This section will not repeat those details.

### Additional Notes on Context

To stress again, model-side cache support is **extremely important**, especially for an `agent` product like Operit AI. Without cache, once context reaches around `100k`, the cost can become very expensive.

If your model has no cache, first consider leaving `max mode` off. Next, keep tool usage moderate; in the input-menu disable list, disable items as needed to reduce context size.

![](/manuals/assets/context/1.jpg)

If cache is available, then it is much easier, *go all in*; usually only the first input costs the most, and later tool calls benefit from cache hits, so consumption is much lower.

When `token` over-limit prompts appear, consider long-pressing earlier messages and manually inserting a summary. **Force send does not truncate, but it may cause model errors**.

Current `token` usage is shown in the upper-right corner. From top to bottom, it is **current context window size, cumulative input, cumulative output, cumulative total**.

![](/manuals/assets/context/3.jpg)

### Additional Notes on Compression

Compression prompt text is currently not customizable. Compression has two types: **manual compression** and **automatic compression**, and automatic compression has two trigger modes.

After compression, the next message will **discard previous context** and start calculation from the summary only.

During compression, the model first summarizes earlier messages, then the program processes a summary of the user’s sent message, and finally appends active packages automatically to avoid tool-calling confusion.

- **Manual compression**: Long-press a message and tap **Insert Summary**. Summaries can be inserted between any `ai` message and user message.

- **Automatic compression**: Split into **threshold compression** and **message-count compression**.

- 1. **Threshold compression**: If `ai` is calling tools and finds current context exceeds configured `ratio*total_context`, callback is immediately paused and handed to the summary model. After summarization, the original `ai` call is resumed immediately. But if compression is triggered during user message sending, asynchronous compression runs in the background and is automatically inserted before the user’s current message after completion.
- 2. **Message-count compression**: When user-sent messages exceed a certain count, the asynchronous compression above is triggered. In most cases, for cached `api`, this is recommended to stay off.

### Truncation

In general, you do not need to touch the earlier items here. Just look at the **last two**.

When sending messages with images, after a certain number of messages, earlier images or videos will be discarded to prevent context bloat and repeated inference.

![](/manuals/assets/context/2.jpg)
