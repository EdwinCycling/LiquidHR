# LiquidHR TEST-cutover en SEC-101 CONTRACT — 19-11-2026

## Release state

- Vercel project: `liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`)
- Vaste URL: <https://liquid-hr-hr-suite.vercel.app>
- Deployment: `dpl_799S2oXST6MgNzW96iBqUnhUQ1RK`, READY, target `production` voor de bestaande synthetische TEST-runtime
- Deployment SHA: `69d29bbe80a5791cf31c1d4966347f756cd10130`
- Build: PASS (reeds geaccepteerde cloudbuild; geen nieuwe build na de database-only CONTRACT)
- Canonical login smoke: HTTP 200
- De eerder geaccepteerde deployment blijft beschikbaar als rollbackreferentie. Na CONTRACT is terugschakelen naar een oudere appversie niet automatisch veilig; de databasecompatibiliteit is niet opnieuw bewezen.

## CONTRACT-migratie

- SQL-bestand: `apps/hr-suite/supabase/migrations/20261119161917_sec101_contract_column_access.sql`
- SHA-256: `2653A882457E9DA3845FA001218F93B21A064E405F9D57CCDBEE34500664A125`
- HR/Core TEST-project: `wnpfloqpjvaacobppbpk`
- Geregistreerd: eenmaal, versie `20261119161917`, naam `sec101_contract_column_access_20261116120304`
- RLS blijft aan op `employment_payroll_tax_profiles` en `employment_payroll_tax_profile_audit`.
- `authenticated` heeft geen tabelbrede SELECT. De allowlist telt 23 profielkolommen en 11 auditkolommen.
- Niet-selecteerbare technische kolommen: profiel `source_reference`, `idempotency_key`, `confirmed_by_user_id`; audit `actor_user_id`, `request_key`.
- SEC-101 SECURITY DEFINER-functies `sec101_profile_metadata` en `sec101_provenance_key_fingerprint`: `authenticated` EXECUTE toegestaan, `anon` EXECUTE geweigerd, lege vaste `search_path`.
- De officiële CLI-dry-run kon vanuit deze toolcontext niet authenticeren (`AccessTokenRequiredError`). De centrale wijziging is via de goedgekeurde Supabase-migratieactie toegepast en daarna via de migratieledger, effectieve rechten en RLS-instellingen read-back gecontroleerd.

## Hosted controles na CONTRACT

| Persona / gate | Resultaat | Bewijs |
|---|---|---|
| HR Admin `/dashboard/start` | PASS | Authentieke login op het vaste domein; contextschakelaar en pagina laden. |
| HR Admin Payroll | PASS, beperkte smoke | Payroll-overzicht laadt met bestaande geslaagde runs. Geen nieuwe berekening uitgevoerd. De geaccepteerde 3 scenario's dateren van vóór CONTRACT. |
| HR Admin WVP | PASS, beperkte smoke | WVP-overzicht laadt; 0 actieve, 0 verlopen en 0 binnenkort vervallende dossiers in de geselecteerde context; 6 bestaande prioriteitsregels zichtbaar. Geen mutatie uitgevoerd. |
| HR Admin Talent | PARTIAL | Talentlijst laadt met 67 medewerkers. De Talentrapportage meldt directe managerscope van 3 medewerkers en 19 regels; de gevraagde organisatiebrede rapportagescope is niet bevestigd. |
| Manager `/dashboard/start` | PASS | Authentieke bestaande Manager-sessie op dezelfde READY-deployment laadt startpagina. |
| Manager WVP | PASS, beperkte smoke | Bestaand direct-teamdossier, mijlpalen, deadlines en status laden. Geen status-, document- of lifecyclemutatie uitgevoerd. |
| Manager Talent | PASS, beperkte smoke | Team Talent en Skills Matrix toont 6 leden in de directe scope en bestaande capabilityregels. Geen mutatie uitgevoerd. |
| Employee ESS na CONTRACT | NOT TESTED | `my-salary`-route laadt in de bestaande Manager-sessie maar heeft daar geen definitieve loonstrook. Pro-formaformulier laadt zonder berekenbare bron. De opgeslagen Lisa-credential werd op het vaste domein afgewezen; geen wachtwoord is gelogd of gewijzigd. |
| Directe Data API na CONTRACT | INCOMPLETE | De kolomrechten en RLS zijn read-back gecontroleerd. Authentieke post-CONTRACT REST-proeven voor Employee-self, Manager-other en Tenant Admin zijn niet uitgevoerd in deze ronde. Eerdere authentieke pre-CONTRACT rijproeven blijven historisch bewijs, geen post-CONTRACT test. Andere-tenantfixture: NOT TESTED. |
| Vercel runtime-errors (24 uur) | Geen 500-groep gemeld | Twee geaggregeerde HTTP 409-contextgroepen op `/dashboard/start` (laatste event op 19-11); deze geven een ontbrekende HR-groep-/tenantselectie aan. Geen payroll- of WVP-500 waargenomen in de aggregatie. |
| Zero-write | PASS | Geen payrollberekeningen, dossierwijzigingen, documentmutaties of Talentmutaties uitgevoerd na CONTRACT. Alleen de goedgekeurde SECURITY CONTRACT-migratie wijzigde databaseschema-rechten. |

## Besluit

De gezamenlijke TEST-app is actief op het vaste domein en de CONTRACT-grens is toegepast. De technische buildgate blijft PASS; de hosted eindacceptatie is **PARTIAL**. GitHub #101 blijft **OPEN** tot de authentieke post-CONTRACT Data API-proeven zijn voltooid. De Employee-login en de HR Admin organisatiebrede Talentrapportage zijn resterende acceptatiegaten. Manager-MSS en BONUS blijven PARKED.
