# S01 — Authorization Torture

- **Run ID:** S01
- **Name:** Cross-domain authorization and privacy torture matrix
- **Status:** READY
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee, Act-as Employee
- **External dependencies:** Auth, route/API/RPC surface, RLS, audit/history and all enabled product modules
- **Preferred branch name:** `work/acceptance-S01-YYYYMMDD`
- **Fixture isolation strategy:** Dedicated read/probe identities and safe disposable mutation fixtures; no destructive or irreversible mutation
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Domain matrix

Explicitly cover Employee, Employment, Leave, Absence, Actual Work, Documents, Signing, Journeys, Talent, Survey, Personality, 9-grid, Recruitment, Process Automation, Directory, Settings, AI and Payroll/provider surfaces where present. For each domain test UI, direct route, API ID substitution and RPC/action. Test cross-HR-group and cross-tenant identifiers only when the probe is safe and non-destructive.

## Employee probes

Attempt access to another Employee's data, documents, Leave and Actual Work; Manager endpoints; HR Settings; Talent raw results; Survey results; Personality answers; 9-grid private placement; and foreign mutations. Verify own self-service remains available where contracted.

## Manager probes

Test out-of-team Employee, cross-group Employee, secure fields, HR-only settings, unauthorized workflow actions, foreign documents/signing, private talent/raw assessment data and foreign mutations. Compare Manager-in-scope and Manager-out-of-scope behavior.

## Act-as and HR probes

Act-as cannot sign, change login/security, gain Manager/HR rights or escape the subject identity. HR must remain within tenant/group/administration boundaries where the contract requires them. Test direct ID substitution and session/subject mismatch.

## Denial invariants

Every denial must be HTTP 403 or 404 as appropriate and must prove no data leak, no business mutation, no revision mutation, no false-success audit and no sensitive existence detail. Record before/after counts and audit/event fingerprints for each destructive-risk-free probe. Any unexpected access is `SECURITY_STOP`, not a product workaround.
