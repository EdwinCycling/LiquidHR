# I01 — i18n / localization

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime class:** MEDIUM
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** NL/EN message namespaces, dates, numbers and errors
- **Preferred fixture isolation:** Switch NL/EN across representative routes; verify key parity, no raw keys, pluralization, dates/numbers/currency, validation/errors, RTL-safe layout assumptions and persisted locale.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Switch NL/EN across representative routes; verify key parity, no raw keys, pluralization, dates/numbers/currency, validation/errors, RTL-safe layout assumptions and persisted locale.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
