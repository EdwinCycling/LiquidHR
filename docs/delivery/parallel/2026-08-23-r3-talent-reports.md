# R3 Talent Reports — handoff

Datum: 2026-08-23
Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
Branch: `work/r3-talent-reports`
Worktree: `.codex-worktrees/r3-talent-reports`
Lokale verificatiepoort: `3127`
Status: GREEN voor deze slice; geen push, merge of deploy uitgevoerd.

## Opgeleverd

- Report modes `all`, `goals` en `capabilities` met current/history, statusfilters, datumoverlap en population/scope.
- URL-state, actieve filterweergave, reset, validatie van periodefilters en zero-results state.
- Scanbare employee links, status, progress, validity, type, source, evidence en level.
- CSV-export gebruikt exact de toegepaste schermfilters en scope; bestaande vaste kolommen en exportaudit zijn behouden.
- Report-service laadt in een gekozen modus alleen de benodigde bronquery; de gecombineerde modus voert goals en capabilities sequentieel uit om TEST statement-timeouts door concurrerende RLS-lookups te vermijden.
- Admin (`/settings/talent/reports`), manager (`/workforce/talent/reports`) en self-route (`/my-talent/reports`) zijn op de bestaande reportcontracten aangesloten.
- Alleen report-specifieke NL/EN i18n-sleutels toegevoegd. Geen generieke Foundation, centrale docs of versie gewijzigd.
- Capability DTO bevat employee-id voor geldige drilldownlinks; CSV lekt geen interne ids en neutraliseert spreadsheet-formuleprefixen.

## TEST-auth en backend

- Exacte worktree `.env.local` gebruikt; secrets zijn niet gelogd of opgenomen in deze handoff.
- `npm.cmd run fixtures:talent-auth` uitgevoerd in `apps/hr-suite` met exit 0.
- Anoniem: `GET /api/talent/reports?mode=manager` = `401`; export = `401`.
- HR Admin: report goals/capabilities/all = `200`; export = `200`.
- Manager: manager report = `200`, manager export = `200`, admin report = `403`.
- Employee: workforce-report route eindigt op `/geen-toegang`; manager report = `403`, manager export = `403`, self report = `200`.
- Geen schema- of RLS-wijziging; geen remote migration/apply uitgevoerd.

## Export sanity

HR Admin export met `reportType=goals`, `timeframe=current`, `goalStatus=ACTIVE`, `periodFrom=2026-07-01`, `periodTo=2026-12-31`:

- HTTP `200`
- `Content-Type: text/csv; charset=utf-8`
- vaste header met `record_type`, employee, status, progress, period en capabilityvelden
- 1 data row in de gecontroleerde selectie
- geen interne UUID in de CSV

De UI-exportfoutstate is getest met een opzettelijk afgebroken exportrequest en toonde de report-specifieke foutmelding. De daaropvolgende schone reportpass had `consoleErrors: []`.

## Browsermatrix

| Persona / thema | Scherm | Resultaat |
| --- | --- | --- |
| HR Admin / Liquid Navy | Desktop, report all | goals 8 + capabilities 5; tenantbrede scope; status/progress/validity/source/evidence/level en employee-links zichtbaar |
| HR Admin / Liquid Navy | Filter + refresh | goals/current/ACTIVE + periode toegepast; URL en actieve filtercount zichtbaar |
| HR Admin / Liquid Navy | Zero results | afgesloten periode 2020 toont 0 medewerkers/0 regels, empty state en resetknop |
| HR Admin / Liquid Navy | 390x844 | viewport/document width 390; tabelbreedte blijft intern scrollbaar (`760px`), geen page overflow |
| HR Admin / LinkedHR | Desktop report | `documentElement.dataset.theme = linkedhr`; report rendert met dezelfde data-contracten |
| HR Admin / hersteld | Desktop report | voorkeur teruggezet naar `liquid-navy` |
| Manager | Desktop workforce report | directe managerscope, 2 medewerkers/6 regels; geen tenantbrede scope |
| Employee | Workforce report/API | route geblokkeerd en cross-scope report/export geweigerd; self-report blijft toegestaan |

De clean desktoppass op de reportpagina registreerde 0 relevante console errors. De enige consolefout tijdens de matrix was de verwachte browser `ERR_FAILED` van de expliciet afgebroken exportrequest voor de foutstate.

## Gates

- `npm.cmd run test -- lib/talent/report-schemas.test.ts lib/talent/report-service.test.ts` — 2 files, 9 tests passed.
- `npm.cmd run type-check` — passed.
- `npm.cmd run check:i18n` — passed; 33 NL/EN namespaces gelijk.
- `npm.cmd run lint` — passed; alleen bekende Git LF/CRLF-waarschuwingen.
- `git diff --check` — passed.

## Open / handmatig

- Server op poort 3127 wordt na de lokale commit gestopt.
- Daarna blijft de branch lokaal en clean; push, merge en deploy zijn niet uitgevoerd.
