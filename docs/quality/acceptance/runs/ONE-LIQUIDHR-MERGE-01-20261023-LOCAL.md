# ONE-LIQUIDHR-MERGE-01 — gezamenlijke Payroll + PMUX-integratie

Datum: 2026-10-23
Verdict: **LOCAL INTEGRATION CANDIDATE — REMOTE DB / GITHUB / VERCEL HOLD**

## Reikwijdte en provenance

| Bron | Exacte basis | Verwerking |
| --- | --- | --- |
| LiquidHR | `origin/main` `77c9bd548af224c040af788ec7e041494ff8924b` | Exacte candidate-basis; geen `main`-mutatie. |
| Payroll D2 Retail | `work/PAYROLL-D2-RETAIL-20261023`, `fe078514f16042aff5b183286cc8663fdc6ff273`; codecommit `b63cd94d1abc3ecb17b3d4f6f02b1c2abd61b079` | Volledige bedoelde featurecommitlijn geïntegreerd; geen Payroll SQL-migratie of DB-typeswijziging in de diff ten opzichte van de basis. R2 bruto-netto blijft OPEN. |
| PMUX | `work/BRANCH-SPLIT-PMUX-20261021`, `8776c202ba6dbb7d9f16f4b778dd3999964d8bfa` | Volledige bedoelde PMUX-commitlijn inclusief UI, services, API, i18n, configuratie, tests, documentatie en migraties geïntegreerd. |
| PMUX merge | `93bd49988b4cef9a8a1e120f1c411a9171d0c3a9` | PMUX samengevoegd op de gepinde main-basis; conflicten inhoudelijk gereconcilieerd. |
| Payroll merge | `2a1496fcd9e5283d6b0cf8504cb599a7b2938a87` | Payroll D2 op dezelfde gezamenlijke kandidaat samengevoegd; behoudt mergeprovenance. |
| Integratiecorrectie | `9fb83da1` | Whitespace-onafhankelijke PMUX05 helperpatch en regressietests voor Leave/workday/calendar-day SLA. |

Integratiebranch: `work/one-liquidhr-merge-01-20261023`. De bronbranches, bronworktrees en beschermde lokale wijzigingen bleven ongemoeid. Er is geen version bump gedaan; `1.20261023.1` blijft gereserveerd voor het gezamenlijke releasemoment. De bedoelde browseracceptatie volgt na integratie en release op de gedeelde TEST-app en was geen voorwaarde voor deze code-integratie.

## Reconciliatie

- De twee branches deelden vier AA-documenten; de actuele main-/Payroll-context bleef behouden en is aangevuld met de nieuwe gezamenlijke status. Geen document is blind overschreven.
- Nederlandse en Engelse PMUX-vertalingen zijn samengevoegd. Bestaande producttaal “Interne referentie / Internal reference” en diagnostics onder **Geavanceerd** zijn behouden.
- `/payroll/runs`- en gedeelde Payroll-services behielden bestaande scope-/autorisatiesemantiek. Er zijn geen permissies verbreed.
- Integratietest hersteld in `20261022203000_pmux05_form_condition_draft_save.sql`: whitespace-onafhankelijke `regexp_replace`-patches voor de bestaande helperfuncties; de expliciete fail-closed guards bij ontbrekende patches zijn behouden.
- De Leave-contracttest bewaart de bestaande `leave-request`-seed en assert beide SLA's exact als `2 DAYS`, `businessDays: true`, `onBreach: NOTIFY`. Zonder vastgestelde proceskalender faalt compilatie met `SLA_WORKDAY_CALENDAR_REQUIRED`. Een aparte regressie bewijst dat een calendar-day SLA geldig blijft. Geen werkdagconversie en geen versoepeling van validatie.

## Database- en migratiegate

Dit is één gedeelde LiquidHR TEST-applicatie; er is geen aparte klantproductie-app. Supabase-project `wnpfloqpjvaacobppbpk` is read-only geïnspecteerd. Geen remote schemawijziging, migratie, businessdata-write of scheduleractivatie is uitgevoerd.

TEST-history bevat PMUX 03A al exact eenmaal. De acht nog ontbrekende migraties staan in de kandidaat in deze volgorde:

1. `20261021160000_pmux03b_process_work_experience.sql`
2. `20261022203000_pmux05_form_condition_draft_save.sql`
3. `20261023054930_pmux05_step_participant_field_access.sql`
4. `20261023072351_pmux06a_materialize_process_sla_deadlines.sql`
5. `20261023083349_pmux06b_process_reminders_escalations.sql`
6. `20261023104819_pmux06b1_process_reminder_system_scheduler.sql`
7. `20261023112158_pmux06c_process_operations_workspace.sql`
8. `20261023131000_pmux07a_process_insights.sql`

Geen van deze acht is op de gedeelde TEST-database toegepast. PMUX 03A is niet opnieuw afgespeeld. Payroll D2 bevat geen nieuwe migratie; de bestaande Payroll-schemahistorie blijft intact.

