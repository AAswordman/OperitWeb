# Context Summary

The Context Summary feature automatically generates summaries when the conversation context becomes too long, saving Token consumption. The system will automatically trigger summarization when context usage exceeds the set ratio or when the message count reaches the threshold.

## Usage Instructions

1. **Enter Settings**: In the Settings page, find the "Context and Summary" option and tap to enter.

![Settings Page](/manuals/assets/chat/summary/44ea766adae93ca02bf620a586ff24d6.jpg)

2. **Configure Context Length**:
   - **Context Length**: Set the model's memory conversation length (recommended as the maximum value for daily use)
   - **Maximum Context Length**: Set the context length used in Max mode (recommended as the maximum value supported by the model API)

3. **Enable Conversation Summary**: Turn on the "Enable Conversation Summary" switch, and the system will automatically generate summaries when the context becomes too long.

4. **Set Trigger Conditions**:
   - **Context Usage Ratio Threshold**: Trigger summary when context usage exceeds this ratio (range 0.1~0.95, default 0.7)
   - **Trigger Summary by Message Count**: When enabled, trigger summary when the number of new messages reaches the threshold
   - **Message Count Threshold**: Set the number of messages that trigger summary (default 8 messages)

![Context and Summary Settings](/manuals/assets/chat/summary/11b21357a90214d5c6637d51707657d1.jpg)

## Max Mode

Max Mode uses a larger context window, suitable for handling long conversations or scenarios that require more contextual information.

### Usage Instructions

In the conversation settings menu, turn on the "Max Mode" switch to enable it.

![Max Mode Switch](/manuals/assets/chat/summary/89624e415e2ac0ed7a059a15d8bcd043.jpg)

## Use Cases

- **Long Conversation Management**: Automatically summarize historical content in long conversations to maintain smooth dialogue
- **Save Tokens**: Compress context through summarization to reduce API call costs
- **Handle Complex Tasks**: Use Max Mode to handle complex tasks that require extensive contextual information