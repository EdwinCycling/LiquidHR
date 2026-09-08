# Payroll P0/P1 evidence ledger

Status: **PAYROLL P0 DEVELOPMENT ACCEPTANCE: GREEN** op DEV/TEST. Branch `work/payroll-p0-p1`, gebaseerd op main `4adcedaf7d4a227df6ee91a03e5e5741992fbd40`. P1 blijft bewust buiten scope.

De goedgekeurde productbaseline staat in [`LIQUIDHR_PAYROLL_INTEGRATION_BLUEPRINT_V0.3.md`](../requirements/payroll/LIQUIDHR_PAYROLL_INTEGRATION_BLUEPRINT_V0.3.md). De geplakte opdracht is de uitvoeringsinstructie: eerst P0-foundation, daarna P1-verbinding en administratiebinding, met Luna-implementatie en Astra-reviewgates.

## Vastgelegde besluiten

- `PAYROLL` is een schakelbare module volgens het bestaande modulecatalogus-/servicepatroon.
- De bestaande effectieve mapping van `TENANT_ADMIN` en `HR_ADMIN` vormt de beheergrens; er komt geen nieuwe rolfamilie.
- Payroll-audit gebruikt een eigen append-only auditoppervlak volgens het strengere DG-patroon; credentials en tokens komen nooit in auditpayloads.
- P0 doet geen externe Nmbrs-call. P1 mag Nmbrs pas aanroepen na verificatie van wire-contract en serveromgeving.

## Preflight en baseline

- Main/worktree-baseline: volledige SHA `4adcedaf7d4a227df6ee91a03e5e5741992fbd40` (werkboombranch `work/payroll-p0-p1`).
- Root `apps/hr-suite/next-env.d.ts` bleef ongewijzigd; bekende dirty hash: `ce4e94a6b10f160ee021fe18939af160d2927dcf`.
- DEV/test-Supabaseproject: `wnpfloqpjvaacobppbpk`; de geautoriseerde Payroll-migration is toegepast. Remote history registreert `payroll_p0_foundation` als `20260908181859` en de aansluitende FK-indexmigration als `20260908184235`; de lokale bestandsnamen blijven `20260908115903_payroll_p0_foundation.sql` en `20260908184201_payroll_p0_fk_indexes.sql`.
- De genegeerde canonical `.env.local` is pas na controle van de ignore-regel naar de worktree gekopieerd. Waarden zijn nooit geprint of geëxposeerd; de canonical file bleef ongewijzigd.
- Root dependencies zijn gewone directories; de `node_modules`-junctions in de worktrees verwijzen naar bestaande rootdirectories. Gedeelde dependencies zijn niet gewijzigd.
- DEV-fixture, via Astra SQL geverifieerd: tenant `07249eb9-545c-883b-b26b-d52f83b4f4a1`; HR-groep `80975e8a-b0dd-4552-be20-cd3944da9b2b`, code `TEST-BOUNDARY`, naam `TEST (leeg)`; administratie `0ad929be-8dbf-4b8f-884e-46852f182512`, naam `Test BV`; `0` employees en `0` employments.

## Baselinecontrole vóór Payroll-wijzigingen

`npm.cmd test --workspace @liquid-hr/hr-suite -- --reporter=dot` op baseline `4adcedaf7d4a227df6ee91a03e5e5741992fbd40`: 356/357 testbestanden en 1377/1378 tests geslaagd in 21,86 seconden. De enige fout was `supabase/migrations/document_studio_dm1_native_template_editor.contract.test.ts:79`, omdat de test een LF-CASE-substring verwachtte terwijl deze checkout CRLF bevat. Dit is bewezen bestaande, niet-gerelateerde baseline-debt en wordt niet door Payroll aangepast. De Payroll-bestanden waren tijdens deze controle nog niet gewijzigd; `git diff` was daarvoor leeg.

## Orchestratiemetrics

- Luna Low-jobs: 4.
- Luna High-jobs: 1.
- Luna Medium/XHigh/Max: 0.
- Astra-implementatie: 0; Astra-review/orchestratie: apart van deze metrics.
- Mislukte workerpogingen: 1 (de eerdere completionrapportage was onjuist). Escalaties: 0.
- Shell- en toolorchestratie telt niet als workerjob.

