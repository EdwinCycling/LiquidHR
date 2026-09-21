# T02 — Talent Development

- **Run ID:** T02
- **Name:** Talent development golden journey
- **Status:** READY
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee
- **External dependencies:** Continuous Appraisal, Goals, POP, Skills/Competencies, Talent profiles, notifications and history
- **Preferred branch name:** `work/acceptance-T02-YYYYMMDD`
- **Fixture isolation strategy:** One dedicated Employee, manager and development cycle/profile; unique goals, skills and POP records; do not alter an existing review cycle
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Discovery and role matrix

Inventory Continuous Appraisal, Goals, POP, Skills/Competencies and Talent profile routes, pages, APIs, RPCs/actions, configuration, states, permissions, list/detail, projections and audit/history. Record required skills, current/required levels, gaps, profile versions and privacy rules.

## Golden journey

Execute and persist read back:

`profile → skills → development goal → Manager interaction → appraisal/feedback → development action → progress/update → HR/Talent projection`.

Cover skill catalogue, profile requirements, required level/current level/gap, versioning, goal lifecycle, POP lifecycle, appraisal timeline, comments/feedback, development actions, progress updates, history and notifications. Prove refresh/relogin, empty/first-use states, duplicate/idempotency, close/archive and invalid/stale payload behavior.

## Privacy and cross-module safety

HR sees intended organization scope; Manager sees only in-scope Employee data; Employee sees self data and contracted feedback; Other Employee and out-of-scope Manager are denied. Use direct IDs and API/RPC substitution. Prove no unintended 9-grid mutation, no raw private assessment leak, no cross-tenant read/write and no false audit. Record downstream HR/Talent projections and exact current versions.
