# Tests and Documentation

## Goal

Cover JS facade local declarations, JS version variant selection, registration bridge limits, and public developer documentation.

## Expected Behavior

- Old API calls to newly public capabilities receive a unified error
- New APIs go through the corresponding local implementation variant
- Tests do not depend on a centralized catalog or a tool/registration mapping table
- User-facing developer documentation only explains manifest version semantics and usage requirements, and does not include internal development logs or implementation processes
