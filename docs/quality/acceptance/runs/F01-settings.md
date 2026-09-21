# F01 — Settings

- **Run ID:** F01
- **Name:** Complete settings inventory and controlled round-trip acceptance
- **Status:** READY
- **Execution mode:** SOLO
- **Mutation risk:** HIGH
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self
- **External dependencies:** All enabled settings modules, Auth, audit/history and downstream read models
- **Preferred branch name:** `work/acceptance-F01-YYYYMMDD`
- **Fixture isolation strategy:** One dedicated DEV tenant/group/configuration snapshot; capture and restore every changed value immediately
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Inventory

Inventory every materially implemented setting and record route/page/API/RPC/action, permissions, scope, lifecycle and audit/history for: HR groups; companies/administrations; locations; jobs and job groups; employment configuration; Leave; Absence; Actual Work; work patterns; holidays; modules; Directory; Employee self-service; Manager self-service; Focus policy/mode; Documents; Journeys; Talent; dashboard/widget settings; reminders/notifications; AI settings/governance/credits; Payroll/provider settings; roles and configuration.

## Controlled round-trip for every editable setting

For each setting:

`read current → controlled change → save via UI → DB/read-model readback → hard refresh → relogin when meaningful → downstream effect → restore original → restoration readback`.

Record actor, subject, before/after row counts, audit/revision/event and downstream projection. Use a unique run ID and never leave a setting changed.

## Validation and authorization matrix

Test required fields, invalid values, duplicates, conflicts where implemented, module-off behavior, direct API/RPC mutation, role access, audit creation, tenant/group/administration scope and Manager/Employee denial. Verify list/detail consistency, empty/first-use states, refresh/relogin persistence, close/archive/delete behavior, error paths and mobile usability. Test direct ID substitution and cross-group IDs where safe.

## Release boundary

Do not broaden permissions to make a settings screen pass. If a setting's intended scope is undefined, classify `PRODUCT_DECISION`. Any failed restore, unexpected downstream mutation, cross-tenant read or security leak is a `SECURITY_STOP` until isolated.
