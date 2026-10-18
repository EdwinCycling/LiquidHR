# AA-PAYROLL-CONVERGENCE-20261018 — Integratie, payroll, cao, pensioen en STAR

Status: **ACTUELE WERKSTATUS / nog niet naar `main` gemerged**  
Momentopname: **18 oktober 2026, 15:19 CEST**  
Bewijskader: gebruikersrapporten van lokale Codex-branches, aan de assistant teruggekoppelde acceptatieresultaten en een read-only inspectie van Core Supabase. Dit bestand is een *statusoverdracht*, geen productie- of juridische certificering. Historische AA-acceptaties blijven geldig voor hun eigen code-SHA en testcontext.

## 1. Productbesluiten — leidend voor vervolgwerk

1. **Eén actieve LiquidHR-applicatieomgeving** met meerdere administraties en rollen; niet twee afzonderlijke versies van LiquidHR. In de infrastructuur bestaan wel ten minste Core Supabase `wnpfloqpjvaacobppbpk` en een historisch Payroll Lab-project `jhgeriucbkfarxiudzfy`. Dat tweede project mag niet als leidende bron voor gewone Payroll-klantprocessen terugkeren. Vercel gebruikt een `production`-deploymentchannel; controleer de daadwerkelijke databasebinding vóór een risicovolle mutatie of release.
2. **Volwaardige payroll in de reguliere klant-UI**: geen LAB-/fixture-/synthetische herkomstlabels in normale pagina's, loonstroken en exports; geen hardcoded testdefaults of speciale klant-workarounds. Echte testcode, auditprovenance, geïsoleerde verificatiedata en gecontroleerde QA blijven noodzakelijk.
3. **Centraal onderhouden broncatalogus** voor officiële cao-, salaris-, pensioen- en wettelijke gegevens: versieerbaar, met bron, werkingssfeer, geldigheid, integriteit, inhoudelijke review en publicatie. De klant bevestigt toepasselijkheid en vult zijn eigen werkgever-/medewerkergegevens aan. Eigen arbeidsvoorwaarden krijgen gelijkwaardige ondersteuning.
4. **Werkelijke productinvoer**: officiële bronwaarden via productbeheer, werkgeversgegevens via HR Admin, medewerkers via reguliere onboarding; atomisch opslaan/readback/audit. Bulkimport met preview/verschillen/bevestiging is toegestane normale productfunctionaliteit. Een bron-PDF of berekend hashbedrag is geen juridische review.
5. **Harde herinrichting van huidige ontwikkelgegevens is toegestaan**: proefregelingen archiveren of verantwoord opruimen en medewerkers ont-/herkoppelen met ingangsdatum en audit. Verifieer scope, referenties, herstelplan en actieve database. **Historische FINALIZED-runs, PDF's, hashes en fiscale/auditbewijzen blijven onveranderd**; geen ongeautoriseerde PROD-writes, externe betalingen of aangiften.
6. **Convergentie vóór release**: ontwikkelde Payroll-, CAO-, pensioen-, Core- en STAR-wijzigingen gecontroleerd combineren, regressies draaien, en pas na expliciet GO naar `main` en Vercel. Geen automatische merge/deploy; cleanup pas na geverifieerde release.
7. Uitvoeringsmodel: **Luna-Max, één Codex-agent per taak, geen subagents**. Parallelle taken alleen met afgescheiden worktrees/bestandensets en migratiesynchronisatie.

## 2. Git- en releasepositie (niet verwarren met functionele afronding)

