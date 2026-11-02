---
fork: https://github.com/tuxKOH/Operit.git
---

# Description of Activated Packages After Summarization

## Original State

The "conversation review" after a conversation summary re-displays tool call arguments after compressing them. The summary also appends a list of activated packages, along with their corresponding tool descriptions.

## Intent

- The conversation review retains tool names, argument previews, and additional body text previews
- The package descriptions in the summary are uniformly phrased as "activated packages"
- The activated packages block explains that the listed packages can be used directly
- No long-term rule about activated packages is added to the system prompt

## Scope

- `AIMessageManager`'s conversation review and activated package text
- Related Chinese and English resource texts

## Expected Result

The post-summary context continues to carry the compressed tool call arguments, making it easy to review the task process; after seeing the activated packages block, the model knows that the packages listed in it can be used directly.
