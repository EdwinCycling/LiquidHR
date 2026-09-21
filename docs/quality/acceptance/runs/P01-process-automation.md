# P01 — Process Automation

- **Run ID:** P01
- **Name:** Process Automation runtime and canonical-domain acceptance
- **Status:** READY
- **Execution mode:** SOLO
- **Mutation risk:** HIGH
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee, owner where configured
- **External dependencies:** Recipes, definitions, steps, assignments, variables, forms, approvals, deadlines, reminders, outputs, document acknowledgement and worker/runtime processing
- **Preferred branch name:** `work/acceptance-P01-YYYYMMDD`
- **Fixture isolation strategy:** One disposable process definition/recipe and one unique runtime instance; no shared Leave/Absence/Actual Work ledger mutation unless the process contract explicitly owns a controlled fixture
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Inventory

Inventory definitions, recipes, steps, assignments, variables, forms, approvals, request changes, deadlines, reminders, outputs, document acknowledgement, runtime states, work items, Mijn werk and Mijn aanvragen. Record routes/pages/APIs/RPCs/actions, configuration, permissions, lifecycle transitions, list/detail, projections and audit/history.

## Representative flow

Run the canonical sequence:

`start → form → Manager task → request changes → Employee correction → approval → output/action → completion`.

Read back process instance, work items, assignments, variables, events, output/document references and final state after every transition. Prove UI, API and DB/read-model consistency, refresh/relogin behavior, idempotency, deadline/reminder behavior and empty/first-use states.

## Negative and ownership gates

Test unauthorized start, wrong actor, double approval, stale work item, direct step skip, invalid form payload, out-of-scope Manager and direct API/RPC bypass. Prove no duplicate output, false audit, revision mutation or hidden data leak. Demonstrate that Process Automation routes to canonical business domains and does not duplicate Leave, Absence or Actual Work ownership. Any conflicting ownership is `PRODUCT_DECISION` or `SECURITY_STOP`, never silently accepted.
