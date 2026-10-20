# PAYROLL-SOURCE-FIX-01 — herstelmanifest

Status: **PARTIAL — de oorspronkelijke source-fout is als autorisatieprogrammeurfout hersteld en de echte bron is zichtbaar. Geen november-CONCEPT gemaakt: Jupiter mist werkgeversconfiguratie, een geldige Frits-openingsbalans en een ondersteunde PFZW-salarisbasisdefinitie.**

Worktree: `PAYQA-01-20261018`, branch `work/PAYQA-01-20261018`, start-HEAD `1600c3e4a423ac37727ffcd34ed6f93093bc3a0e`. Alleen lokale code en synthetische TEST-readback. Geen broninrichting opnieuw aangemaakt, geen Core/Payroll-data gewijzigd, geen run ingediend, geen FINALIZED-run gewijzigd, geen merge/push/deployment.

## Foutpad en eerste falende afhankelijkheid

`Payroll → Salarisverwerking` → `getPayrollCycleWorklist` → `LiquidHrPayrollSourceProvider.getPayrollSourceSnapshot` → `getEmploymentPayrollSourceProjection`.

De eerste fout was geen ontbrekende cao-regel, RLS-denial of PostgREST-readfout. `requirePermissionInContext` behandelde een HR Admin die zijn eigen gekoppelde employee-rij las altijd als selfservice en verving de expliciete `salary:read`-rolmachtiging door `self:salary:read`. Dat gaf `AuthorizationError`, waarna de provider dit als `PAYROLL_SOURCE_DATA_UNAVAILABLE` presenteerde. De check gebruikt nu de exacte permission uit de context voor HR_ADMIN/TENANT_ADMIN; een gewone eigen medewerker heeft nog steeds selfservice-rechten nodig. Een regressietest dekt beide kanten.

Na herstel las de geautoriseerde HR Admin Maya de Payroll-worklist voor Jupiter BV, HR-groep Planeten en november 2026. De Frits-rij toont geen `contractualSalary`, `contractualHours`, `contract`, `laborCondition` of `cao` gap. De opgeslagen CAO_SCALE-koppeling `6f69c8aa-bd5a-4597-a824-c8f77e95e4e4` (Kinderopvang 2025–2026, versie 2026.09, schaal 6 trede 12, 24/36 uur, ingangsdatum 1 november 2026) wordt dus door de echte bronprojectie gelezen. De oude regel is niet opnieuw aangemaakt. De periodenweergave toont november als OPEN.

Een eerdere, niet aan Frits correleerbare PGRST003/504-pooltimeout is afzonderlijk waargenomen; die was niet de eerste fout op zijn bronpad. Verwante HR/Payroll-readfan-out is nu begrensd in batches (maximaal 3 worklist-bronnen en 4 projection-queries tegelijk). Dit wordt niet als bewezen oorzaak of oplossing van de Frits-fout gerapporteerd.

## Exacte resterende bronblokkades

- **Werkgeversconfiguratie — echte ontbrekende record voor Jupiter.** Payroll → Instellingen meldt “Er is nog geen werkgeversconfiguratie vastgelegd.” De normale pagina markeert bron/besluitreferentie, sectorcode, WHK-beschikking, AWf/Aof/Wko/Zvw-classificaties en percentages, vakantiegeld, toepasselijkheid eindejaarsuitkering, componentenset en pensioen-deelmaandmethode/-bron als niet gereed. Zonder de echte beschikking en werkgeversbesluiten zijn deze waarden niet invulbaar.
- **Openingscumulatief — Frits versie 310, openingsdatum 2026-09-30.** De bronperiode vanaf/tot is leeg en de bronvermelding is `PAYRUN01 TEST PERSONA ASSIGNMENT`; de provider meldt `PAYROLL_OPENING_CUMULATIVE_MISSING` én `PAYROLL_OPENING_CUMULATIVE_INVALID` op `opening_balance_json`. De provider accepteert alleen een hash-valide JSON met de zeven cumulatieve velden: `grossWageBeforePeriod`, `holidayReserveBeforePeriod`, `yearEndReserveBeforePeriod`, `taxableWageBeforePeriod`, `wageTaxBeforePeriod`, `employeeInsuranceWageBeforePeriod`, `zvwWageBeforePeriod`. De exacte ongeldige subkey is niet zichtbaar gemaakt; versie 310 heeft geen verifieerbare loonbron en is niet gebruikt. De eerdere versie 309 heeft dezelfde synthetische bronvermelding en ontbrekende bronperiode.
- **Pensioen — koppeling aanwezig, definitie ongeldig.** Frits heeft een effectieve `PFZW — Kinderopvang 2026`-toewijzing en een effectieve koppeling van `Cao Kinderopvang 2025-2026` naar PFZW Kinderopvang 2026 voor `NEW_ENTRANT`. Regelingversie 1 blokkeert op exact `pensionable_salary_definition.method`: de opgeslagen waarde is beschrijvende tekst, niet de door de engine ondersteunde definitie (`PENSIONABLE_SALARY_DEFINITION_UNSUPPORTED`). De bestaande deelname en koppeling zijn niet opnieuw aangemaakt. De opgeslagen definitie geeft geen wettelijke goedkeuring; er is geen nieuwe versie opgeslagen.
- **Fiscale gegevens, IKV, werkgeverregistratie en dienstverband** tonen voor Frits geen gap op deze worklist-read. Deze zijn niet als blokkade aangemerkt.
- **November-uren:** geen goedgekeurde zondaguren voor november. De vier oktoberzondaguren zijn niet overgenomen.

