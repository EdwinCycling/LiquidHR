# LiquidHR Salarisstructuren — Implementation Plan (2 hoofdonderdelen)

> **Voor agentic workers:** voer deze feature uit op één featurebranch en één worktree. Stap 2 is een continuation van Stap 1 en mag de architectuur uit Stap 1 niet opnieuw ontwerpen.

**Goal:** Bouw de definitieve HR-groepbrede Salarisstructuren-architectuur met named structures, revisions, schaal+tredes, salarisbanden en CAO-koppelingen, en lever daarna de complete HR Admin UX SS-001 t/m SS-011 met volledige security/browser-verificatie.

**Lees- en bronvolgorde**
1. `docs/requirements/salary-structures/SALARY_STRUCTURES_PRODUCT_REQUIREMENTS.md` — normatieve productbron
2. `docs/requirements/salary-structures/SALARY_STRUCTURES_UX_REFERENCE.md` — normatieve UX-/flowbron
3. `docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET-README.md`
4. `docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET.json`
5. dit implementatieplan
6. definitieve Stitch SS-001 t/m SS-011 — uitsluitend visuele compositiereferentie

Bij conflict geldt exact bovenstaande volgorde. Stitch introduceert nooit productlogica, securityregels of nieuwe scope.

## Testfase-regel

Dit project zit in dev/test. Bestaande schaal-, trede-, revisie- en gerelateerde testdata mag gecontroleerd verwijderd, gewijzigd of opnieuw opgebouwd worden. Kies een schone eindarchitectuur boven ingewikkelde backwards-compatible migratie van disposable testdata.

Harde randvoorwaarden:
- bewijs vóór destructieve writes dat Supabase dev/test is;
- geen production-data behandelen als disposable;
- laat geen orphaned `employment_salaries` of kapotte salaryflows achter;
- `MANUAL`, `MINIMUM_WAGE`, `CUSTOM_SCALE`, `NO_PAYROLL` blijven coherent;
- `CAO_SCALE` krijgt geen nieuwe semantiek zonder expliciet productbesluit;
- geen salarisbandtoekenning aan medewerkers in deze feature;
- geen automatische tredeprogressie;
- geen import/export, PDF/AI-import, Insights, Salarisronde, merit matrix, marktbenchmark of payrollverwerking.

---

# Hoofdonderdeel 1 — Sol
## Architecture, Existing Scale/Step Rebuild & Canonical Test Dataset

### Doel

Leg de definitieve salarisstructuurarchitectuur neer, breng de bestaande administratiegebonden schaal/tredes naar het nieuwe HR-groepbrede model, voeg salarisbanden en CAO-relatiefundering toe, en bewijs de architectuur met de volledige canonieke testdataset.

### Verplicht inspecteren vóór wijzigingen

- `apps/hr-suite/components/master-data/salary-scale-manager.tsx`
- `apps/hr-suite/supabase/migrations/20260718100000_add_job_catalog_salary_revisions.sql`
- actuele `salary_scales`, revision- en step-tabellen/migrations/RLS;
- `employment_salaries`, inclusief `salary_scale_step_id`;
- employee/employment wizard voor `MANUAL`, `MINIMUM_WAGE`, `CUSTOM_SCALE`, `CAO_SCALE`;
- `salary-structure:write`, `salary:write`, actuele grants;
- bestaande CAO-tabellen/services/RLS;
- audit- en HR-group master-data patterns;
- huidige `/master-data/salary-scales` route/scherm.

### Te realiseren domein

1. **Named salary structure** als HR-groepbrede aggregate root.
2. Meerdere structuren per HR-groep.
3. Vast type:
   - `SCALE_WITH_STEPS`
   - `SALARY_BAND`
4. Meerdere revisions per structuur.
5. Eén `effective_from` per complete revision.
6. Draft mutable, published immutable.
7. Geen overlappende gepubliceerde revisions van dezelfde structuur.
8. Stabiele logical identity van schaal/band over revisions.
9. Schaal+tredes:
   - variabele tredes;
   - vrije labels;
   - expliciete sort order;
   - exact salarisbedrag;
   - optionele tijd-tot-volgende-trede metadata;
   - geen automatische progression.
10. Salarisbanden:
    - min / midpoint 100% / max;
    - open maximum alleen hoogste band;
    - decimal-safe calculations.
11. CAO ↔ logical salary structure many-to-many binnen dezelfde HR-groep.
12. Audit, RLS, server-side permissions.

### Centrale formules