**Afhankelijkheden / safety:** de volgorde volgt process-runtime → form save → stap-/deelnemerveldrechten → SLA-deadlines en HR-groeptijdzone → reminderqueue → service-role scheduler-wrapper → Operations → read-only Insights. Lokale contracttests controleren RLS, cross-tenant-/actorgrenzen en schedulergrants. Statische SQL-review vond geen `DELETE`/`TRUNCATE`-datadrops en geen geconstateerde privilegeverbreding. De schedulerwrapper blijft beperkt tot `service_role`; interne helpers blijven ingetrokken voor gebruikersrollen. De acht migraties zijn afzonderlijk getest, maar een volledige schone PGlite-replay als één keten is niet bewezen.

**Verplichte externe DB-gates zijn OPEN:**

- Geen ondersteunde export met bewezen herstel is beschikbaar gesteld of getest; projectmetadata alleen bewijst geen restorebare backup.
- `hr_groups.time_zone` bestaat nog niet. Geen canonieke HR-tijdzone is bevestigd voor de vijf groepen: Hoofdadministratie, Planeten, Stap 6 testgroep meerdere autorisaties, TEST (leeg) en Noorderlicht Zorggroep. De 06A-migratie bevat een Europe/Amsterdam-default; voer haar pas uit nadat de eigenaar de vijf bedoelde IANA-zones heeft bevestigd en de waarden/restoreroute veilig zijn voorbereid.
- Expliciete vrijgave voor de gedeelde TEST-database ontbreekt.

De werkdagkalender is een afzonderlijke OPEN productafhankelijkheid: alleen een recipe-stap met `businessDays: true` faalt gesloten zonder een expliciete proceskalender. Dit blokkeert niet algemeen calendar-day SLA-recepten. De bestaande Leave-recipe wordt niet gewijzigd en niet geactiveerd.

## Technische verificatie

| Gate | Resultaat |
| --- | --- |
| Gerichte PMUX-migratie-, autorisatie-, SLA- en schedulercontracten | 10 bestanden / 74 tests PASS, inclusief behoud van Leave en calendar-day geldigheid; geen volledige ordered-chain replay. |
| HR Suite volledige testsuite | 741 bestanden PASS, 4 SKIP; 3.651 tests PASS, 8 SKIP, 0 FAIL. Lokale TEMP/TMP/TMPDIR en 2 workers gebruikt vanwege Windows-temp-EPERM. |
| Control / Payroll-workspaces | Control: 2 bestanden / 11 tests PASS. NL Payroll-regels: 6 bestanden / 49 tests PASS. Payroll-engine + CAO-BENCH02 directe package-tests: 5 bestanden / 63 tests PASS. |
| TypeScript | Root workspace type-check PASS voor HR Suite, Control, Payroll-engine, CAO-BENCH02 en NL-regels. |
| Lint / i18n | Lint PASS, 0 errors / 8 bestaande warnings. i18n PASS: 43 gelijke NL/EN-namespaces. |
| Productiebuilds | Eerste sandboxrun faalde op Windows-junction/Next `.next`-EPERM. Op exacte code-SHA `9fb83da1830ba2eb867973d06b062b7140fac86e`: HR Suite 339/339 statische pagina's en Control 12/12 gebouwd; client-boundary negative control, 175 browser-assets en PDF-renderer trace allowlist PASS. |
| Dependency audit | `npm audit --omit=dev`: 0 kwetsbaarheden. Volledige `npm audit`: 6 advisories in ontwikkel-/testdependencyboom (2 moderate, 4 high; Vitest, brace-expansion, browserslist, js-yaml en Vite); geen `npm audit fix` uitgevoerd. |
| `git diff --check` | `git -c core.whitespace=cr-at-eol diff --check`: PASS; gewijzigde bestaande documentatie gebruikt CRLF. |

Builds en tests wijzigen niets aan Supabase- of Vercel-runtime. Framework-generated `apps/hr-suite/next-env.d.ts` bleef op SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`; de build-only gegenereerde Focus-widgetdiff is teruggezet.

## Release- en acceptatiegrenzen

- Huidige READY-deployment blijft op de bestaande gedeelde TEST-aliases en bestaande versie; geen deployment of aliaswijziging.
- Vercel-project staat op Hobby. De PMUX cron `* * * * *` valt buiten de ondersteunde Hobby-frequentie; actuele [Vercel Cron-limieten](https://vercel.com/docs/cron-jobs/usage-and-pricing) vereisen voor deze frequentie Pro of Enterprise.
- Effectieve Git/Preview-triggerconfiguratie is niet onafhankelijk bevestigd. AA-REL vereist dit bewijs vóór push; daarom geen GitHub-push, PR of merge naar `main`.
- Na het sluiten van DB-/scheduler-/releasegates volgt één gezamenlijke TEST-release en daarna browseracceptatie met bestaande toegestane identiteiten. Geen echte salarismutaties, betalingen of aangiften.
- Open Payroll-bronvragen, waaronder R2 bruto-netto en echte werkgever-/pensioentoepasselijkheid, blijven apart OPEN.
