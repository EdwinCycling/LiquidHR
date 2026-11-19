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
| Employee ESS na CONTRACT | PASS, 3/3 scenario-uitkomsten + download | Geauthenticeerde Lisa-sessie op het vaste domein: eigen salarisoverzicht en bestaande loonstrook laden; download-event voltooit. +2 betaalde uren, +5% salaris en contracturen naar 32 leveren elk “Proefloonstrook” op. Na terugkeer bleef dezelfde ene bestaande loonperiode/loonstrook beschikbaar; geen persistente scenario-uitkomst. De sessie toonde ook teamwidgets; Employee-only negatieve autorisatie is niet bewezen. |
| Directe Data API na CONTRACT | INCOMPLETE | Bestaande ACL/RLS-readback bevestigt de CONTRACT-grens, maar authentieke REST-calls met Employee-, Manager- en Tenant Admin-sessies zijn niet uitgevoerd. De Codex-browser gaf bij WebMCP-discovery gpt-6-luna does not support command webmcp_list_tools; de Supabase-connector heeft geen gebruikerssessie-REST-runner. Geen service-role-impersonatie of tokenextractie gebruikt. Andere-tenantfixture: NOT TESTED. |
| Vercel runtime-errors | PASS, geselecteerde laatste 1 uur | Geen runtime-errorgroepen gevonden voor /my-salary, /api/my-salary/pro-forma en /api/my-salary/payslips/2026-10 na de acceptatieacties. De eerder waargenomen 409-contextgroepen op /dashboard/start zijn hiermee niet opnieuw onderzocht. |
| Zero-write | PASS, geen persistente loonmutatie | De drie pro-forma berekeningen zijn transient volgens de UI-contracttekst; na terugkeer bleef de bestaande ene loonperiode/loonstrook staan. Geen run, definitieve loonstrook of betalingsopdracht aangemaakt. Alleen een bestaande eigen loonstrook is gedownload. |

## Besluit

De gezamenlijke TEST-app is actief op het vaste domein en de CONTRACT-grens is toegepast. De technische buildgate blijft PASS; de hosted eindacceptatie is **PARTIAL**. Payroll ESS is na CONTRACT 3/3 scenario-uitkomsten plus eigen loonstrookdownload PASS. GitHub #101 blijft **OPEN** totdat directe, authentieke Data API-regressies zijn uitgevoerd. Employee-only scope en Tenant Admin API-toegang zijn niet bewezen; andere-tenantfixture blijft NOT TESTED. HR Admin post-CONTRACT berekeningen en organisatiebrede Talentrapportage zijn niet bevestigd. De bestaande rollbackdeployment blijft behouden, maar oude appversies zijn na CONTRACT niet als veilige rollback gevalideerd. Manager-MSS en BONUS blijven PARKED.

## Aanvulling na authentieke Lisa-sessie — 19-11-2026

- De sessie was ingelogd op het vaste Vercel-domein en de startpagina begroette Lisa. De pagina toonde daarnaast teamwidgets; daarom telt dit bewijs als Lisa-selfservice, niet als bewijs dat dit account uitsluitend Employee-rechten heeft.
- /my-salary toonde de bestaande definitieve periode en eigen loonstrook. De downloadactie leverde een downloadbestand op; de bestandsinhoud en salarisbedragen zijn niet gelezen of vastgelegd.
- De bestaande pro-formaroute is via de browser met dezelfde sessie drie keer uitgevoerd: +2 betaalde uren, +5% salaris en 32 contracturen. Elk scenario eindigde met een proefloonstrook. De browserbediening legde het ruwe HTTP-statusnummer niet vast.
- Aanvullende statuscontrole na CONTRACT: bij elk van de drie scenario's was de UI-status “Bronnen compleet voor deze pro-formaberekening” zichtbaar naast “Proefloonstrook”. De implementatie koppelt die status aan een berekende bronstatus; de bedragen en hashes zijn niet vastgelegd.
- De terugkeer naar /my-salary toonde dezelfde ene bestaande loonperiode en loonstrook; er werd geen pro-forma opgeslagen. De UI meldt expliciet dat de proefberekening niets opslaat.
- POST /api/my-salary/pro-forma bouwt de Employee-response uit status, sourceStatus, scenarioType, period, baseline, scenario, difference en hasGaps; ontsleutelde fiscale metadata wordt niet aan de Employee-response toegevoegd. De succesvolle berekeningen laten via de bestaande servercode zien dat de key-fingerprintcontrole niet faalde; fingerprintwaarde en live sourceHash zijn niet aan de browser getoond.
- Vercel-runtime-erroraggregatie voor de drie salarisroutes gaf in het geselecteerde laatste uur geen runtime-errorgroepen.
- De directe Supabase Data API-tests blijven OPEN: de aanwezige browserbediening biedt geen ondersteunde user-session REST-aanroep. WebMCP-discovery meldde gpt-6-luna does not support command webmcp_list_tools; de Supabase-connector werkt als databasebeheerinterface en is geen gebruikerssessie. Er is geen privilege-impersonatie of service-role gebruikt.
- Een tijdelijke shareable-link op de canonical alias is ingetrokken en read-back bevestigt nul resterende shareable links; de canonical alias en normale gebruikerslogin blijven actief.