| Spoor | Bewijs/commit | Status 18-10 |
| --- | --- | --- |
| Core `57014`/`25P02` | bronfix `2f0794c0`, migratie-sync `25e95a76`; Core migratie `20261018085806` toegepast | **GO op fixbranch**, gezamenlijke integratietests nog open |
| Nieuw lokaal integratiespoor | `integration/pay-converge-20261018`; gecherry-pickt `7adc8c21` en `d4b089e9`; lokale `countEmployees()`-backlog `93ee1027` | **Core-commits lokaal geïntegreerd**, niet gepusht/gemerged/gedeployed |
| PAYINTEGRATE | `work/PAYINTEGRATE-01-20261017`, `90692d86` gerapporteerd; latere branch-heads expliciet verifiëren | Payroll-fundament lokaal aanwezig; ancestry controleren |
| CAO-SETUP-01 | `work/CAO-SETUP-01-20261018`, `9d816c53` | Normale CAO-selectie/HR-bronnen gebouwd; geen Core-verloningsacceptatie |
| CAO-PENSION-CORE-01 | `work/CAO-PENSION-CORE-01-20261018`, `a838a50b` | Generieke pensionmanager + atomische service lokaal; 13/13 gericht groen; live registratie destijds HOLD |
| CAO-SOURCE-01 | `work/CAO-SOURCE-01-20261018`, `8cafc54a` | CAO-selectie, volledigheid en browser-smoke groen; bronvulling nog open |
| STAR V2 | STAR-V2-04-varianten, waaronder STAR-V2-04D-2D lokaal afgerond | Afzonderlijke STAR-branch nog niet aantoonbaar in integratie |
| PAYROLL-CORE-RESET-01 | producteigenaar gaf toestemming voor herinrichting; per Mars/Jupiter/Mercurius is adminscope nodig | **Opdracht loopt/uitkomst onbekend**, nooit als uitgevoerd boeken |
| GitHub `main` | GitHub-remote laatst onafhankelijk gelezen op `0708d251` (14-10) | **Historische remote**, niet gelijkstellen aan lokale integratie-HEAD |

**Kritiek:** een Codex-rapport noemde `8cafc54a` als basis van `work/PAYINTEGRATE-01`; elders is dat de CAO-SOURCE-01-commit. Inspecteer echte commit-ancestry/patchsets voordat de resterende branches worden opgenomen. Oudere `integration/pay-converge-20261004` liep 171 commits achter en is **niet** de nieuwe integratiebasis. Geen force reset of ongecontroleerde cherry-picks.

## 3. Payroll — wat is reeds functioneel bewezen?

### Fundament en klantprocessen

- Reguliere HR Admin-maandwerkplek met perioden, individuele runs, calculate/recalculate/review/finalize, status/uitzonderingen en PDF. Periodestatus en individuele runstatus blijven verschillende concepten.
- Componenteditor (SYSTEM/CUSTOMER_CUSTOM/CUSTOMER_FORK), formules/DSL, versiehistorie, berekeningstrace, componentmapping en NL-2026 regressies. Definitieve documenten via LiquidHR-loonstrooktemplate en opgeslagen hash; geen stille historische herberekening.
- Fiscale werknemersverklaringen en IKV-gereedheid op de normale productroute; geregistreerde fiscale profielen en passende inkomstenverhoudingen voor Emma en Noah; waarschuwing: een gereedstaande IKV is nog geen ingediende loonaangifte.
- Werkgeversparameters en jaaropeningscumulatieven via normale HR Admin-workflow: versie/hash, AWf/Aof/Wko/Whk/Zvw/vakantiegeld en effectieve kalenderregels. **Whk 1,81% voor Mars is werkgeversinvoer zonder onafhankelijk vastgesteld officieel Mars-beschikkingsbewijs**, dus niet als algemeen wettelijk tarief claimen.
- Bedrijfseigen Mars-pensioen via normale regels/versies: `MARS-PENSION-2026`, vanaf 01-01-2026, franchise € 19.172, maximum € 137.800, totaal 25%, werknemer 10 procentpunt/werkgever 15 procentpunt; niet als landelijk goedgekeurd fonds presenteren.

### Echte opgeslagen bewijsruns (reeds afgeronde rapportages, historische readbacks)

