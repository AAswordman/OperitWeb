# Pre-Hook Timeout Gate

## Original Behavior

- ToolPkg chat input, Prompt, and summary Hooks execute sequentially within their respective bridges
- Each script call uses QuickJS's main execution timeout, 1,800 seconds by default
- Multiple Hooks accumulate waiting time

## Implementation Intent

- Provide a setting of 1 to 60 seconds in both display and behavior, with a default of 10 seconds
- Each bridge dispatch creates a total budget, and each Hook in the chain may only use the remaining time
- On expiry, interrupt QuickJS, skip the timed-out Hook's return value, and let the host continue with the current context
- Keep the `message_processing` reply takeover chain independent and outside this gate

## Change Result

- `JsEngine` accepts a precise millisecond timeout and interrupts QuickJS when the wait expires
- The chat input, Prompt, and summary bridges all pass the remaining budget of the same dispatch chain
- Logs record the phase, package name, Hook ID, and elapsed time, making it easy to locate a stuck plugin
- When the user actively submits a message, a chat input Hook timeout is surfaced once via a custom in-chat Toast; the Prompt and summary phases still only log

[DONE]
