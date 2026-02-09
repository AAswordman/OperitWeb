# Workflow (Start from Templates)

Workflow documentation is still limited, so the most reliable approach is: **run a template first, then modify it step by step**.  
Do not start from a blank canvas unless you already know the full flow structure.

---

## Recommended Way to Use It

Follow this order to save time:

1. Pick the template closest to your goal.
2. Only change minimal input first (for example, trigger text or target URL).
3. Run once and confirm the main chain completes.
4. Change only one node or one connection each time, then run again.
5. Keep a failure branch (`on_error`) for critical actions.

If you change too many things at once, debugging becomes much slower.

---

## Essential Concepts (Practical Version)

### Connection

Connections control execution path:

- where to go after success (`on_success`)
- where to go after failure (`on_error`)
- where to go on true/false (`true` / `false`)

### Reference

References control data source:

- downstream parameters are not hardcoded
- downstream nodes use upstream output directly

### Relationship

- Connections decide path
- References decide value source

---

## Use Case: Scheduled Posting + Monitoring

This is a typical “scheduled execution + status tracking” scenario:

- Goal: let AI execute actions periodically and keep checking results
- Constraint: platform rate limits may apply (for example, once every 30 minutes)
- Approach: use workflow scheduling to reduce repeated manual actions

### Case Screenshots

![workflow-case-01|225x500, 50%](/manuals/assets/workflow/01.png)

![workflow-case-02|225x500, 50%](/manuals/assets/workflow/02.png)
![workflow-case-03|225x500, 50%](/manuals/assets/workflow/03.png)

![workflow-case-04|225x500,50%](/manuals/assets/workflow/04.png)
![workflow-case-05|225x500, 50%](/manuals/assets/workflow/05.png)

![workflow-case-06|225x500, 50%](/manuals/assets/workflow/06.png)
![workflow-case-07|225x500, 50%](/manuals/assets/workflow/07.png)

![workflow-case-08|225x500, 50%](/manuals/assets/workflow/08.png)
![workflow-case-09|225x500, 50%](/manuals/assets/workflow/09.png)

### Practical Notes

- Auto-generated nodes may overlap. Arrange layout first.
- If the workflow list does not refresh immediately, reopening the app usually fixes it.
- Use `Workflow > Edit Workflow` to enable/disable a workflow.
- You can usually long-press a node to edit it.

---

## Built-in Template Selection (8 Templates)

### 1) Intent-triggered chat with result callback

- Best for: external systems trigger tasks and receive AI results back.
- Main chain: receive trigger → start service → create session → extract message → send to AI → stop service → return result.

### 2) Manual chat chain

- Best for: quickly verifying the core chat automation path.
- Main chain: manual trigger → start service → create session → send message → stop service.

### 3) Conditional web branching flow

- Best for: web inspection with branch-based follow-up.
- Main chain: open page → extract info → evaluate condition → true branch / false branch.

### 4) Logical AND branching flow

- Best for: continue only when multiple conditions are all satisfied.

### 5) Logical OR branching flow

- Best for: continue when any condition is satisfied.

### 6) Extract/compute demo flow

- Best for: practicing extraction, transformation, decision, and output.

### 7) Success/failure skeleton

- Best for: adding standard fallback handling around critical actions.

### 8) Voice-triggered chat start

- Best for: starting workflow by voice keyword.

---

## Troubleshooting Order (Recommended)

1. Check whether upstream output is correct.
2. Check whether connection conditions are correct.
3. Check whether references point to the right node output.
4. Confirm whether the run entered the expected branch.

---

## Prompt to Ask AI to Modify a Template

```txt
Please modify the "Conditional web branching flow" template:
- Keep the trigger and main chain order unchanged
- Only replace condition logic and fallback branch target
- Modify one node at a time and show a preview before each change
- At the end, restate the final connection order with arrows
```

This instruction style helps reduce unintended edits and makes rollback easier.

---

## Conclusion

For workflows, template-first usage is recommended. Run first, then make small incremental changes.