---
title: Step 2: Diff Attribution and Checkers
status: completed
---

# Step 2: Diff Attribution and Checkers

## Old Implementation

Localization checks extracted keys from newly added XML lines, then promoted same-named historical errors in all languages to errors for this run. Repository hygiene and Markdown checks switched to full-repository scans when the base parameter was missing, so the semantics of PR and local invocations were not stable.

## New Implementation

- All PR checks explicitly receive base and candidate
- Localization resources are parsed separately from two Git objects and compared by locale, type, and key
- Combined qualifier resources for the same locale are compared independently by file path, without overwriting each other
- Only diagnostics newly added by the candidate, or diagnostics for resource entities actually touched by the PR that still exist, block
- Missing translations, identical text, and historical issues are only summarized as hints
- Repository hygiene uniformly checks whitespace, conflict markers, and JSON/XML syntax in the candidate's net diff
- Diagnostics are written to Actions annotations and the step summary, with duplicate output limited in quantity

## Acceptance

- Modifying Romanian does not trigger English or Portuguese historical placeholder errors
- Multi-line strings, plurals, arrays, and deleted resources are recognized by semantic comparison
- `locales_config.xml` and the actual values directories stay consistent in both directions
- The root element, child items, default locale, and duplicate items of `locale-config` all pass structural validation
- A quick check displays all fixable problems at once, without stopping early at the first error

[DONE]