```text
range_spread =
(maximum - minimum) / minimum * 100

minimum bij midpoint + spread =
midpoint / (1 + spread / 2)

maximum bij midpoint + spread =
minimum * (1 + spread)

midpoint bij minimum + maximum =
(minimum + maximum) / 2

midpoint_progression =
(midpoint huidig - midpoint vorig) / midpoint vorig * 100

overlap =
(maximum vorige band - minimum huidige band)
/
(maximum vorige band - minimum vorige band)
* 100
```

Negatieve overlap wordt voor presentatie `0% overlap`; gap mag als aparte informatieve metric worden afgeleid. Overlap is geen publish blocker.

### Bestaande schaal/tredes: expliciete herbouwregel

De huidige administratie-owned schaal/tredes worden **niet** als parallel legacy-domein behouden.

Codex kiest na inspectie de schoonste eindarchitectuur. Omdat testdata disposable is, mag het:
- oude testschalen/treden/revisions verwijderen;
- test `employment_salaries` die uitsluitend naar disposable oude steps verwijzen opnieuw opbouwen;
- noodzakelijke foreign keys/queries aanpassen.

Maar:
- runtime salaryflows blijven coherent;
- `CUSTOM_SCALE` krijgt een regression test;
- `MANUAL`, `MINIMUM_WAGE`, `NO_PAYROLL` krijgen regressiechecks;
- referential integrity is na afloop groen.

### Canonieke testdataset

Plaats het aangeleverde bestand in de repo als:

`docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET.json`

en de toelichting als:

`docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET-README.md`

De JSON is **canoniek**. SQL seeds/factories mogen daarvan worden afgeleid, maar verwachte bedragen of metrics mogen niet stilzwijgend worden gewijzigd om tests groen te maken.

De dataset bevat onder meer:
- volledige publieke CAO Rijk tabel per 01-07-2026: 18 schalen × 11 tredes = 198 bedragen;
- synthetische toekomstige Rijk revision;
- schaal met maar 2 tredes;
- vrije labels `Aanloop`, `A1`, `A2`, `0`, `1`, `Eind`;
- meerdere named scale/step structures;
- drie verschillende bandstructuren;
- midpoint+spread, min+max en manual anchors;
- open hoogste band;
- vooraf berekende expected spread/progression/overlap/gap;
- CAO met 0, 1 en meerdere gekoppelde structuren;
- regression cases voor `CUSTOM_SCALE`, `MANUAL`, `MINIMUM_WAGE`, `NO_PAYROLL`;
- migratieconflict met dezelfde legacy schaalcode uit twee administraties.

### Teststrategie Stap 1

Schrijf tests vóór of tegelijk met implementatie voor minimaal:
- HR-group isolation;
- named structures;
- immutable published revisions;
- effective revision overlap;
- band formulas en decimal precision;
- open highest band;
- scale/step uniqueness en explicit ordering;
- free step labels;
- two-step scale geldig;
- CAO same-HR-group relation;
- cross-HR-group CAO relation verboden;
- `CUSTOM_SCALE` verwacht voor testdataset: schaal 8 / trede 5 = €3.741,48;
- dataset counts/expected metrics;
- referential integrity na destructieve dev/test cleanup.

### Stap 1 handoff

Werk `docs/delivery/CURRENT_CONTEXT.md` bij met:
- branch/worktree/HEAD/base commit;
- Supabase dev/test identity;
- migrations;
- schema/FK’s;
- RLS/permissions;
- calculations;
- gekozen legacy-compatibilityroute;
- testdataset seedstatus;
- tests/advisors;
- fixtures;
- blockers.

Neem letterlijk op:

**DO NOT recreate previous-step architecture.**

Geen push, merge, deploy, PR of version bump.

---

# Hoofdonderdeel 2 — Luna High
## Complete HR Admin Experience, CAO UX, Migration UX & Full Verification

### Doel

Bouw op de architectuur uit Stap 1 de volledige definitieve UX SS-001 t/m SS-011 en sluit de feature af met browser-, security-, responsive-, i18n- en remote databasebewijs.

**DO NOT recreate Step 1 architecture.**

### UX scope

- SS-001 Salarisstructuren catalogus met meerdere named structures.
- SS-002 structure detail + revisions.
- SS-003 midpoint + spread band editor.
- SS-004 alternatieve invoermethoden.
- SS-005 publish review, blockers vs warnings.
- SS-006 immutable revision history.
- SS-007 schaal/tredestructuur detail.
- SS-008 step editor met vrije labels en progressionmetadata.
- SS-009 scale/step publish review.
- SS-010 migratieconflict UX.
- SS-011 CAO → geldige salarisstructuren.
- bestaande `/master-data/salary-scales` ingang normaliseren naar de bredere productbetekenis.

