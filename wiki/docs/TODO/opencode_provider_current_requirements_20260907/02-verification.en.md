# Verification Record

This time, no build, Gradle, or test commands were run, per the repository's execution guidelines.

Static check items:

- The OpenCode model list URL contains `/v1/models`.
- Zen and Go MiniMax protocols are distinguished by endpoint.
- OpenCode-specific request headers are only injected in OpenCode routes.
- The public provider has no new OpenCode conditional branches.

Static checks are complete: `git diff --check` reported no errors. No build, Gradle, or test commands were run.