De worklist geeft deze gaps afzonderlijk terug. De veilige correlatie-ID van de gelezen Frits-snapshot is `054ba359-ff41-4f7a-a83d-4d88bce499ba`. Diagnostiek bevat broncategorie, allowlisted foutcode en correlatie-ID; geen namen/record-ID's/bedragen of ruwe databasefouten in de foutmelding.

## Normale invoeractie en runstatus

Een bevoegde Jupiter-payrollbeheerder moet de echte werkgeversbeschikking/werkgeversbesluiten gebruiken in **Payroll → Instellingen → Werkgeversconfiguratie** om de ontbrekende waarden, geldigheidsperiode en bronreferentie vast te leggen. Dezelfde beheerder moet voor Frits in **Openingscumulatieven** een controleerbare betaalde loonbron en bronperiode kiezen en de zeven cumulatieven daaruit invoeren. Gebruik geen persona-assignment, concept-run, schatting of aangenomen nullen. Een pensioenbeheerder moet de PFZW-salarisbasis vanuit de toepasselijke regeling/werkgeversbron als ondersteunde opvolgerversie vastleggen; geen methode of deelname veronderstellen.

Er is **geen nieuwe november-run** aangemaakt of teruggelezen; er ontstond dus geen dubbele run. De bestaande lijst had geen Frits-novemberrun. Bruto, werknemers-/werkgeverspensioen, loonheffing, netto en werkgeverskosten konden daarom niet worden uitgelezen. Er is niets gefinaliseerd. Er is geen configuratie- of openingsbalansformulier opgeslagen.

## Mercurius — aparte selectorbevinding

De geautoriseerde administratiekeuze en `Instellingen → Bedrijfsstructuur` tonen voor deze identiteit alleen actieve, bereikbare HR-groep **Planeten** met **Jupiter BV** en **Mars BV**. De selector wordt uit de actieve tenant-, HR-groep-, administratie- en grantscope opgebouwd; `business-structure` krijgt dezelfde `context.hrGroups`. Mercurius zit niet in deze huidige bereikbare context. Deze UI kan niet onderscheiden of de canonieke Mercurius-rij inactief is, bij een andere HR-groep/tenant hoort of buiten de bestaande actor-grant valt. Daarom is geen selector-/toegangswijziging gedaan. De normale vervolgstap is een bevoegde tenantbeheerder de status, HR-groep en bestaande actor-scope van de Mercurius-rij laten controleren.

## Verificatie

- Gerichte Payroll-suite (bronprovider, cycle service/model, workbench, bounded query loader, actual-work, tax-profile en CAO-BENCH02 service/UI): **11 bestanden, 83 tests geslaagd**.
- TypeScript `tsc --noEmit`: **geslaagd**.
- ESLint gewijzigde bestanden: **0 fouten**, één bestaande ongebruikte `PayrollSetupRepository`-importwaarschuwing.
- i18n: **43 NL/EN-namespaceparen gelijk**; `git diff --check`: **geslaagd**.
- Payroll-rules package tests: **niet uitgevoerd** — Vitest faalde vóór testcollectie met Windows `EPERM` bij tijdelijke directory-renames (6 suites, 0 tests). Geen tweede retry.
- Geauthenticeerde browser-readback: Jupiter-scope, Payroll-instellingen en werkgevercheck, Frits-diagnostiek, PFZW-toewijzing/mapping en de Mercurius-keuze zijn bekeken. Er is geen conceptberekening ingediend. Na de dev-server/HMR-fout kon de runtime niet opnieuw worden gestart: de centrale lokale TEST-config ontbreekt; geen configuratie of credentials zijn gelezen/aangemaakt.

## Onafhankelijke scenario's

De gerichte CAO-BENCH02-, CAO_SCALE-, PFZW- en werkgeversconfiguratievalidatietests bleven onderdeel van de onafhankelijke scenario-gates; het ontbreken van Frits' betaalde openingsbron blokkeert hun codeontwikkeling niet. De bestaande payroll-regelengine is niet aangepast met verzonnen PFZW-, fiscale of werkgeverswaarden. Dit herstel sluit de aparte scenario's niet af.
