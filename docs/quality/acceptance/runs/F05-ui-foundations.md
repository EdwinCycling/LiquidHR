# F05 — UI Foundations

- **Run ID:** F05
- **Name:** Cross-product UI foundation and interaction acceptance
- **Status:** READY
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime:** MEDIUM
- **Required personas:** HR Admin, Manager in scope, Employee self
- **External dependencies:** UX Foundation v1, representative product routes, browser viewport and i18n
- **Preferred branch name:** `work/acceptance-F05-YYYYMMDD`
- **Fixture isolation strategy:** Read-mostly representative routes; use existing rows and do not perform domain writes
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Representative interactions

Test Search exact/partial/case/no-result/special characters/clear; Filter single/multiple/reset/empty result/query persistence when supported; Sort ascending/descending for dates/names/status; List/Table empty/one/many rows/pagination/selection/detail navigation/back state.

Test tabs, accordions, dialogs, drawers, date pickers, dropdowns, multi-select, save/cancel, focus-visible states, keyboard behavior and accessible names. Test loading, empty, error, validation, disabled, pending and stale/concurrent states.

## Routing and mutation safety

Test back, refresh, deep link, 404, unauthorized route and query parameters. Where a representative safe control mutates state, test double click, repeated submit, refresh after mutation and no duplicate record; otherwise document why the case is read-only.

## Mobile

At 390x844 verify functional usability, no horizontal overflow, no covered controls, usable drawers/dialogs, stable bottom navigation and no clipped tables/forms. Record desktop and mobile evidence and distinguish product layout defects from harness friction.