| Mars oktober 2026 | Bruto | Pensioen WN | Pensioen WG | Loonheffing | Netto | Totale werkgeverskosten | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Emma | € 2.110,20 | € 115,16 | € 172,74 | € 712,67 | **€ 1.282,37** | € 2.799,30 | FINALIZED / PDF opgeslagen / 32 van 32 controles |
| Noah, vanaf 16 oktober | € 1.758,50 | € 93,39 | € 140,09 | € 594,88 | **€ 1.070,23** | € 2.329,33 | FINALIZED / PDF opgeslagen / 32 van 32 controles |

- Emma: PDF SHA-256 `07b29b5b85db56dcaa2d80e8d49390719fa7899e4a9dedd76630aa05403229ef`. Oktober werkgeverpremies € 347,54 en vakantiegeldopbouw € 168,82. Jaaropeningscumulatieven januari-september via expliciete werkgeversopgave; geen verzonnen vorige loonruns.
- Noah: PDF SHA-256 `6f44719f6a38e850eccdefa9abd5a7c4cc87ba72c30ddd23b365a5640d914fcd`. Gebroken maand op 11/22 werkdagen voor loon en afzonderlijke kalenderdagmethodiek voor pensioen; werkgeverpremies € 290,06 en vakantiegeld € 140,68.
- Eerdere FINALIZED-runs, waaronder Mars DEMO-001/002 en opvolgende scenario's, blijven historisch. Een apart DEMO-001-scenario met € 500 variabel loon was nog CONCEPT; geen statuspromotie op basis van dit document.
- Eerder lokale integratietests: PAYINTEGRATE-regels 29, HR/payroll 203, data/pensioen 90 geslaagd, 332 pagina's build. Dit is **geen** integratiebranchacceptatie voor 18 oktober.

### Nog niet complete payrollfunctionaliteit / acceptatie

- Breedte **PAYFULL-02**: cumulatieven over alle perioden, bijzondere beloningen, variabel loon en toeslagverwerking, overwerk, multi-IKV/uitzonderingen, herrekeningen, jaaropgaaf, loonaangifte, werkgeversaangifte-/betaalbestanden en acceptatie volgens wettelijke bronnen. Prioriteren volgens werkelijke productrelease-scope, niet als al afgerond markeren.
- Frits bestaand-run readback geeft `PAYROLL_INPUT_INVALID` vanuit `loadLifecycleEvidence`; is een apart incident. Historische run niet repareren door destructieve edits.
- PAYQA-01: `work/PAYQA-01-20261018` commit `22a193e4` corrigeerde vijf regressieasserties (22/22 gerichte tests). Onder meer kalender-migratie- en persona-link-time-outs stonden daarna nog afzonderlijk open.
- Geen gewone betalingsuitvoering, daadwerkelijke wettelijke aangifte, jaarwerk-eindcertificering of compliancegarantie aannemen op grond van geslaagde voorbeeldruns.
- Bank-/IBAN-gegevens zijn voor uitbetaling noodzakelijk maar geen algemeen vereiste voor een fiscale conceptberekening; onderscheid `FINALIZABLE` van `PAYABLE`.

## 4. Cao en pensioen — wat is gebouwd versus werkelijk opgeslagen?

**CAO-SETUP-01**: normale `/payroll/arrangements` gebruikt Core HR, catalogus-/effectieve versie-keuze Kinderopvang/Retail, schaal/trede-mapping, bron- en scope-readbacks; PFZW/BPF destijds referenties met `Bron nog niet gevalideerd`.

**CAO-PENSION-CORE-01**: geautoriseerde pensioenmanager en atomische, versieerbare, scoped registratie met audit/readback, PFZW/BPF als suggesties, 13/13 tests. Geen verzonnen officiële parameters en destijds geen echte Core-opslag.

**CAO-SOURCE-01**: HR Admin `/settings/employment-contracts`, `/payroll/arrangements` en volledigheidsdashboard; 7 catalogusversies zichtbaar; 10/10 tests, typecheck, 43 namespaces, production build 332/332 en browserconsole 0 fouten. Er zijn **geen** bronwrites of nieuwe loonruns in deze taak uitgevoerd. Dashboard-snapshot uit Mars: Kinderopvang 8%, Retail Mode 8%, Mars-bedrijfsvoorwaarden 25%, Mars-pensioen 56% — dit zijn signaleringen, geen juridische percentages of algemene percentages voor alle administraties.

