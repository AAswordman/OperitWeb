# Settings and Paste Conversion

## Current Status

Text changes in chat input and attachment additions follow separate paths; paste operations are not yet recognized, and there is no long-text threshold setting.

## Changes

- Add an enable switch and a character threshold in chat settings, with a default threshold of 3000
- Provide a paste event handler for the editor, comparing the newly added range before and after pasting
- Write plain text exceeding the threshold to a cleanup directory, and add it to the pending send list as a `text/plain` attachment
- Keep the ordinary text editing, manual file selection, and existing attachment sending paths unchanged

## Expected Results

After the user pastes text exceeding the threshold, the input box does not carry that text, and a sendable `.txt` file appears in the attachment preview.

[DONE]