## Lokale P0-implementatie

- Modulecatalogus, `PAYROLL`-toggle, hoofdnav en vier routes (`/payroll`, `/payroll/employees`, `/payroll/differences`, `/payroll/settings`) zijn toegevoegd met server-side `payroll:read` plus actieve modulecontrole.
- Provider-neutrale contracttypes, Nmbrs adapter-skeleton en read-only API-boundaries (`/api/payroll`, `/api/payroll/providers`, `/api/payroll/connections`, `/api/payroll/company-bindings`, `/api/payroll/sync-runs`) zijn toegevoegd. De Nmbrs skeleton maakt in P0 geen netwerkcall.
- De lokale migration contracttest en modules/provider-tests zijn groen (7/7); strict TypeScript, ESLint, i18n, `git diff --check` en Webpack production build zijn groen. De build compileerde en genereerde `267/267` pagina's/routes. Turbopack blijft in deze symlink-worktree geblokkeerd door de bekende `node_modules`-rootbeperking.
- Officiële Supabase typegeneratie is uitgevoerd en toegepast in `packages/db/types.ts`; de bestaande lokale compatibiliteitsdefinitie voor `company_activities` is behouden omdat die tabel niet in deze remote introspectie voorkomt.
- Remote schema-readback, RLS/grants, advisors en authenticated browser/persona-acceptance zijn GREEN. De standaard Turbopack-route bleef door de bekende worktree-symlinkbeperking buiten gebruik; de Webpack production build is GREEN.

## Remote DEV readback

- De acht Payroll-tabellen zijn aanwezig: `payroll_providers`, `payroll_connections`, `payroll_company_bindings`, `payroll_sync_runs`, `payroll_sync_items`, `payroll_sync_issues`, `payroll_audit_events` en `payroll_private.payroll_connection_credentials`. Alle acht hebben RLS aan.
- PK's, scope-FK's, state/check-constraints, unieke scope/provider/admin-indexen en de elf ontbrekende FK-indexen uit de eerste advisor-run zijn gecontroleerd. De aanvullende migration `20260908184201_payroll_p0_fk_indexes.sql` is toegepast; de eindreadback bevat 35 Payroll-indexen.
- Policies zijn aanwezig voor de exposed Payroll-tabellen en vereisen actieve tenant/HR-group toegang plus `payroll:read` voor lezen en `payroll:manage` voor beheerwrites. `payroll_private.payroll_connection_credentials` heeft bewust geen exposed policy of `authenticated` grant; alleen `service_role` heeft daar table grants.
- `internal_security.prevent_payroll_audit_mutation()` en `internal_security.prevent_payroll_scope_change()` zijn gecontroleerd. De audit-tabel heeft een trigger die `UPDATE`/`DELETE` blokkeert; alle scoped Payroll-tabellen hebben scope-immutability-triggers.
- Remote tellingen na apply: provider `NMBRS` = `1`; connections, bindings, sync-runs, sync-items, sync-issues, audit-events en private credentials = `0`. De normale HR Admin-moduleconfiguratie bevat `PAYROLL=true` voor tenant `07249eb9-545c-883b-b26b-d52f83b4f4a1`.
- De fixture-readback bleef onveranderd: tenant `07249eb9-545c-883b-b26b-d52f83b4f4a1` / HR-group `80975e8a-b0dd-4552-be20-cd3944da9b2b` heeft `0` employees en `0` employments. De globale controle bleef `89` employees en `88` employments.

## Security- en gedragspoorten

- RLS-session probes met HR Admin, Manager en Employee gaven respectievelijk Payroll-providerzicht `1`, `0`, `0`; de Manager- en Employee-managementroutes eindigden server-side op `/geen-toegang`. De Employee-fixture heeft geen tenant membership, waardoor een in-tenant Employee-denial niet los van die fixturebeperking kan worden bewezen.
- `/api/payroll` gaf voor HR Admin HTTP `200` met uitsluitend `providers`, `connections`, `bindings`, `syncRuns` en `activeConnection`; credential-velden/woorden kwamen niet voor. Browsercontrole op alle vier Payroll-routes vond geen access/refresh token, client secret, authorization code of password.
- De provider skeleton bevat in P0 geen fetch- of andere Nmbrs-networkcall. De browser request-scan over de vier routes rapporteerde `nmbrsRequests=[]`.
- Auditfoundation is append-only en bevat geen credentials/tokens. Er zijn geen employee/employment-rows gemuteerd en er zijn geen Payroll-writeflows of externe provider-calls uitgevoerd.

