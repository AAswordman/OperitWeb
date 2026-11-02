---
title: Published User Agreement Version Confirmation
status: completed
document_type: implementation-plan-index
last_reviewed: 2026-07-15
---

# Published User Agreement Version Confirmation

This plan adds auditable agreement version confirmation to the published client. The existing boolean confirmation record cannot prove that the user read the updated terms.

## Goals

Each substantive agreement update uses an explicit version number. Users enter the main app only once they have confirmed the current version; users who installed an older version need to re-confirm after upgrading.

## Steps

1. [Agreement Version Gate [DONE]](./1_AgreementVersionGate.en.md): save the confirmed version, compare it against the current version, and show the version on the agreement page
2. [Agreement Text Draft [DONE]](./2_AgreementTextDraft.en.md): update the plain-language and rigorous versions of the terms based on user review results, and sync the agreement version

## Completion Markers

Once the agreement version gate is complete, add `[DONE]` to the end of the first step's title. Only after the agreement text has been confirmed by the user and syncing is complete may this plan be marked complete.

## Completion Record

Status: complete. The agreement version gate, the Chinese agreement text, and the existing multilingual agreement resources have all been synced to `2026-07-15`; no compile, build, or test commands were executed.
