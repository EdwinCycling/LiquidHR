# T01 — Survey / Personality / 9-grid

- **Run ID:** T01
- **Name:** Survey, Personality and 9-grid talent core acceptance
- **Status:** READY
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee
- **External dependencies:** Survey/research, personality assessment/scoring, talent review/9-grid, Auth and browser harness
- **Preferred branch name:** `work/acceptance-T01-YYYYMMDD`
- **Fixture isolation strategy:** One dedicated survey, one personality assessment, one review cycle, one eligible employee and one in-scope manager; no shared production-like campaign or existing 9-grid cycle mutation
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Preflight and discovery

Inventory the actual model, routes, pages, APIs, RPCs, actions, configuration, lifecycle states, question types, scoring contract, axes, scales, permissions, list/detail pages, projections and audit/history. Record which anonymity, close/expiry, retake and versioning behaviors are implemented; do not invent psychological interpretation or unsupported states.

## Survey acceptance

1. Create or safely reuse one controlled survey with a unique run ID.
2. Discover and record question types, requiredness, validation and anonymous/non-anonymous behavior.
3. Publish and assign to the controlled Employee.
4. Prove Employee discovery, first-use and empty states.
5. Save draft or save-later when supported; refresh and relogin before completion.
6. Complete the survey and submit exactly once.
7. Repeat submit and verify idempotency or a documented fail-closed result.
8. Verify response count, completion rate, aggregate calculations and list/detail consistency.
9. Verify close/expired behavior when implemented, including mutation denial after close.
10. Verify HR result access, Manager in-scope access, Manager out-of-scope denial, Employee self visibility and Other Employee privacy.
11. Verify validation, missing-required answers, malformed direct API payloads and no raw-answer leak where anonymity is promised.
12. Re-read persisted responses and all downstream projections after refresh/relogin.

## Personality acceptance

1. Discover the implemented assessment/scoring contract, answer model, versions and result lifecycle.
2. Assign exactly one controlled personality test to the Employee.
3. Prove Employee completion, persisted answers, exactly one result and deterministic scoring from the recorded answers.
4. Repeat submit and record idempotency, duplicate prevention or the contracted error.
5. Verify retake/versioning only when implemented; do not create a second result accidentally.
6. Verify Employee, Manager and HR result visibility, Other Employee privacy and raw-answer privacy.
7. Verify no unsupported psychological interpretation is introduced by the acceptance or UI.

## 9-grid acceptance

1. Discover actual axes/scales, cell labels, current-placement model, eligibility rules and filters.
2. Read the baseline grid and record eligible population and visible cell counts.
3. Assign a Manager assessment for the in-scope Employee and update that same assessment once.
4. Verify exactly one current placement per eligible Employee, old/new cell consistency, history/audit and HR overview.
5. Verify Manager out-of-scope denial, Employee visibility/privacy and Other Employee privacy.
6. Prove mathematical consistency: the sum of current visible cells equals eligible plotted employees subject to documented filters.
7. Prove no Employee appears in multiple current cells.
8. Repeat/refresh/relogin and confirm stable placement and history.

## Cross-module, negative and mobile gates

Survey must not silently alter Personality; Personality must not silently alter 9-grid; 9-grid must not expose Survey raw answers; Manager scope must be consistent across all three. Probe direct IDs, API substitution and unauthorized RPC/action paths with no leak or mutation. Check Employee-facing Survey and Personality surfaces at 390x844 for covered controls, overflow, usable completion and stable navigation.

## Verdict

Final verdict must be exactly `T01 TALENT CORE GREEN — READY FOR HUMAN REVIEW` when all assertions pass, otherwise record the exact blocker and primary classification.
