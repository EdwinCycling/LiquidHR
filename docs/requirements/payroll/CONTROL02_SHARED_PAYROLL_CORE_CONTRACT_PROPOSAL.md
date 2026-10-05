# CONTROL02 shared Payroll/Core contract proposal

**Status: DRAFT FOR OWNER REVIEW — no shared contract approval recorded.**

This proposal records the minimum decisions required before official Loonaangifte XML may create or update Core Employee, Employment, IncomeRelationship, or Employment–IncomeRelationship records. It does not authorize those writes. Phase 1 remains read-only for official XML; staging and finalization are server-side blocked.

## Concrete proposed decision for Core and Payroll owners

The following defaults are recommended for a joint decision. They are **proposals, not approved contract terms**. The Core owner and Payroll owner must record agreement before any finalization work starts.

| Contract area | Proposed rule | Owner confirmation still required |
|---|---|---|
| Request scope and person identity | Freeze `(tenant_id, hr_group_id, administration_id)` from the authenticated request and normally selected administration. XML fields never choose or widen scope. Match a person only inside that HR group; require exactly one authorized match. Zero or multiple matches block. Keep the server-side tenant HMAC; a client-supplied fingerprint and cross-group fallback are forbidden. | Confirm HR group is the authoritative Employee identity boundary, including how a legitimate person represented in two HR groups is resolved. |
| IKV identity | Treat the source identity as the exact full `LhNr` plus `NumIV`, under the selected tenant and administration. Normalize only the official XML representation (trim XML whitespace; preserve leading zeroes and the `L`); compare the full value to exactly one administration tax-number binding. Do not use the final two characters as a lookup or matching key. Keep all source IKVs separate in staging. | Confirm the full-`LhNr` binding and Core mapping. Current Core uniqueness is `income_relationships_ikv_employee_active_key` on `(tenant_id, employee_id, ikv_number)`; it does not include administration or full `LhNr`. Proposed safe default: treat an existing active same-employee/`NumIV` in another administration or under another binding as a conflict and make no write. If Core/Payroll must support that combination, approve a binding-aware key and durable binding reference before writes. |
| Historical LhNr binding | Resolve the full source `LhNr` to exactly one binding for the selected administration, HR group, and source effective interval. Binding validity is inclusive at both ends, matching current `valid_from`/`valid_until` read behavior. Require one binding to cover each source IKV interval; an absent, ambiguous, or mid-interval binding change blocks that IKV for manual review. Do not resolve historical XML against today's primary binding. | Confirm whether the whole IKV interval must be covered, or whether a narrower statutory reporting-period anchor is sufficient. The recommendation is full interval coverage. |
| Effective dates | Preserve `DatAanv` and inclusive `DatEind` in source staging and Core `income_relationships.starts_on/ends_on` using Core's existing inclusive date model. For a confirmed employment link, convert `[DatAanv, DatEind]` to the half-open `[valid_from, valid_until)` interval by adding one calendar day to a non-null `DatEind`; leave an open source end as `valid_until = null`. Reject invalid dates, reversed ranges, unrepresentable end conversion, and interval overlaps. A reporting tax year never supplies missing employment dates. | Confirm the half-open link rule and the fail-closed behavior for the maximum supported source end date. |
| Employment association | XML does not establish Employment identity. Require a human-confirmed selection of an existing `CONFIRMED` Employment for the matched Employee, tenant, administration, and effective interval. The default is exactly one Employment link per IKV at any instant; sequential Employments may be represented by non-overlapping link intervals. Do not infer from `PersNr`, title, income code, dates, or the most recent Employment, and never create an Employment from XML. | Confirm whether one IKV may be linked to multiple concurrent Employments. The safe default is no; any allowed exception needs an explicit Core/Payroll rule and matching database constraint. |
| Idempotency and corrections | A retry of the same bytes and same authorized scope returns the same staged batch and never duplicates Core rows. Retain the source hash, source period, full LhNr/NumIV provenance, and the parser/schema version used. A different file for an already represented source period is a correction conflict requiring explicit review; it does not overwrite or silently create a second active IKV. | Confirm whether a corrected filing uses an explicit supersedes/correction reference and who may approve it. |

### Required implementation gates after approval

