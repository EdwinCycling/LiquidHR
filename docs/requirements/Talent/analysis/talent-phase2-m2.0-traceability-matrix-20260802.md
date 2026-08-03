# Talent fase 2 — M2.0 traceabilitymatrix

**Status:** CONCEPT — review open  
**Datum:** 2026-08-02  
**Bron:** fase-2-plan en `talent-phase2-m2.0-contracts-and-data-protection-20260802.md`

| ID | M2.0-contract | Artefact/evidence | Test of gate | Status |
|---|---|---|---|---|
| M20-T01 | Eigendom is vóór schema vastgelegd | ADR-0007 §Besluitvoorstel; M2.0 §7 | Twee administraties, één tenantpersoon, shared function en cross-tenant denial | PROPOSED |
| M20-T02 | Access scope staat los van ownership | M2.0 §2-§3 | HR tenantbreed, manager actuele scope, employee self-bound | PROPOSED |
| M20-T03 | Persoonlijke data is geclassificeerd | M2.0 §4 | DTO-field allowlist en private-field negative tests | PROPOSED |
| M20-T04 | Assessmentstatusmachine is expliciet | FDR-0003; M2.0 §5 | gesloten cycle, duplicate submit, lock/reopen/finalize | PROPOSED |
| M20-T05 | Score- en evidencezichtbaarheid is expliciet | FDR-0003 M20-02/M20-03 | drie-rollen response- en evidenceprojecties | OPEN |
| M20-T06 | Herkomst en geldigheid zijn reproduceerbaar | FDR-0003; M2.0 §5 | source immutable, halfopen date range, expiry/archive | PROPOSED |
| M20-T07 | Permissions zijn canoniek en niet rolnaamgebonden | M2.0 §6 | permission catalog/role mapping; no wildcard/self alias | OPEN |
| M20-T08 | Audit blijft één bron | ADR-0007; M2.0 §7.3 | actor/tenant/object/action/time/correlation; sanitized changes | OPEN |
| M20-T09 | Data API en RLS zijn afzonderlijke contracten | M2.0 §8; `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql`; remote grant query | no anon/public grants, RLS per table, using + check | PASS — audit_logs grants hardened; phase-2 tables remain absent |
| M20-T10 | Notifications worden niet impliciet gebouwd | ADR-0007; M2.0 §2 | accepted notification-service decision | OPEN |
| M20-T11 | Schemaontwerp is reviewed vóór M2.1 | M2.0 §7-§8 | reviewrecord and approved migration design | OPEN |
| M20-T12 | Fase-2-scope blijft gescheiden van fase 1 | M2.0 §1; plan §1/§3 | no UI/API/schema phase-2 implementation before gate | PASS — repository scope |

## Open beslissingen

De open beslissingen zijn inhoudelijk verzameld in FDR-0003: M20-01 t/m M20-07. Een open beslissing is geen toestemming om een veilige default stilzwijgend als definitief productgedrag te implementeren.

## Bewijsgrens

De bestaande drie-rollen-gate bewijst fase-1-routes en -readmodels. Zij bewijst niet dat fase-2-persoonlijke records, assessments, evidence, exports of notificaties bestaan of veilig zijn. De nieuwe SQL-proef is daarom een M2.0-baseline en geen M2.1-schema-contract.