### Rechtstreeks gelezen Core-schema/gegevens op 18 oktober

Core bevatte: 13 salarisstructuren, 15 structuurversies, 26 salarisschalen, 408 trede-/schaalwaarden, 32 salarisbandwaarden, 3 pensioenregelingen met 4 versie-records, 4 individuele pensioentoewijzingen, 3 regelings-/pensioenkoppelingen en 5 regelings-/salarisstructuurkoppelingen.

- **CAO Rijk**: 18 schalen, 396 schaal-/trede-records; versie vanaf juli 2026 `PUBLISHED`, concept jan 2027 `DRAFT`. Gekoppelde proefregeling `TEST-CAO-RIJK`; geen inhoudelijke broncertificering afleiden uit database-`PUBLISHED`.
- **Kinderopvang**: een Core-`labor_condition_set` met code `CAO_KINDEROPVANG_2025_2026` en één salarisstructuurkoppeling. Structuur `CAO_KO_2025_2026_PAYRUN01_TEST` bevat **één trede: schaal 6/20, € 3.425 voltijd**, gepubliceerde revisie vanaf september 2026. De officiële volledige loontabel **staat dus niet in Core**. Benchmark K2 (schaal 6/12, 24/36 uur, 4 goedgekeurde zondaguren) is eerder lokaal berekend, niet duurzaam via Core verloningsworkflow.
- **Retail Non-Food**: catalogus- en benchmarkregels aanwezig, **geen complete Retail Core-salarisstructuur / BPF-toewijzing aantoonbaar**.
- **Bedrijfseigen pensioen**: `MARS-PENSION-2026` (2 assignments), `COMPANY_WTP_FLAT_2026` (1 assignment) en `COMPANY_LEGACY_PROGRESSIVE_EERBIEDIGD` (1 assignment, twee versies). Vlakke versus progressieve premie zijn legitieme productmethoden, **niet automatisch dubbelen**.
- **Oude proefstructuren**: 4 `Demo loonschaal`-structuren, waaronder **drie gelijknamige ongecodeerde records in dezelfde tenant/HR-groep**; één demo-structuur is aan een arbeidsvoorwaardenregeling gekoppeld. Drie `TEST-CAO-*`-regelingen en Kinderopvang-`PAYRUN01_TEST` bestaan. Geen dubbele stapcodes binnen exact dezelfde schaal/revisie, geen dubbele identieke regelingscodes binnen dezelfde administratiescope en geen dubbele pensioencodes binnen dezelfde scope gevonden bij gerichte controle.

**Besluit:** reconciliëren in plaats van klakkeloos nieuwe records aanmaken. Actuele testmedewerkers/koppelingen mogen geautoriseerd worden aangepast. Verwijder geen historische referenties waarop FINALIZED-loonruns rusten.

### Noodzakelijke ontbrekende vulling

1. Officiële salarisversies/treden voor Kinderopvang, inclusief 2026-ingangsdatums, arbeidsduur, ORT zondag/andere toeslagen, vakantiegeld en pensioenbasis.
2. Retail Non-Food branchevariant-specifieke tabellen (Mode, Sport/Schoenen, Tuincentra, Wonen voor zover aanwezig/toepasselijk), berekening en BPF.
3. PFZW-basisregeling, toepasselijke aanvullende componenten waaronder mogelijk WIA-excedent met eigen grondslag, voorwaarden, franchise, werkgever-/werknemerpremies, versies en uitvoerder.
4. BPF Detailhandel 2026 met toepasselijkheid, eventuele vrijstellingen, franchises, caps, deelmethodes en effectieve regelings-/werknemerskoppelingen.
5. Bedrijfseigen regelingen Mars en overige bestaande met provider, deelnamecriteria, deeltijd/deelmaand, bron/provenance, verificatie en salarisstructuur indien van toepassing.
6. Volledige bronreview, immutable publicatie, echte Core-readback en vier acceptatiecases **Kinderopvang K2, Retail R1/R2, bedrijfseigen Mars** via reguliere HR Admin-/Payroll-UI.

