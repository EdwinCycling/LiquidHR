# I01 — i18n / Localization

- **Run ID:** I01
- **Name:** Dutch/English localization and formatting parity
- **Status:** READY
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime:** MEDIUM
- **Required personas:** HR Admin, Manager in scope, Employee self
- **External dependencies:** NL/EN message namespaces, locale persistence, date/time/number formatting and representative domain routes
- **Preferred branch name:** `work/acceptance-I01-YYYYMMDD`
- **Fixture isolation strategy:** Read-mostly representative routes; no business writes and no invented Belgium/Germany/RTL scope
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Representative route matrix

Switch NL/EN and inspect HR, Manager, Employee Focus, Settings, Leave, Absence, Actual Work, Documents, Talent and Recruitment. Check raw keys, mixed language, interpolation, pluralization, validation, statuses, notifications, empty states and buttons. Verify locale persistence through refresh and relogin.

## Formatting matrix

Verify dates, date ranges, times, durations, percentages, currency, decimals, thousands separators, week numbers and timezone-sensitive values. Compare UI/API/readback and prove presentation changes do not change canonical persisted values. Test error and audit text as well as success text.

International employee fields are tested only where current implementation exists. Do not invent RTL or additional country scope. Missing parity is recorded as a concrete i18n defect, not hidden with fallback copy.
