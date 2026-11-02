---
topic: Isolate OpenCode provider behavior
status: done
---

# OpenCode provider isolation

## Original Status

The first version of the OpenCode integration injected routing, authentication, and thinking parameters into the Claude, Gemini, OpenAI, and Responses providers via a marker. This forced ordinary providers to recognize OpenCode special cases, leaving the public request path to bear protocol differences that did not belong to it.

## Intent of the Fix

Keep OpenCode's protocol adaptation inside the OpenCode-specific implementation. Ordinary providers retain only their own generic behavior; necessary inheritance points only express stable request-building extensions and do not reference OpenCode types or branch checks.

## Scope

- Restore the original reasoning, authentication, and endpoint behavior of the public providers
- Provide isolated implementations for OpenCode's Chat Completions, Responses, Anthropic, and Gemini routes
- Fix OpenCode Gemini's authentication header and SSE URL
- Keep existing settings, model catalog, and routing tests, and add a description of the isolation boundary

## Detailed Steps

## Completion Record

- The public Providers have had the OpenCode marker, endpoint checks, and authentication branches removed.
- The dedicated OpenCode Chat, Responses, Anthropic, and Gemini implementations have been merged into OpenCodeProvider.kt.
- `git diff --check` has been run; no build, Gradle, or test commands were run.

1. `01-public-provider-baseline.md`: records the restoration boundary of the public providers
2. `02-opencode-routing.md`: records the dedicated routing and protocol adaptation approach
3. `03-verification.md`: records the static verification results