**Officiële controlebronnen (niet automatisch gevalideerd):**
- [Cao Kinderopvang 2025–2026](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf)
- [PFZW premie/franchise](https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html)
- [Kinderopvang pensioen 2026](https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026)
- [Retail Non-Food juli 2026](https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf)
- [BPF Detailhandel 2026](https://pensioenfondsdetailhandel.nl/content/publications/Premieoverzicht-2026.pdf)
- [BPF verplichtstelling](https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/situaties-en-wijzigingen/verplichtstelling)

**Let op:** de in eerdere opdrachten genoemde numerieke cao-/fondsparameters zijn invoerhypothesen totdat bronartikel, geldigheidsdatum en methode zijn gecontroleerd. Een codebenchmark of voorbeeldbedrag is geen automatisch juridisch gepubliceerd record.

## 5. CORE-DB-25P02 — opgelost op fixbranch, lokaal geïntegreerd

Root-cause-keten: `57014` statement-time-out in capability/levelqueries door ~707 RLS-subplannen via geneste manager-read; daarop volgde `25P02` op één PostgreSQL-backend. Fix vervangt dure paden in vijf SELECT-policies door scoped helper, sequentiële reads/stop-op-fout en veilige SQLSTATE-fouten. Migratie `20261018085806` reeds op Core toegepast; niet hernoemen of dubbel uitvoeren.

**Acceptatie op fixbranch: GO**. STAR HR Admin, manager/Employee/anon en Payroll-readflows PASS; buiten managerteamscope `403`, anon `401`. Vitest: 633 bestanden en **3.033 geslaagde tests**, 4 bestanden/8 tests overgeslagen, 70 relevante autorisatietests en typecheck PASS. Latere logwindow 09:35:40–11:05:17 UTC: geen `57014`/`25P02`; globale `pg_stat_statements` geeft geen exacte pre/post-causale vergelijking.

**Losstaand performance-item:** `countEmployees()` op startpagina veroorzaakte 09:22:30 UTC een afzonderlijke `57014` met gemiddeld 4,40 s, max 7,44 s over 9 calls; open als gerichte query/RLS-optimalisatie, geen blocker voor opnemen van de talentfix.

**Integratiebranch:** de geaccepteerde fix is lokaal gecherry-pickt in nieuwe `integration/pay-converge-20261018`. Op die nieuwe checkout nog **geen** succesvolle eigen typecheck/Vitest door Windows `EPERM` op `packages/db` workspace-symlink. Node 22.14.0 voldoet niet aan `@sparticuz/chromium@149` minimaal 22.17.x (of 24.x). Herstel toolchain via repo/Windows-supported route en test de gecombineerde checkout; oude fixbranchacceptatie vervangt dat niet. `tmp/` en wijzigingen in oorspronkelijke PAYINTEGRATE/worktree niet opruimen zonder controle.

## 6. STAR Performers en overige Core-UX

STAR-V2 lokale functionele en securitywerkzaamheden: HR Admin Talent/Continuous Appraisal Insights, manager-leesrechten via afzonderlijke RLS-migratie, employee toegang geweigerd; exacte geaccepteerde branch-heads/migratievolgorde ophalen uit STAR-thread vóór integratie. STAR-V2-04D-2D was **LOCAL DONE**, maar nog geen gezamenlijke merge.

UI-backlog vóór/naast release: verticale/afgebroken tekst op kleinere resoluties bij medewerkerkaart, medewerkerpagina aantrekkelijker en overzichtelijker (minder scroll, snellere/lazy-loaded segmenten). Activa, Software, Wagenpark en Budgetten uit huidige betrokken schermen weghalen; **als toekomstige modules op roadmap behouden**, niet geheel schrappen.

Overige open CORE: `countEmployees()` performance, persona/cross-scope/security-regressies en consistente faal-veilige DB-transactiefoutweergave. Parallelle CORE-roadmap WVP01/INS02 blijft bestaan maar blokkeert de gerichte Payroll/STAR-convergentie niet automatisch.

## 7. Volgende uitvoeringsvolgorde en definitieve release-gates

1. **PAYROLL-CORE-RESET-01** gecontroleerd afronden: huidige actieve administratie en databasebinding verifiëren; per Mars/Jupiter/Mercurius geautoriseerde HR Admin-scope; herstelmanifest; demo-/proefstructuren consolideren; werknemers opnieuw koppelen; officiële cao-/pensioenbronnen in normale UI toevoegen; per regeling readback en volledig netwerk van mappings. Gebruiker heeft actieve testgegevens expliciet voor correctie vrijgegeven. Voor Jupiter/Mercurius is afzonderlijk geldige scoped Admin-login nodig; geen credentials uitwisselen.
2. **INTEGRATION-BASE-01**: Git ancestry, gebruikte HEADs, scope migraties, Windows `EPERM`, Node-versie/npm-toolchain herstellen; niet dezelfde blokkade blijven herhalen.
3. **Alle ontwikkelde codebranches samenbrengen**: payroll foundation, PAYSETUP, CAO-SETUP/PENSION/SOURCE, PAYQA, STAR-V2, productprincipe/documentatie. Neem alleen geverifieerde commits op, behoud historische FINALIZED/versies. Controleer huidige toestand van de lokale integratiebranch vóór ieder vervolg. Geen conflictvrije `merge-tree` als vervanging van runtimeacceptatie beschouwen.
4. **Vier normale payroll-scenario's**: K2, Retail R1/R2 en bedrijfseigen Mars — werkgeversbron → schaal/trede/uren → toeslagen → pensioen → loonheffing → werkgeverslasten → netto → cumulatieven → PDF + SHA en rol-/tenantregels; geen officiële certificering uit demo-evidence afleiden.
5. **Breed releasescopebesluit**: jaaropgaaf, multi-IKV, aangifte, componenten, variabel loon, speciale beloning, cumulatieven en PAYFULL-open punten: expliciet besluiten wat verplicht is vóór hoofdrelease vs. gepland, zonder onterecht volledig NL-payroll te claimen. `CONTROL02` officiële XML-import was historisch **CANCELLED** (zie bestaande AA); onderscheid die geannuleerde import van nog benodigde uitgaande loonaangifte.
6. **Gezamenlijke QA**: typecheck, Vitest, build 332 pagina's indien toepasselijk, lint/i18n, RLS tenant/HR-groep/persona, migratie-idempotentie/compatibiliteit, browser STAR en Payroll, lifecycle/PDF/hash, performance, centrale omgeving/verbindingscheck. Open scenario's expliciet als HOLD benoemen.
7. **Release enkel met expliciete producteigenaar-GO**: gecontroleerde integratie naar `main`, Vercel on demand, exacte commit/deployment/env-binding, hosted auth/securitysmoke, rollback. Daarna pas worktree/branchcleanup.

## 8. Registratiediscipline

- **DONE** alleen bij daadwerkelijk gecommit code of aantoonbare Core readback; **GO** alleen met benoemde acceptance-gates; **HOLD** bij ontbreken van live bewijs. Nieuwe branch/geslaagde build is geen productieacceptatie.
- Nooit synthetische productlabels tonen om de testherkomst te communiceren; audit- en QA-provenance blijven intern waarheidsgetrouw.
- Cijfers, scenario's en PDF-hashes hierboven zijn historische, afzonderlijk gerapporteerde bewijzen, niet herberekend binnen dit document.
- De lokale integratiebranch en actuele AA-documentatie kunnen nieuwer zijn dan de GitHub-`main`-kopie; reconciliatie vóór definitief mergen is vereist.
