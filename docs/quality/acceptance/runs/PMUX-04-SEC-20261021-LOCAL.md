# PMUX-04-SEC — lokale securitygate — 2026-10-21

## Verdict

**GO voor afzonderlijke TEST-autorisatie.** Er zijn in deze gate geen remote migraties, API-writes, procespublicaties of aanvragen aangemaakt. De bestaande branch begon schoon op `0d985fd0e0afe4fc1b7fa886db1ae94c4f16d0d1` (`work/BRANCH-SPLIT-PMUX-20261021`).

## Catalogus-RPC

- De oorspronkelijke PMUX-03A-migratie verleende `authenticated` direct `EXECUTE` op `internal_security.get_process_startable_catalog_internal(uuid, uuid)`. De helper controleerde `auth.uid()`, bond de opgegeven tenant/HR-groep aan een actieve employee van diezelfde actor en filterde daarna op publicatiestatus, de nieuwste immutable version, startpermission en actieve employment waar administration scope gold. Een directe call kon dus geen tenant-, HR-groep- of definitiegrens omzeilen, maar maakte de interne ingang onnodig rechtstreeks aanroepbaar. Er zijn geen administratie- of definitie-ID-parameters.
- Lokale hardening: de interne helper is `SECURITY INVOKER`, heeft `search_path = ''` en EXECUTE is ingetrokken voor `PUBLIC`, `anon` en `authenticated`. De publieke wrapper is de enige clientingang, gebruikt `SECURITY DEFINER` met lege `search_path`, controleert `auth.uid()` server-side en verleent EXECUTE uitsluitend aan `authenticated`. De wrapper en helper kwalificeren eigen schemas expliciet. Er zijn geen tabel-SELECT-grants toegevoegd.
- De PGlite-uitvoering ontdekte ook een bestaande foutieve haakjesvolgorde in de JSON-aggregatiesubquery; die is lokaal gecorrigeerd zodat de echte migratietekst nu volledig compileert en uitvoert.
- PGlite voert de volledige migratie uit. Het bewijst dat `authenticated` de interne helper niet kan uitvoeren, maar de publieke wrapper wel; een actor ziet alleen de nieuwste gepubliceerde en startbare definitie. Concept, niet-startbare administration-scope, verkeerde tenant/groep, ontbrekende identiteit en `anon` worden geweigerd of niet teruggegeven.
- De PGlite-RBAC-harness gebruikt fixtures voor `auth.uid()` en permissietoekenning. Hij bewijst de migratie-/querylogica, niet echte Supabase JWT-, RLS-, function-owner- of API-schema-instellingen.

## Historie-RPC

- `20261021160000_pmux03b_process_work_experience.sql` heeft een vaste `search_path`, `SECURITY DEFINER` op de publieke wrapper, een `auth.uid()`-check, volledige revoke van de interne functie en uitsluitend `authenticated`-EXECUTE op de publieke wrapper. De helper controleert `process_work_item_can_read` en bindt versie, events en wijzigingsnotities aan exact hetzelfde gescopeerde item.
- De bestaande PGlite-test voert de migratie uit en weigert directe interne/anon-calls, ongeautoriseerde actor-, item-, HR-groep- en tenanttoegang. De migratie is niet gewijzigd in deze gate.

## HR Admin-scope en resterende persona-readback

- De bestaande HR_ADMIN-permissionmigratie kent `process-task:act` toe aan tenantgebonden HR_ADMIN-rollen. De bestaande resolvers vereisen dezelfde tenant, een actieve rol en (voor HR-groep-acties) actieve toegang tot die exacte groep. Een actieve `TENANT`-toegang geldt voor administraties binnen die tenant; bestaande migraties synchroniseren die tenanttoegang naar bestaande en nieuw aangemaakte HR-groepen. Cross-tenant requests blijven geweigerd.
- Een afzonderlijke PGlite-test voert de bestaande permission-grantmigratie en exacte HR-groep-, administratie- en process-scope-helperfuncties uit: twee administraties en twee HR-groepen binnen de eigen tenant zijn toegestaan; een andere tenant wordt geweigerd. Geen rol of persona is gewijzigd.
- De daadwerkelijke access-rijen van de huidige TEST-HR-Admin-persona en diens HR-queue-uitvoerbaarheid zijn niet live uitgelezen. De productrol is volgens het bestaande contract bevoegd; de persona-koppeling blijft een read-only check bij de browserrun.

## Gerichte verificatie

```text
npm test -- supabase/migrations/20261021143000_pmux03a_ess_process_start_catalog.contract.test.ts supabase/migrations/pmux03b_process_work_experience.contract.test.ts supabase/migrations/pmux04_sec_hr_admin_scope.contract.test.ts
3 testfiles passed; 11 tests passed.

npx eslint supabase/migrations/20261021143000_pmux03a_ess_process_start_catalog.contract.test.ts supabase/migrations/pmux04_sec_hr_admin_scope.contract.test.ts
passed.

git diff --check
passed.
```

## TEST-grens en volgorde

1. `apps/hr-suite/supabase/migrations/20261021143000_pmux03a_ess_process_start_catalog.sql`
2. `apps/hr-suite/supabase/migrations/20261021160000_pmux03b_process_work_experience.sql`

Beide bestanden blijven **LOCAL ONLY / REMOTE APPLICATION OPEN**. Bij afzonderlijke toestemming: eerst de catalogus-RPC, daarna de historie-RPC, met remote migration-history/RLS/grant-readback vóór of na toepassing volgens het goedgekeurde runbook. Er zijn geen remote writes uitgevoerd.

Na afzonderlijke TEST-autorisatie kan de browseracceptatie via de bestaande role switcher en lokale poort 3011 doorgaan met één synthetische Opleidingsaanvraag. Verifieer de bestaande HR Admin-persona's scope vóór de HR-actie; verander geen rol als die check faalt. Publicatie, de aanvraag en procesacties vallen buiten deze lokale gate en vereisen de expliciete autorisatie voor de browserrun.