1. Core and Payroll owners approve the rules above and resolve every item in the right-hand column; record the decision in an ADR/FDR with owner names and date.
2. Decide how the full LhNr binding remains referentially provable from a finalized `IncomeRelationship`. If the existing subnumber key cannot uniquely preserve that reference, approve the smallest schema change (recommended: a binding-row reference) before implementation; do not silently rely on suffix truncation.
3. Define the explicit preview confirmation data for Employment links, including which authorized role may confirm it and the behavior for no match, multiple matches, and interval splits.
4. Keep staging-only XML analysis and preview enabled only within its existing safe boundary. Do not enable finalization until all decisions, schema/API/UI changes, owner approvals, and negative authorization tests are complete.

| Contract question | Current evidence | Decision required before Core writes |
|---|---|---|
| Person identity scope | ADR-0003 and current import scope distinguish one Employee per HR group; the ADR also contains tenant-wide BSN identity language. | Confirm the proposed HR-group-only match boundary and treatment of cross-group people. |
| LhNr and IKV identity | Migration `20260810110641_employment_number_ikv_and_probation_rules.sql` replaced the earlier active key with `income_relationships_ikv_employee_active_key` on tenant, employee, and IKV. XML staging retains the full tax number; the current finalization implementation derives a subnumber from its suffix. | Confirm the proposed conflict-on-duplicate behavior or approve a binding-aware schema/key decision; preserve exact full-LhNr provenance. |
| Effective dates | Core `IncomeRelationship` dates are inclusive; Employment–IncomeRelationship links use half-open `[valid_from, valid_until)` periods. | Confirm inclusive source storage and the one-day end conversion for links. |
| Employment association | Employee can have multiple and parallel Employments. An IncomeRelationship is an independent fiscal relationship. The import model has no selected `employmentId`. | Confirm explicit user selection and the proposed one-at-a-time link cardinality. |
| Historical administration identity | Current import authorization resolves the primary LhNr binding at today's date; an XML file can represent an earlier period. | Confirm full source-interval binding coverage or approve another historical resolution rule. |
| Idempotency and recovery | Existing staging keys include file hash, HR scope, administration, and tax year. | Confirm correction/supersedes handling and parser/schema-version provenance. |


## Staging scope invariants — verified gap and local candidate

Read-only inspection of Core TEST found two schema gaps in the existing staging foreign keys:

| Relationship | Existing scope | Required invariant | Candidate repair |
|---|---|---|---|
| `payroll_import_income_relationships.import_person_id` | Tenant + HR group + person; the row's `batch_id` is separately tied to a batch. | The person and income row must share tenant, HR group, and batch. | Reference `(tenant_id, hr_group_id, batch_id, import_person_id)` to the person's unique `(tenant_id, hr_group_id, batch_id, id)` key. |
| `payroll_import_persons.matched_employee_id` | Tenant + employee. | The matched employee must share tenant and HR group. | Reference `(tenant_id, hr_group_id, matched_employee_id)` to employees `(tenant_id, hr_group_id, id)`. |

Current Core TEST readback found zero existing mismatches for either invariant. The forward-only candidate is `20261004150133_control02_payroll_import_scope_invariants.sql` with SHA-256 `94C07DEBF4AC4807C8F77BD8E8A184A4A84E4B269AA87A81B4C203B8DBA9A2C3`. It is not applied. Its static SQL contract test is `20261004150133_control02_payroll_import_scope_invariants.contract.test.ts` (SHA-256 `D614F3975C9EC65E0FC8B5748AC8FF7ECD53BC70AD5EBB7BE421D5290FCA03F7`), 1 file / 3 tests green. Those checks confirm the intended composite-key shape and absence of the old underscoped keys; they do not execute inserts against PostgreSQL. A local Supabase CLI/database was unavailable. Do not apply this candidate to shared Core TEST until the exact hash is approved; then prove same-scope inserts succeed and cross-batch/cross-HR-group inserts fail in an isolated rollbackable runtime and read back catalog/data invariants.

These constraints secure staging references and do not approve finalization. Full-LhNr/NumIV identity, inclusive source periods, HR-group Employee matching, and human-confirmed links to an existing confirmed Employment remain decisions for Core and Payroll owners.

## Safe implementation boundary

- Keep XML bytes and raw BSN out of staging tables, client responses, logs, and evidence.
- Compute any BSN fingerprint server-side with the existing tenant-scoped HMAC contract; never accept a client-supplied fingerprint for official XML.
- Preserve full source LhNr and source effective dates during parse and preview.
- Do not write Core rows, create a default Employment, or link an IKV until every applicable decision above is approved and covered by server-side authorization, uniqueness, retry, and date-boundary tests.
- After approval, record the decision in the appropriate ADR/FDR and make the schema → route → UI changes in that order.

## Approval record

Owner: **PENDING**
Decision date: **PENDING**
Approved contract revision: **PENDING**