## Bewijsgates

| Gate | Vereist bewijs | Status |
| --- | --- | --- |
| P0 permissions/RLS | server checks, HR-admin positive, Manager/Employee denial, scoped policies | GREEN |
| P0 module/UI | catalog state, four views, no external call, i18n and route checks | GREEN |
| P0 audit | append-only payroll events, no secrets, persisted readback | GREEN |
| P1 Nmbrs | official endpoints/scopes/headers, server env, connection and health-check readback | open |
| P1 binding | company discovery, administration binding, disconnect/reconnect, audit and negative scope checks | open |

## Browser/persona acceptance

- Authenticatiemethode HR Admin: geldige directe wachtwoordlogin met `hradmin.fixture@liquidhr.test` en de bestaande lokale canonical fixture-key; wachtwoord was daadwerkelijk vereist. Na login: `/dashboard/start`; daarna `/payroll` bleef geauthentiseerd en laadde als HR Admin.
- Authenticatiemethode Manager: geldige directe wachtwoordlogin met `manager.fixture@liquidhr.test` en de bestaande lokale canonical fixture-key; wachtwoord was daadwerkelijk vereist. Na login: `/dashboard/start`; Payroll-management eindigde op `/geen-toegang`.
- Authenticatiemethode Employee: geldige directe wachtwoordlogin met `employee.fixture@liquidhr.test` en de bestaande lokale canonical fixture-key; wachtwoord was daadwerkelijk vereist. Na login: `/dashboard/start`; Payroll-management eindigde op `/geen-toegang`.
- HR Admin: `/payroll`, `/payroll/employees`, `/payroll/differences` en `/payroll/settings` laden correct; Payroll bleef zichtbaar na reload; settings-acties zijn disabled P0-controls.
- HR Admin browser request/page scan: `0` onverwachte page errors, `0` onverwachte console errors, `0` Nmbrs-requests en geen credential-velden/woorden in HTML/API-response.
- De zichtbare Codex in-app browser had geen bestaande sessie en bleef op `/login`; dit is nadrukkelijk geen acceptance-bewijs. `admin@example.com` is niet gebruikt. De bestaande allowlisted TEST role-switch magic-linkflow is beschikbaar in de code, maar was niet nodig omdat de canonical directe fixture-logins geldig waren.
- De Employee-fixture heeft geen tenant membership; de route-denial is bewezen, maar een aparte in-tenant Employee-data-scopecheck blijft daardoor een fixturebeperking.

## Advisors en resterende scope

- Security advisor: de enige Payroll-specifieke melding is de bewuste `rls_enabled_no_policy`-INFO op `payroll_private.payroll_connection_credentials`; dit is server-only by design, met schema-/grant-afscherming. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- Performance advisor: de elf Payroll-`unindexed_foreign_keys` zijn opgelost met de follow-up migration. Resterend zijn alleen `unused_index`-INFO's op de lege nieuwe P0-tabellen, inclusief de nieuwe FK-indexen; verwijderen zou de bedoelde querybescherming terugdraaien. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- P1 blijft volledig open: Nmbrs wire-contract, servercredentials, token/key management, provider-revoke/refresh, discovery en binding zijn niet geïmplementeerd of uitgevoerd. Er is geen Vercel deployment, Production-mutatie, main-merge, main-push of P1-start gedaan.

## Huidige blokkades

P1-acceptatie vereist geautoriseerde Nmbrs-wiredetails en beschikbare server-side environment. De lokale omgeving bevat momenteel geen `NMBRS_*`-variabelen; Vercel/serverconfiguratie moet worden gecontroleerd voordat dit als releaseblokkade geldt. Tokenversleuteling/key management en provider-revoke-/refreshsemantiek blijven expliciete P1-besluiten.
