# Dialogue Review Configuration

## Changes

Save the dialogue review's enabled state and title into the chat model configuration, and use them when appending the review after generating a summary. When the title is empty, use the default title for the application's language.

## Verification

- After disabling, the summary does not append a dialogue review
- A custom title only affects the review title, not the item-by-item review content
- The default title still keeps the original localized wording

[DONE]
