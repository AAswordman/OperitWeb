# Review Parameter Retention and Activated Package Notes

## Old Implementation

A tool review consists of the tool name, a parameter preview, and an additional body-text preview. Summaries append activated package notes and the corresponding tool tips.

## Changes

- Tool call reviews continue to output the tool name, parameter preview, and additional body-text preview
- Package notes in summaries are uniformly called "activated packages"
- The activated package block notes that the packages listed in it can be used directly
- The system prompt does not add extra activated package rules

## Acceptance Criteria

- Tool entries in reviews retain the compressed preview of `<param>` names and values
- The activated package block no longer uses the "warmup" wording
- System package notes do not contain extra rules for the activated package block

[DONE]
