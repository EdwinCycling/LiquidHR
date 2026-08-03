# Talent teststrategie

## Actuele update 2026-08-02 — stappen 7 en 8

De read-only Workforce- en self-profielslice is lokaal en remote aanwezig. De managerquery is direct-scope-gebonden; de self-RPC's zijn tenant- en user-bound, gebruiken `search_path=''` en zijn niet beschikbaar voor `anon`. De readmodel-view is `security_invoker=true`. De demo-fixtures zijn inhoudelijk gekoppeld aan actuele testfuncties en de SQL-contractproef `apps/hr-suite/supabase/tests/talent_read_models_completion.sql` is remote geslaagd.

Geautomatiseerd geslaagd in deze run: 112 testbestanden/418 tests, strict typecheck, ESLint, i18n-pariteit (25 namespaces), productiebuild (126 pagina's) en `git diff --check`. De lokale Codex-browser bevestigde met de HR-adminsessie `/settings/talent`, `/workforce/talent`, de tenantbrede actieve profielset, capabilityvereisten en exclusieve accordionstatus. De veilige lege toestand zonder gekoppelde medewerker is in de serverlogica afgedekt.

Open voor formele release-gate: manager- en medewerkerbrowsertests met afzonderlijk geauthenticeerde fixture-sessies en een axe-run die ook `/my-talent` per employee-sessie scant. De repository bevat hiervoor geen wachtwoorden; er is niets geraden of in documentatie vastgelegd. Tot die sessies beschikbaar zijn, wordt de rolmatrix niet als volledig browsermatig bewezen gemarkeerd.

## Actuele update 2026-08-02

De remote testdatabase bevat de uitgebreide idempotente Talent-demo-set en de hardeningmigratie `20260802063946_harden_talent_remote_contracts` is toegepast. De contractproef `apps/hr-suite/supabase/tests/talent_management_foundation_completion.sql` slaagt. De authenticated in-app-browser heeft `/settings/talent` gecontroleerd voor HR Admin; de exclusieve instellingenharmonica werkt. De volledige rolmatrix met afzonderlijke HR Admin-, Manager- en Medewerker-sessies blijft de volgende acceptatiegate.

## Baseline en actuele uitvoering 31 juli 2026

| Exact commando | Exit | Exact resultaat |
|---|---:|---|
| `npm.cmd test --workspace @liquid-hr/hr-suite` | 0 | Vitest 4.1.10: 111/111 testbestanden en 410/410 tests geslaagd. |
| `npm.cmd run type-check --workspace @liquid-hr/hr-suite` | 0 | `tsc --noEmit`; 0 diagnostics. |
| `npm.cmd run lint --workspace @liquid-hr/hr-suite` | 0 | ESLint zonder meldingen. |
| `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` | 0 | 24 namespaces met gelijke NL/EN-sleutels. |
| `npm.cmd run build --workspace @liquid-hr/hr-suite` | 0 | Next.js 16.2.12 productiebuild; 115 routes gegenereerd. |

De afsluitende baseline is volledig groen. Er zijn geen dependencies geïnstalleerd en geen productiecode buiten de in-scope ownership/Talent-wijzigingen aangepast.

## Server- en databasecontrole

- Na iedere migratie/codecheck is `http://127.0.0.1:3000/login` gecontroleerd: HTTP 200.
- De anonieme endpoints `/api/master-data/jobs`, `/api/departments` en `/api/talent` retourneren HTTP 401.
- Supabase remote migration parity eindigt op `20260731150748_add_tenant_fk_covering_indexes`.
- SQL-controles bevestigen: 10 Talent-tabellen, 2 levelmodellen, 8 levels, 6 senioriteiten, 6 Draft-profielen/readmodelrijen, één `LEGAL-DEMO`-administratieafdeling, nul oude job-catalogus-compatibilitykolommen en geen functie met meer dan één groepsrelatie.
- Supabase advisors zijn opnieuw uitgevoerd. Alleen bestaande projectbrede adviezen en de intentionele beveiligde self-profile SECURITY DEFINER-functie blijven zichtbaar.

## Bestaande geautomatiseerde dekking

- `apps/hr-suite/lib/talent/schemas.test.ts` dekt senioriteit-, capability- en profielversievalidatie.
- `apps/hr-suite/lib/master-data/schemas.test.ts` dekt exact één `jobGroupId` en weigert lege of meervoudige groepen.
- De volledige Vitest-baseline dekt bestaande auth-, tenant-, administratie-, job-, employee-, leave-, reminder-, star-performer- en employmentregressies.
- De manager-RLS-scope is database-side vastgelegd in `20260731144246_enforce_talent_manager_read_scope`; de publieke anonieme API-check bewijst alleen de 401-grens, niet een geauthenticeerde managerquery.

## Browserstrategie en uitgevoerde grens

De Codex in-app-browser is met de bestaande sessie gecontroleerd. `/departments` toont de administratie-afdeling `LEGAL-DEMO` in de parentafdelingskeuze. `/workforce/talent` is bereikbaar en toont de seeded levelmodellen en senioriteiten; families, capabilities en actieve profielen tonen een lege staat omdat demo-profielen Draft zijn en het readmodel alleen actieve versies toont. `/settings/talent` redirecteert naar `/geen-toegang`, wat voor deze sessie bevestigt dat managerinzage niet gelijkstaat aan `talent:manage`. De browserconsole bevatte bij die denied Settings-navigatie één Next-dev performancefout (`negative time stamp` voor `TalentSettingsPage`); dit blokkeerde de routebeslissing niet en is geen server/API-failure. Er is geen aparte tenant-admin- of employee-sessie getest; muterende browseracties zijn niet uitgevoerd.

De eerstvolgende concrete verificatie is één geauthenticeerde browser-smoketest met de bestaande demo-accounts: Settings Talent als tenantbeheerder, Workforce Talent als direct manager, `/my-talent` als employee en `/departments` met de `LEGAL-DEMO`-afdeling. De controle moet op desktop en 390x844 worden herhaald.

## Acceptance- en securitymatrix

| Grens | Bewijs in deze run | Resterende geauthenticeerde controle |
|---|---|---|
| Tenant-owned functies/groepen | SQL, migratie, bestaande tests | Browser wisselen van administratie met dezelfde tenantfunctie |
| Administrationele afdeling | SQL-record `LEGAL-DEMO`, departments-API 401 anoniem | Authenticated lijstweergave en scopefilter |
| Talent modulegate | module seed, routes/build, anonieme 401 | Settings/Workforce zichtbaar per rol en modulestatus |
| Manager scope | RLS-policy en servicequery | Manager A ziet eigen directe jobs/profielen en niet die van manager B |
| Self Talent | secure RPC, route/build | Authenticated self-read zonder employee-ID en zonder IDOR |
| Invarianten | migration SQL en 410 Vitest-tests | Geauthenticeerde mutatie/activatieflow |

Geen acceptancebewijs wordt als groen gemarkeerd op basis van alleen UI-verberging of een anonieme request. De oude compatibilitykolommen zijn in de demo-testdatabase verwijderd; volgende domeinen volgen dezelfde schema -> API -> UI-volgorde en dezelfde poort-3000-controle.
