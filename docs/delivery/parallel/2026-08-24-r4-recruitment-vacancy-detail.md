# R4 Recruitment Vacancy Detail — handoff

## Scope

- Branch: `work/r4-recruitment-vacancy-detail`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-vacancy-detail`
- Baseline: `origin/main` / `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Port: `3143`
- Test prefix: `R4-REC-DETAIL`
- Owned route/component: `/recruitment/vacancies/[vacancyId]`, `RecruitmentVacancyDetail`, direct vacancy detail API/service/tests.

Pipeline- en Candidate-code is niet inhoudelijk gewijzigd. Bestaande Pipeline- en manual-application-componenten blijven alleen via de bestaande permission gates zichtbaar. Er is geen migration, geen remote Supabase-write, geen version bump, geen merge/push en geen externe vacancy-publication uitgevoerd.

## Implementatie

- Vacancy detail gebruikt Foundation `PageShell`, `PageHeader`, `DetailColumns`, `Surface`, `SectionHeader`, `InfoList`, `Badge`, `Button`, `FormDrawer`, `FormField`, `Checkbox`, `DropdownSelect`, `TextInput` en `Textarea`.
- Bewerken bevat de bestaande volledige vacancy-input inclusief de zes vaste secties, gebruikt `vacancyInputSchema`, stuurt `expectedVersion` mee en behandelt `400`, `409 RECRUITMENT_VERSION_CONFLICT` en overige fouten.
- Dirty close vraagt bevestiging; save is guarded tegen saving/double submit; de editor bewaart alleen na succesvolle response en doet daarna router-readback.
- Publication gebruikt exact de bestaande waarden `OPEN`, `CLOSED` en `ARCHIVED`, met bevestiging voor close/archive en reversible reopen. Er zijn geen nieuwe statusnamen of transitions toegevoegd.
- NL en EN houden dezelfde nieuwe labelsleutels; generieke Foundation-files zijn niet uitgebreid.

## Lifecycle- en runtime-evidence

Eigen testvacature via het bestaande create-formulier:

- vacancy id: `81438eab-13b6-4025-aca5-5ba6975b86d0`
- publication id: `c3e11f74-0b2f-422b-9cd1-f2e9204514f1`
- title/slug: `R4-REC-DETAIL-20260824-1735` / `r4-rec-detail-20260824-1735`

| Contractactie | Evidence |
|---|---|
| Create | `POST /api/recruitment/vacancies` → `201 Created` |
| Detail read | vacancy detail page/API read → `200 OK`; response/detail bevatte de zes secties |
| Safe edit | `PATCH /api/recruitment/vacancies/{vacancyId}` → `200 OK`; locatie `R4 Test Location` → `R4 Edited Location`; version `1` → `2` |
| Internal publish | publication `OPEN` → `200 OK`; response `status: OPEN`; detail UI `Actief`/`Open` |
| Reversible transition | `OPEN → CLOSED` → `200 OK`, response `status: CLOSED`, UI `Gesloten`; daarna `CLOSED → OPEN` → `200 OK`, response `status: OPEN` |
| Cleanup | `OPEN → ARCHIVED` → `200 OK`, response `status: ARCHIVED`; detail UI `Gearchiveerd` en publicatie gestopt |

De public-link is niet geopend. Er zijn geen kandidaten, pipeline-mutaties of externe publicaties aangemaakt.

Aanvullend gecontroleerd: invalid min/max hours geeft in de editor `Controleer de ingevulde gegevens.` zonder PATCH; dirty close toont `Wijzigingen negeren?`; een read-only API-context zonder vacatureleesrecht krijgt exact `403`; stale version blijft via het bestaande API-contract `409 RECRUITMENT_VERSION_CONFLICT`.

## Persona- en browseracceptatie

- Test HR Admin: positieve flow op desktop en 390×844; Foundation-detail zichtbaar, edit/publication controls permission-aware, mobile `scrollWidth = 390` bij viewport `390×844`.
- Test Manager: geïsoleerde sessie naar de detailroute eindigde op `/geen-toegang`.
- Test Employee: geïsoleerde sessie naar de detailroute eindigde op `/geen-toegang`.
- HR Admin, Manager en Employee: `0` console-errors; alleen bestaande Next development warnings waren aanwezig.
- Er is geen browser-tooling-blocker opgetreden.

## Verificatie

- Gerichte vacancy/API/service tests: `3` bestanden, `13/13` groen.
- Volledige hr-suite-tests, uitgevoerd vanuit `apps/hr-suite` zodat migration-contracttests hun package-cwd gebruiken: `236` bestanden, `908/908` groen.
- Strict TypeScript: `npx tsc --noEmit --incremental false -p apps/hr-suite/tsconfig.json` groen.
- i18n: `33` namespaces met gelijke NL/EN-sleutels.
- Gerichte ESLint: exit `0`; alleen de bestaande `no-html-link-for-pages` Pages-directory-waarschuwing.
- `git diff --check`: groen.

## Handoff

De fixturevacature staat bewust gearchiveerd als cleanup-eindstatus. De wijzigingen zijn lokaal gecommit; remote release, merge en branch cleanup blijven bij de integrator.
