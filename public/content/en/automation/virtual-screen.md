## Virtual Screen

In Operit, automation is orchestrated by the main Agent. The virtual screen is one of its execution environments.

You can think of a virtual screen as:

- an independent display session created by the system,
- where the Agent performs screenshot, vision analysis, tap, and swipe actions,
- and **not** the normal main-screen tap flow, and **not** the accessibility execution pipeline.

For users, only three things matter:

- whether the virtual screen prerequisites are met,
- how to troubleshoot quickly when it fails,
- and where to read AutoGLM configuration details (this page does not repeat them).

---

### 1. Prerequisites

Please confirm all of the following:

1. Authorization is complete, and your permission level meets automation requirements.
2. If you use the Shizuku path, Shizuku is running and authorized.
3. **Experimental Virtual Screen** is enabled in Global Display Settings.
4. The UI Controller model is available.
5. Automation tool packages are in the correct state (for AutoGLM, follow the AutoGLM guide).

> **Important**: In virtual-screen mode, Accessibility is **not** the execution entry.
> Enabling Accessibility alone does not make virtual-screen automation work.

---

### 2. Troubleshooting Order

If tasks do not run, behave abnormally, or fail quickly, check in this order:

1. Verify authorization and permission status (do not treat “Accessibility enabled” as proof that virtual screen is ready).
2. Verify **Experimental Virtual Screen** is actually enabled.
3. Verify Shizuku status (if applicable).
4. Verify UI Controller model and tool package status.
5. Retry with a minimal task first (confirm a simple action can run stably).

---

### 3. AutoGLM Configuration (Read Here)

For full AutoGLM setup details, package switching, and version differences, go to:

- [AutoGLM Mode](/#/guide/automation/autoglm-mode)

This page intentionally does not duplicate AutoGLM setup steps.

