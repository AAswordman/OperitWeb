---
For_Agent: Disable Android lint enforcement in PR checks
---

# CI Skips Android Lint

## Original State

The PR Candidate checks no longer ran `:app:lintDebug`, but still ran a lint baseline normalization check. The repository has no `app/lint-baseline.xml`, so that check failed every candidate commit.

## Changes

- Remove the lint baseline quick check and its aggregate gate from the PR workflow
- Remove the Gradle configuration referencing the nonexistent baseline and the dedicated normalization script
- Update the CI and contribution docs to state explicitly that Android lint is currently not part of PR validation

## Expected Result

Candidate checks no longer fail because of Android lint or the lint baseline, while other quick checks and path-triggered builds and unit tests remain unchanged.

[DONE]
