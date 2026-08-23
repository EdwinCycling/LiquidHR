# R3 Talent Overview — handoff

Datum: 2026-08-23  
Branch: `work/r3-talent-overview`  
Worktree: `.codex-worktrees/r3-talent-overview`  
Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`  
Lokale poort: `3121`

## Opgeleverd

- Workforce Talent gebruikt een Foundation-gebaseerde master-detail workspace met profielzoeking, medewerkerselectie, medewerkerscontext en URL-state via `?profile=`.
- Actieve functieprofielen tonen hun medewerkerscontext naast de bestaande read-only profielinhoud en capability requirements.
- Capabilityrecords tonen type, recordstatus, evidence-status, bron en geldigheid scanbaar; managers blijven read-only en kunnen op medewerker filteren.
- Talentmeldingen hebben loading/error/empty states, statusbadges, retry, pending-state en bestaande Talent-drilldowns voor goals, assessments, role explorer en reports.
- De route heeft een afzonderlijke loading state en behoudt de zes bestaande Talent-navigatielinks.
- Nieuwe i18n is beperkt tot de nested `overview`-keys in NL/EN; bestaande talent-translation files zijn niet geherformatteerd of gesorteerd.

## Scope en grenzen

- Gewijzigd: Workforce Talent route, `TalentWorkforceViewer`, `TalentEmployeeCapabilityRecords`, `TalentNotificationPanel`, directe workforce Talent-service/query, directe overview-utils/tests, route-specifieke Talent-i18n.
- Niet gewijzigd: Assessments, Comparison, Goals, Role Explorer, Team, Reports, `components/ui`, generic patterns/layouts, package/version, centrale delivery-documenten.
- Geen schema/RLS-migratie nodig; geen remote Supabase-write uitgevoerd.
- FOUNDATION_GAP: geen. Bestaande Foundation-primitives zijn hergebruikt.

## Verificatie

- Canonical TEST env: bron en doel met `Test-Path=True` gecontroleerd; inhoud/secrets niet gelogd of gecommit.
- `npm.cmd run fixtures:talent-auth`: exit 0; uitsluitend de drie canonical TEST-fixtures HR Admin, Manager en Employee bijgewerkt.
- Gerichte overview-tests: 3/3 groen.
- Volledige testsuite: 220 testbestanden, 860 tests groen.
- Strict TypeScript: groen.
- Gerichte ESLint: groen.
- i18n: 33 namespaces met gelijke NL/EN-sleutels.
- `git diff --check`: groen.
- Productiebuild: `npm.cmd exec -- next build --webpack` groen; 224 statische pagina’s gegenereerd. De standaard Turbopack-build faalde vóór compilatie door worktree-resolutie van `next/package.json`; Webpack is de voorgeschreven worktree-buildroute.

## Authenticated TEST browser/API evidence

De afgeronde runs gebruikten alleen de canonical TEST-fixtures; geen credentials of tokens zijn vastgelegd.

- HR Admin: `/workforce/talent` HTTP 200 op 1440×900 en 390×844, Default (`liquid-navy`) en LinkedHR; notifications en capability-records HTTP 200; overview zichtbaar; geen horizontale overflow; 0 console errors.
- Manager: `/workforce/talent` HTTP 200 op 1440×900 en 390×844; read-only hint, medewerkerfilter en echte fixture-search zichtbaar; notifications en capability-records HTTP 200; geen horizontale overflow; 0 console errors.
- Employee: `/workforce/talent` eindigt op `/geen-toegang`; notifications HTTP 200, capability-records HTTP 403; 1440×900 en 390×844 zonder horizontale overflow; 0 console errors. De 403 is via Playwright HTTP-context vastgesteld zodat de verwachte negative check de browserconsole niet vervuilt.

De actuele Manager-fixture heeft geen actieve workforce-profielen in de directe managerscope. Daardoor bleef de profielcollectie leeg en was profiel-URL-state voor Manager niet interactief te bewijzen; de capabilityrecords-positieve route en permission boundary zijn wel bewezen. Dit is bestaande TEST-scope/data, niet door deze slice aangepast.

Een latere sequentiële browserretry na een schone serverrestart liep vóór persona-evidence tegen de 30-seconden login-wachttijd aan door dev-servercompilatie. Die retry is niet als positieve evidence gebruikt; de hierboven vermelde afgeronde runs zijn de geldige evidence.

## Cleanup en handoff

- Lokale devserver op poort 3121 gestopt.
- Browsercontexten gesloten; TEST-env blijft ignored en is niet in Git opgenomen.
- Geen push, merge of deploy uitgevoerd.
- Volgende stap: Manager-TEST-fixture met actieve workforce-profielen beschikbaar maken via de bestaande testdata-governance, daarna alleen de profielselector/URL-state opnieuw browser-verifiëren.
