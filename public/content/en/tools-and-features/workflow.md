# Workflow Guide (Templates and Use Cases)

This page explains workflow usage from a product perspective:

- How workflows run in real tasks
- The difference between **connections** and **references**
- How all built-in templates trigger and execute

---

## 1) Case at a glance: automated posting and monitoring

This is a typical **scheduled execution + status tracking** scenario:

- Goal: let AI publish updates regularly and keep monitoring activity
- Constraint: the target platform may enforce posting intervals (for example, every 30 minutes)
- Approach: use a workflow schedule instead of manually sending “continue” each time

### Case screenshots

![workflow-case-01|225x500, 50%](/manuals/assets/workflow/01.png)

![workflow-case-02|225x500, 50%](/manuals/assets/workflow/02.png)
![workflow-case-03|225x500, 50%](/manuals/assets/workflow/03.png)

![workflow-case-04|225x500,50%](/manuals/assets/workflow/04.png)
![workflow-case-05|225x500, 50%](/manuals/assets/workflow/05.png)

![workflow-case-06|225x500, 50%](/manuals/assets/workflow/06.png)
![workflow-case-07|225x500, 50%](/manuals/assets/workflow/07.png)

![workflow-case-08|225x500, 50%](/manuals/assets/workflow/08.png)
![workflow-case-09|225x500, 50%](/manuals/assets/workflow/09.png)

### Practical editing notes

- After AI generates a workflow, nodes may overlap at first; reorganize layout manually.
- In some cases, the list does not refresh immediately after creation; reopen the app to confirm.
- You can enable or disable a workflow in `Workflow > Edit Workflow`.
- Long-press an existing node to edit it.
- This kind of workflow can run under standard permission settings.

---

## 2) Core concepts

## 2.1 Connection

Connections define **how execution moves** through the graph:

- Sequence (run B after A)
- Branching (choose different paths based on outcomes)

Common branch conditions:

- `on_success`: continue when the previous step succeeds
- `on_error`: continue when the previous step fails
- `true` / `false`: branch by condition result
- Custom regex: branch by text pattern matching

## 2.2 Reference

References define **where parameter values come from**:

- Downstream nodes use values from upstream outputs
- Parameters stay dynamic instead of hardcoded

Common usage:

- Extract a token/code from one step
- Pass it directly into the next step via reference

## 2.3 Connection + reference together

- Execution control depends on connections
- Data flow depends on references
- Reliable workflows use both, not just one

---

## 3) AI tool exposure in workflows

`StandardWorkflowTools` is the mechanism that exposes available tools to AI so it can decide when to call them during execution.

From a user perspective, this means:

- AI can pick the right tool at the right step instead of only replying in plain text.
- The workflow can combine conversation, tool calls, and branching in one chain.
- You can keep automation flexible without hardcoding every action path.

Recommended practice:

- Expose only the tools needed for the current workflow goal.
- Keep a validation or fallback branch after critical tool actions.
- Add `on_error` branches for external actions that may fail.

---

## 4) Execution model (user view)

A workflow typically runs in this order:

1. A trigger starts the run.
2. Nodes execute by dependency order.
3. Each node reports a status (`running`, `success`, `skipped`, or `failed`).
4. Downstream nodes continue only when connection conditions are met.

Status meanings:

- **Success**: step completed and produced usable output
- **Skipped**: branch condition was not matched
- **Failed**: step errored or required condition could not be satisfied

Troubleshooting order:

1. Check upstream output first.
2. Verify connection conditions.
3. Verify references point to the intended node output.
4. Confirm the run entered the expected branch.

---

## 5) Built-in templates (all 8)

Each template is described by **trigger type + connection order**.

## Template 1: Intent-triggered chat and result broadcast

**Trigger**
- External broadcast trigger

**Connection order**
- Receive trigger
→ Start conversation service
→ Create session
→ Extract trigger message
→ Send message to AI
→ Stop conversation service
→ Broadcast result back
→ Clear virtual display

**Best for**
- External systems dispatch tasks and receive AI results automatically.

---

## Template 2: Manual chat chain

**Trigger**
- Manual trigger

**Connection order**
- Manual trigger
→ Start conversation service
→ Create session
→ Send message
→ Stop conversation service
→ Clear virtual display

**Best for**
- Quickly validating the main chat automation path.

---

## Template 3: Conditional web branching flow

**Trigger**
- Manual trigger

**Connection order**
- Manual trigger
→ Visit web page A
→ Extract key information
→ Evaluate condition
→ (true) follow in-page link
→ (false) visit fallback page B

**Best for**
- Web checks where different findings require different follow-up actions.

---

## Template 4: Logical AND branching

**Trigger**
- Manual trigger

**Connection order**
- Manual trigger
→ Visit web page
→ Evaluate condition A
→ Evaluate condition B
→ Merge with AND logic
→ (true) primary action
→ (false) fallback action

**Best for**
- Scenarios that must satisfy multiple conditions before proceeding.

---

## Template 5: Logical OR branching

**Trigger**
- Manual trigger

**Connection order**
- Manual trigger
→ Visit web page
→ Evaluate condition A
→ Evaluate condition B
→ Merge with OR logic
→ (true) primary action
→ (false) fallback action

**Best for**
- Scenarios where any one condition can unlock the next step.

---

## Template 6: Extract/compute demonstration flow

**Trigger**
- Manual trigger

**Main chain**
- Manual trigger
→ Generate value/text
→ Concatenate
→ Slice

**Branch chain**
- Compare values
→ (true) display result

**Best for**
- Practicing data pipelines: generate → transform → decide → output.

---

## Template 7: Success/failure branch skeleton

**Trigger**
- Manual trigger

**Connection order**
- Manual trigger
→ Primary action
→ (success) success branch
→ (failure) failure branch

**Best for**
- Adding standard error handling around critical actions.

---

## Template 8: Speech-triggered chat start

**Trigger**
- Voice keyword trigger

**Connection order**
- Voice keyword matched
→ Start conversation service

**Best for**
- Hands-free entry to start workflow execution.

---

## 6) Template selection quick guide

- Fast path verification: **Manual chat chain**
- Web monitoring and branching: **Conditional web flow**
- Multi-condition decisions: **AND / OR templates**
- Data manipulation: **Extract/compute flow**
- Reliability first: **Success/failure skeleton**
- External system integration: **Intent-triggered flow**
- Voice-first entry: **Speech-triggered flow**

---

## 7) Editing recommendations

- Build and verify the main chain first, then add branches.
- Add connections first, then wire references.
- Keep observable outputs on critical nodes for debugging.
- Add `on_error` fallbacks for external or failure-prone actions.

---

## 8) Recommended prompt when asking AI to modify a workflow

```txt
Please modify the "Conditional web branching flow" template:
- Keep the trigger and main chain order unchanged.
- Only replace the condition logic and fallback branch target.
- At the end, restate the final connection order with arrow steps.
```

This instruction style helps limit unintended edits.
