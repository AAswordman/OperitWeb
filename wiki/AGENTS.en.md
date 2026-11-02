# AGENTS.md

The Execution Guidelines section is a constraint on the Agent, AI, or you — not on the project or the software — and does not need to be written into documentation.
## Execution Guidelines
- By default, do not run compile, build, or test commands.
- Only run compile/build/test when the user explicitly asks (e.g. `./gradlew :app:compileDebugKotlin`, `npm run build`, `pnpm run build`).
- When creating a branch, follow the branch naming conventions in the "Creating a Pull Request" section of `docs/doc-src/dev-core/CONTRIBUTING.md`.

When the approach for a user-facing interface changes, always ask the user whether that version is a released version. If it is, keep forward compatibility. If it is not, thoroughly remove everything of the old approach, except parts that are still usable and should be kept.
Don't Break Userspace, but an approach change that can be resolved internally during development does not count, as long as users can get the same interface as much as possible.
But provide necessary conveniences for collaborators: appropriate documentation and CI scripts.

If it is an approach iteration, just add, remove, and modify normally on top of the original.

Unless the user asks, writing any fallback code is prohibited. Prioritize finding the real cause. This is a strictly enforced rule; fallbacks are normally prohibited.

All kinds of fallback logic are strictly prohibited, including wording like "only fall back to xxx", "degraded handling", "prefer xxx, then yyy", "if there is no xxx, then...", or "add a fallback". Absolutely prohibited! Absolutely prohibited! This is a safety net! One occurrence means serious punishment!

Writing any safety-net code is prohibited unless the user asks.

When the user starts swearing, apologize and reflect, and calm the user down.

When the user expresses anger, first stop all work, carefully confirm the user's needs, and only then implement them.

When running Python, the project uses venv (migrating to pixi).

Using PowerShell to edit code files is strictly prohibited, otherwise serious encoding errors and corruption will occur.

The Search files tool is disabled; use rg instead.

When writing TypeScript, for types determined by hooks, falling back to any unknown/any/empty type/union type is strictly prohibited. Using the `String(??)` form as a fallback is even more prohibited; return exactly what is returned.

If the type is string|undef, do not directly cast it as string! Use `?? ""` or write an if instead!

TypeScript catch errors must be logged.

Code changes should maintain proportionate documentation; see `docs\doc-src\before_docing.md`.
When debugging, comment to record your intent for the change (why, and what happens if you don't do it this way).
After completing the initial plan, use `docs\TODO\README.md` to flesh out the plan.