### Gebruik de canonical dataset ook als browserdata

Dezelfde `TEST-SALARY-STRUCTURES-DATASET.json` moet de browser-/manual-verificatie voeden, zodat tijdens review direct zichtbaar is of:
- alle 18 Rijk-schalen passen;
- grote step-tabellen bruikbaar blijven;
- een 2-step scale niet onterecht wordt geweigerd;
- open topband correct rendert;
- multiple structures/revisions overzichtelijk zijn;
- 0/1/meerdere CAO-koppelingen begrijpelijk zijn;
- expected spread/progression/overlap overeenkomen met UI.

De UI mag de fixture niet als runtime dependency nodig hebben; dit is uitsluitend dev/test seeddata.

### Full verification gate

Minimaal:
- HR Admin/Tenant Admin positief;
- manager/employee onbevoegd negatief;
- geen salary leakage in HTML/JSON/network;
- tenant/HR-group cross-access negatief;
- desktop;
- 390×844;
- keyboard/focus/reorder/dialog/drawer;
- NL/EN volgens bestaand i18n-patroon;
- console/network errors;
- published read-only;
- dirty-state protection;
- warnings blokkeren publiceren niet;
- blockers blokkeren wel;
- remote migrations en referential integrity;
- Supabase advisors;
- canonical dataset assertions opnieuw groen.

### Status

Gebruik alleen:
- `GREEN`
- `IMPLEMENTATION COMPLETE — RELEASE GATE BLOCKED`
- `BLOCKED`

Geen version bump, `finish-feature.ps1`, push, merge, deploy of PR zonder expliciete opdracht.

---

# Ready-to-paste Codex prompt — Stap 1 / Sol

Je werkt aan **LiquidHR Salarisstructuren — Stap 1: Architecture, Existing Scale/Step Rebuild & Canonical Test Dataset**.

Dit is Stap 1 van één featurebranch/worktree. Stap 2 bouwt hier rechtstreeks op voort. Maak na deze stap geen nieuwe branch/worktree. Geen push, merge, deploy, PR of version bump.

Lees eerst:
1. `docs/requirements/salary-structures/SALARY_STRUCTURES_PRODUCT_REQUIREMENTS.md`
2. `docs/requirements/salary-structures/SALARY_STRUCTURES_UX_REFERENCE.md`
3. `docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET.json`
4. `docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET-README.md`

Inspecteer vóór wijzigingen de bestaande scale/step implementatie, `employment_salaries`, wizard salary source types, permissions, CAO-domein, audit/RLS en `/master-data/salary-scales`.

We zitten in dev/test. Bestaande schaal-/trede-/revision-testdata en disposable employment salary fixtures mogen worden verwijderd of opnieuw opgebouwd wanneer dat een schonere eindarchitectuur oplevert. Controleer vóór iedere destructieve write read-only dat Supabase daadwerkelijk dev/test is. Laat geen orphaned references of kapotte `CUSTOM_SCALE`, `MANUAL`, `MINIMUM_WAGE`, `NO_PAYROLL` flows achter.

Bouw de definitieve HR-groepbrede named salary structure → revisions architectuur met `SCALE_WITH_STEPS` en `SALARY_BAND`, centrale decimal-safe calculations, immutable published revisions, CAO ↔ logical structure relation, audit/RLS/permissions en herbouw de huidige administratiegebonden scale/step architectuur naar dit model.

Seed/vertaal daarna de canonical JSON naar bestaande testpatterns. De JSON blijft de bron van waarheid. Bewijs alle expected counts, salary values en expected bandmetrics met tests. Een mismatch is een fout om te onderzoeken, niet een reden om de fixture stilzwijgend aan te passen.

Belangrijk regressionvoorbeeld uit de dataset:
`CAO Rijk salarisschalen` → revision 2026-07-01 → schaal 8 → trede 5 → verwacht €3.741,48 bruto per maand fulltime.

Bouw nog géén employee salary-band assignment, Insights, Salarisronde, automatische progression of import/export.

Werk aan het einde `docs/delivery/CURRENT_CONTEXT.md` volledig bij en neem letterlijk op:
**DO NOT recreate previous-step architecture.**
