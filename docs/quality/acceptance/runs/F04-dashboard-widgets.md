# F04 — Dashboard / Home / Widgets

- **Run ID:** F04
- **Name:** Dashboard, home, widgets and alerts acceptance
- **Status:** READY
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime:** MEDIUM
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee
- **External dependencies:** Dashboard/widget catalog, alerts, module configuration, API/read models and notification state
- **Preferred branch name:** `work/acceptance-F04-YYYYMMDD`
- **Fixture isolation strategy:** Controlled read-model inputs and one disposable alert/widget preference; restore every changed preference
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Inventory and equality gate

Inventory all enabled HR, Manager and Employee cards/widgets/alerts, their routes, configuration, permissions, data source, API/read model, canonical DB state, list/detail and audit/history where applicable. For each widget assert `UI value == API/read-model value == canonical DB state`.

## Per-widget acceptance

For each card/widget/alert verify authorization, source, value/count, empty state, populated state, loading/error state, click target, refresh, stale behavior, notification/dismissal persistence and mobile layout. Use controlled before → mutation → after only when a widget mutation is in scope, and read back the changed preference/alert state.

## Scope and privacy

Manager data is team scope only. Employee sees safe/self projection only. HR sees intended aggregate scope. Test direct IDs, out-of-scope Manager and Other Employee access; verify no cross-team or cross-tenant count leak. Verify hard refresh/relogin and deep links without stale cards or duplicate alerts.
