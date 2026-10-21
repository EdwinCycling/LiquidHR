# PAYROLL-SOURCE-FIX-01 — herstelmanifest

Status: **PARTIAL — de oorspronkelijke Payroll-sourcefout is hersteld. De Jupiter-werkgeversconfiguratie heeft nu een opgeslagen maar niet-actieve Conceptversie. Geen november-CONCEPT gemaakt: Frits' betaalde openingscumulatieven zijn niet bewijsbaar en de PFZW-opvolgerversie kon door een foutieve databasepermission-check nog niet via de editor worden opgeslagen. De permission-fix staat lokaal als niet-toegepaste migration. Zie de follow-up onderaan.**

Worktree: `PAYQA-01-20261018`, branch `work/PAYQA-01-20261018`, start-HEAD `1600c3e4a423ac37727ffcd34ed6f93093bc3a0e`. In de follow-up is één werkgeversconfiguratie-DRAFT via de geautoriseerde HR Admin-UI opgeslagen en teruggelezen. Geen cao-regel, openingscumulatief, deelname, mapping of PFZW-versie gewijzigd; geen run ingediend; geen FINALIZED-run gewijzigd; geen remote schema-migratie, merge, push of deployment.

## Foutpad en eerste falende afhankelijkheid

`Payroll → Salarisverwerking` → `getPayrollCycleWorklist` → `LiquidHrPayrollSourceProvider.getPayrollSourceSnapshot` → `getEmploymentPayrollSourceProjection`.

De eerste fout was geen ontbrekende cao-regel, RLS-denial of PostgREST-readfout. `requirePermissionInContext` behandelde een HR Admin die zijn eigen gekoppelde employee-rij las altijd als selfservice en verving de expliciete `salary:read`-rolmachtiging door `self:salary:read`. Dat gaf `AuthorizationError`, waarna de provider dit als `PAYROLL_SOURCE_DATA_UNAVAILABLE` presenteerde. De check gebruikt nu de exacte permission uit de context voor HR_ADMIN/TENANT_ADMIN; een gewone eigen medewerker heeft nog steeds selfservice-rechten nodig. Een regressietest dekt beide kanten.

Na herstel las de geautoriseerde HR Admin Maya de Payroll-worklist voor Jupiter BV, HR-groep Planeten en november 2026. De Frits-rij toont geen `contractualSalary`, `contractualHours`, `contract`, `laborCondition` of `cao` gap. De opgeslagen CAO_SCALE-koppeling `6f69c8aa-bd5a-4597-a824-c8f77e95e4e4` (Kinderopvang 2025–2026, versie 2026.09, schaal 6 trede 12, 24/36 uur, ingangsdatum 1 november 2026) wordt dus door de echte bronprojectie gelezen. De oude regel is niet opnieuw aangemaakt. De periodenweergave toont november als OPEN.

Een eerdere, niet aan Frits correleerbare PGRST003/504-pooltimeout is afzonderlijk waargenomen; die was niet de eerste fout op zijn bronpad. Verwante HR/Payroll-readfan-out is nu begrensd in batches (maximaal 3 worklist-bronnen en 4 projection-queries tegelijk). Dit wordt niet als bewezen oorzaak of oplossing van de Frits-fout gerapporteerd.

## Exacte resterende bronblokkades

- **Werkgeversconfiguratie — echte ontbrekende record voor Jupiter.** Payroll → Instellingen meldt “Er is nog geen werkgeversconfiguratie vastgelegd.” De normale pagina markeert bron/besluitreferentie, sectorcode, WHK-beschikking, AWf/Aof/Wko/Zvw-classificaties en percentages, vakantiegeld, toepasselijkheid eindejaarsuitkering, componentenset en pensioen-deelmaandmethode/-bron als niet gereed. Zonder de echte beschikking en werkgeversbesluiten zijn deze waarden niet invulbaar.
- **Openingscumulatief — Frits versie 310, openingsdatum 2026-09-30.** De bronperiode vanaf/tot is leeg en de bronvermelding is `PAYRUN01 TEST PERSONA ASSIGNMENT`; de provider meldt `PAYROLL_OPENING_CUMULATIVE_MISSING` én `PAYROLL_OPENING_CUMULATIVE_INVALID` op `opening_balance_json`. De provider accepteert alleen een hash-valide JSON met de zeven cumulatieve velden: `grossWageBeforePeriod`, `holidayReserveBeforePeriod`, `yearEndReserveBeforePeriod`, `taxableWageBeforePeriod`, `wageTaxBeforePeriod`, `employeeInsuranceWageBeforePeriod`, `zvwWageBeforePeriod`. De exacte ongeldige subkey is niet zichtbaar gemaakt; versie 310 heeft geen verifieerbare loonbron en is niet gebruikt. De eerdere versie 309 heeft dezelfde synthetische bronvermelding en ontbrekende bronperiode.
- **Pensioen — koppeling aanwezig, definitie ongeldig.** Frits heeft een effectieve `PFZW — Kinderopvang 2026`-toewijzing en een effectieve koppeling van `Cao Kinderopvang 2025-2026` naar PFZW Kinderopvang 2026 voor `NEW_ENTRANT`. Regeling `PFZW_2026_KINDEROPVANG`, versie 1, blokkeert op `pensionable_salary_definition.method`: de opgeslagen waarde is beschrijvende tekst, geen door de rekenaar ondersteunde methodecode. De regeling bevat ook geen `pensionable_salary_definition.pfzw2026`-object met de getypeerde bronvelden die de PFZW-provider nodig heeft, waaronder de maandtoerekeningsbeleidstatus, -versie en -bron. De gestructureerde componentmetadata vervangt die velden niet. Dit is een onvolledige regelingconfiguratie, geen ontbrekende CAO→PFZW-koppeling. De bestaande deelname en koppeling zijn niet opnieuw aangemaakt; er is geen opvolgerversie opgeslagen.
- **Fiscale gegevens, IKV, werkgeverregistratie en dienstverband** tonen voor Frits geen gap op deze worklist-read. Deze zijn niet als blokkade aangemerkt.
- **November-uren:** geen goedgekeurde zondaguren voor november. De vier oktoberzondaguren zijn niet overgenomen.

De worklist geeft deze gaps afzonderlijk terug met de foutcodes `PAYROLL_EMPLOYER_CONFIGURATION_MISSING`, `PAYROLL_OPENING_CUMULATIVE_MISSING`, `PAYROLL_OPENING_CUMULATIVE_INVALID` en `PENSIONABLE_SALARY_DEFINITION_UNSUPPORTED`. De veilige correlatie-ID van de actuele Frits-readback is `676f43f5-31ba-4e89-81e1-82cdf1233b8d`. Diagnostiek bevat broncategorie, allowlisted foutcode en correlatie-ID; geen persoonsgegevens, bedragen of ruwe databasefouten in de foutmelding.

## Normale invoeractie en runstatus

Een bevoegde Jupiter-payrollbeheerder moet de echte werkgeversbeschikking/werkgeversbesluiten gebruiken in **Payroll → Instellingen → Werkgeversconfiguratie** om de ontbrekende waarden, geldigheidsperiode en bronreferentie vast te leggen. Dezelfde beheerder moet voor Frits in **Openingscumulatieven** een controleerbare betaalde loonbron en bronperiode kiezen en de zeven cumulatieven daaruit invoeren. Gebruik geen persona-assignment, concept-run, schatting of aangenomen nullen. Een pensioenbeheerder moet de PFZW-salarisbasis vanuit de toepasselijke regeling/werkgeversbron als ondersteunde opvolgerversie vastleggen; geen methode of deelname veronderstellen.

Er is **geen nieuwe november-run** aangemaakt of teruggelezen; er ontstond dus geen dubbele run. De bestaande lijst had geen Frits-novemberrun. Bruto, werknemers-/werkgeverspensioen, loonheffing, netto en werkgeverskosten konden daarom niet worden uitgelezen. Er is niets gefinaliseerd. Bij de eerste herstelpoging waren geen configuratie- of openingsbalansformulieren opgeslagen; de follow-up heeft alleen de hieronder genoemde werkgeversconfiguratie-DRAFT opgeslagen.

## Mercurius — aparte selectorbevinding

De geautoriseerde administratiekeuze en `Instellingen → Bedrijfsstructuur` tonen voor deze identiteit alleen actieve, bereikbare HR-groep **Planeten** met **Jupiter BV** en **Mars BV**. De selector wordt uit de actieve tenant-, HR-groep-, administratie- en grantscope opgebouwd; `business-structure` krijgt dezelfde `context.hrGroups`. Mercurius zit niet in deze huidige bereikbare context. Deze UI kan niet onderscheiden of de canonieke Mercurius-rij inactief is, bij een andere HR-groep/tenant hoort of buiten de bestaande actor-grant valt. Daarom is geen selector-/toegangswijziging gedaan. De normale vervolgstap is een bevoegde tenantbeheerder de status, HR-groep en bestaande actor-scope van de Mercurius-rij laten controleren.

## Verificatie

- Gerichte Payroll-suite (bronprovider, cycle service/model, workbench, bounded query loader, actual-work, tax-profile en CAO-BENCH02 service/UI): **11 bestanden, 83 tests geslaagd**.
- TypeScript `tsc --noEmit`: **geslaagd**.
- ESLint gewijzigde bestanden: **0 fouten**, één bestaande ongebruikte `PayrollSetupRepository`-importwaarschuwing.
- i18n: **43 NL/EN-namespaceparen gelijk**; `git diff --check`: **geslaagd**.
- Payroll-rules package tests: **niet uitgevoerd** — Vitest faalde vóór testcollectie met Windows `EPERM` bij tijdelijke directory-renames (6 suites, 0 tests). Geen tweede retry.
- Geauthenticeerde browser-readback via de HR Admin-sessie op `http://127.0.0.1:3010`: Jupiter-scope, Payroll-instellingen, werkgeverconfiguratie, Frits-diagnostiek, PFZW-toewijzing/-mapping/-versie 1 en de Mercurius-keuze zijn opnieuw bekeken. De werkplek toont november OPEN, geen Frits-run en vier afzonderlijke bronfouten met bovengenoemde correlatie-ID. Er is geen conceptberekening ingediend. Er is geen configuratie-, openingsbalans- of opvolgerversieformulier opgeslagen.

## Onafhankelijke scenario's

De gerichte CAO-BENCH02-, CAO_SCALE-, PFZW- en werkgeversconfiguratievalidatietests bleven onderdeel van de onafhankelijke scenario-gates; het ontbreken van Frits' betaalde openingsbron blokkeert hun codeontwikkeling niet. De bestaande payroll-regelengine is niet aangepast met verzonnen PFZW-, fiscale of werkgeverswaarden. Dit herstel sluit de aparte scenario's niet af.

## Follow-up PAYROLL-FRITS-CLOSE-01 (2026-10-20)

### A. Jupiter werkgeversconfiguratie — gedeeltelijk opgeslagen via Payroll → Instellingen

- HR Admin heeft Conceptversie 1 opgeslagen voor 2026-01-01 t/m 2026-12-31; readback-hashprefix `c39cee3b1429…`. Deze versie is niet geactiveerd.
- Onderbouwde readback: Wko `0,5000%`, werkgeversheffing Zvw `6,1000%`, vakantiegeld `8,0000%`, eindejaarsuitkering van toepassing `ja`, `8,0000%`. Bronreferentie noemt Belastingdienst Cijferbijlage 2026 en CAO Kinderopvang 2025–2026 art. 5.7 en 6.1.
- De componentenset is al actief en geselecteerd: `NL-PAYROLL-2026:2026.1+PAYRUN01-CUSTOMER_STANDARD-2026.2+PARTIAL-PERIODS-2026.1+PAYFULL02-CUSTOMER_STANDARD-NET-EMPLOYER-2026.3`.
- Nog verplicht uit echte werkgeversbronnen: sectorcode en werkgeversclassificatie uit de Belastingdienst-registratie/beschikking; de beschikking gedifferentieerde premie Whk 2026; de werkgeversgrootteberekening op basis van de fiscale loonsom 2024; de gekozen Aof-/AWf-classificaties en bijbehorende percentages; de toepasselijke Zvw-klasse; en een gedocumenteerde werkgeverskeuze voor de pensioen-deelmaandmethode. Voor AWf-classificatie van Frits is ook het ondertekende contract nodig om duur/on-call-status te beoordelen. Geen WHK-beschikking, werkgeversbesluit of classificatie verzonnen.
- De opgeslagen DRAFT blijft geblokkeerd zolang die velden en geldige bronreferenties ontbreken. De persoonlijke fiscale gegevens, IKV en het dienstverband van Frits gaven in de bronworklist geen gap.

### B. Frits openingscumulatieven — terecht geblokkeerd

- v310 (peildatum 2026-09-30) en v309 (2026-08-31) blijven ongeldig: beide hebben geen bronperiode en noemen `PAYRUN01 TEST PERSONA ASSIGNMENT`. Er is geen openingsversie aangemaakt of geannuleerd; de normale UI toont geen archieffunctie en accepteert geen geschatte of impliciete nulwaarden.
- De personecatalogus noemt eerdere runs, waaronder een run als FINALIZED, maar de controleerbare cumulatieven konden niet worden teruggelezen: de detail-/artifactread faalde met `PAYROLL_INPUT_INVALID` in `loadLifecycleEvidence`. Andere zichtbare runs zijn CONCEPT. Daardoor is niet vastgesteld of er vóór november betaald loon was en is de nul-openingsroute niet feitelijk gerechtvaardigd. Frits startte al op 2026-09-01; de beperkte synthetic zero-baseline voor september is geen ondersteunde novemberroute.
- Benodigd: een echte loonstaat/loonstrook of andere gecontroleerde payrollbron van de afgesloten betaalde perioden t/m 2026-10-31, met bronperiode en de zeven cumulatieve velden. Als er werkelijk geen loon betaald is, is een controleerbare werkgeversbevestiging nodig; de huidige workflow biedt voor deze septemberstarter geen algemene november-nulroute. De ongeldige v309/v310 kunnen pas via een geldige, geauditeerde opvolgerversie worden opgevolgd.

### C. PFZW — foutieve SQL-permission-check geïdentificeerd; opvolger nog niet opgeslagen

- Bestaande PFZW-toewijzing, CAO→PFZW-mapping en historische versie 1 zijn intact gebleven. Versie 1 bevat de bestaande aparte `PFZW_OP_NP_2026`- en `PFZW_WIA_EXCEDENT_2026`-componenten; er is geen versie 2/readback.
- De geautoriseerde editor roept `create_pension_arrangement_successor` aan. De app-service vereist `pension:manage`, en de parallelle pension-assignment-RPC bevestigt dezelfde scope met `pension:manage`. De versioning-RPC eiste ten onrechte `contract:write`, waardoor deze write exact `PENSION_ARRANGEMENT_SUCCESSOR_FORBIDDEN` teruggaf (correlatie-ID `0ab08eea-18cb-4993-9606-67e34e34b905`). Dit is een permission-contractprogrammeurfout, geen ontbrekende pensioenmapping of reden om HR-scope te verbreden.
- Forward migration `20261020201028_pension_arrangement_successor_permission.sql` vervangt alleen die permission-check door `pension:manage` en behoudt authenticated actor, HR-groep-, administratie-/tenant-scope, voorgangerversie, auditinserts, immutability en EXECUTE-grants. De migration staat lokaal en is **niet toegepast**; er is geen remote schemawijziging gedaan. Daarom kon de normale editor de getypeerde `pfzw2026`-opvolger nog niet bewaren. Geen juridische validatiestatus gefingeerd.
- Bij het gereedkomen van de editoropslag moeten de ondersteunde typevelden voor de PFZW-2026-salarisbasis en structurele CAO-toeslagen worden gebruikt, maar uitsluitend met een vastgelegde bron en effectieve periode. De bestaande pensioencomponenten en toewijzingen blijven behouden.

### Run-, test- en autorisatiegrens

- Payroll-overzicht toont alleen recente oktober-runs; er is geen novemberrun voor Frits. Er is geen concept berekend, er zijn geen brutobedragen, pensioenbedragen, loonheffing, netto of werkgeverskosten om terug te lezen. Geen dubbele run, finalisatie, betaling of aangifte.
- Geauthenticeerde HR Admin-browser op `http://127.0.0.1:3010` bevestigde Jupiter, de werkgevers-DRAFT-readback, ontbrekende verplichte velden en de PFZW-successorweigering. De bestaande cao-regel en werkgevers-/HR-scope zijn niet opnieuw ingericht.
- Persona-preflight: statische persona-/role-switchcontroles geslaagd; runtime en persona-credentials BLOCKED omdat de centrale lokale TEST-configuratie ontbreekt. Er zijn geen alternatieve credentials aangemaakt. De reeds geauthenticeerde HR Admin-sessie is apart gebruikt voor de hierboven vermelde UI-readbacks.
- Lokale gerichte tests: **4 bestanden, 18 tests geslaagd** (waaronder de permission-regressietest). Typecheck: **geslaagd**. ESLint voor gewijzigde TS/TSX-bestanden: **geslaagd**. i18n: **43 NL/EN-namespaceparen gelijk**. `git diff --check`: **geslaagd**. Database-/migratie-integratie en opslag van de PFZW-opvolger zijn niet uitgevoerd, omdat de migration niet op TEST is toegepast. Geen merge of deployment.

### Aparte Mercurius-selectorbevinding

De administratiekeuze in dezelfde geauthenticeerde context bevat Jupiter en Mars, maar geen Mercurius. Er is geen selector- of scopewijziging gedaan. Een bevoegde tenantbeheerder moet de canonieke Mercurius-record controleren op actieve status, tenant/HR-groep en bestaande actor-grant. Dit blokkeert Frits in Jupiter niet.

## PAYROLL-FRITS-ACCEPTANCE-01 (2026-10-20)

**Status: PARTIAL.** Jupiter werkgeversconfiguratieversie 5 is via de normale HR Admin-UI actief en teruggelezen. De bestaande Kinderopvang CAO_SCALE-salarisregel is behouden. Geen Frits-novemberrun is gemaakt. De normale openingsbalansworkflow weigerde de nieuwe invoer wegens een bestaande loonrun vóór de openingsdatum; de getypeerde PFZW-opvolger blijft afhankelijk van afzonderlijke toestemming voor de Core TEST-migratie. Er is niets gefinaliseerd, betaald, aangegeven, gemerged of gedeployed.

### Werkgeversconfiguratie — opgeslagen en actief

- Geauthenticeerde lokale HR Admin-context: Maya, administratie Jupiter BV, op `http://127.0.0.1:3010/payroll/settings`.
- Configuratieversie **5**, status **Actief**, geldig 2026-01-01 t/m 2026-12-31; hashprefix `25049ea23eb6…`. Het formulier en de versietabel tonen dezelfde inhoud.
- Expliciet synthetisch testprofiel: sectorcode 35; fictieve premieloonsom 2024 €950.000 (klein); AWf hoog 7,74%; Aof klein 6,27%; Wko 0,50%; Zvw-werkgeversheffing 6,10%; illustratief Whk-profiel 1,52% met referentie `ACCEPTANCE-WHK-JUPITER-2026-A` (geen afgegeven beschikking); vakantiegeld 8%; eindejaarsuitkering van toepassing, 8%; pensioen-deelmaandkeuze `CALENDAR_DAYS_PRO_RATA` als expliciete testwerkgeverskeuze.
- Bestaande componentenset behouden: `NL-PAYROLL-2026:2026.1+PAYRUN01-CUSTOMER_STANDARD-2026.2+PARTIAL-PERIODS-2026.1+PAYFULL02-CUSTOMER_STANDARD-NET-EMPLOYER-2026.3`.
- De wettelijke 2026 percentages voor AWf/Aof/Wko, werkgeversgrootte en de Belastingdienst-maandtabel zijn ontleend aan de [officiële cijferbijlage 2026](https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf). De Whk, sector, grootte en maandmethode zijn uitsluitend fictieve acceptatiekeuzes en bewijzen geen Jupiter-werkgeversfeit.

### Openingscumulatieven — normale UI weigert opslag

- Frits' ongeldige openingsversies **v309** (2026-08-31) en **v310** (2026-09-30) zijn ongewijzigd. De normale HR Admin-invoer is één keer geprobeerd met een transparant synthetische septemberbaseline als openingsdatum 2026-10-01; de UI gaf `PAYROLL_OPENING_BALANCE_EXISTING_RUN_CONFLICT` / `OPENING_EXISTING_PAYROLL_RUN_CONFLICT`. Er is geen v311 aangemaakt. De guard constateert een bestaande eerdere loonrun; deze controle is niet omzeild.
- De kandidaatbaseline was uitsluitend bedoeld als synthetische testinvoer, niet als bewijs van betaling of als nagebootste FINALIZED-run: bruto €3.044,44; fiscaal/SV/Zvw-loon €2.763,83; loonheffing €292,75; vakantiegeld- en eindejaarsreserve elk €243,56. Onderbouwing: eerder vastgelegde 32/36- en €3.425,00-salarisbasis, PFZW-synthetische preview en de officiële witte maandtabel 2026 (rij tabelloon €2.763,00 → €292,75 bij loonheffingskorting). De actuele officiële tabel ondersteunt de belastingrij: [Belastingdienst witte maandtabel 2026](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf). De kandidaat is niet opgeslagen en is geen actueel openingssaldo.
- De Payroll-runlijst bevat bestaande Frits-runs voor september/oktober; onder meer oktober-run `338ef391-fbf6-435a-a4d7-e28a8024ebc2` is historisch als FINALIZED vastgelegd en blijft ongemoeid. De UI-detailroute voor die run faalde met een generieke Next.js-serverfout (digest `3027443242`). Veilige serverdiagnostiek toont `SyntheticPayrollServiceError` / `PAYROLL_INPUT_INVALID` vanuit `loadLifecycleEvidence`; daardoor zijn de bedragen/cumulatieven van die bestaande run niet via de normale detailreadback beschikbaar. Er zijn geen ruwe databasefouten of persoonsgegevens in de UI toegevoegd.

### PFZW en novemberrun

- De bestaande Frits-deelname, CAO→PFZW-toewijzing en historische PFZW-versie 1 blijven behouden. De worklist blokkeert op `PENSIONABLE_SALARY_DEFINITION_UNSUPPORTED`: de effectieve regeling heeft geen getypeerde `pfzw2026`-definitie.
- Projectcontrole via Supabase: **Core TEST** is project `LiquidHR`, ref `wnpfloqpjvaacobppbpk`, regio `eu-west-3`; **Payroll Lab** is een afzonderlijk project, ref `jhgeriucbkfarxiudzfy`. Migratie `20261020201028` staat in geen van beide migratiehistorieën. De lokale migration eist `pension:manage` en behoudt actor-, HR-groep-, administratie-/tenant-scope en audit. Zij is niet toegepast; de eerder gevraagde afzonderlijke toestemming is nog niet ontvangen.
- HR Admin Payroll-worklist toont november 2026 als OPEN en Frits geblokkeerd op `PAYROLL_OPENING_CUMULATIVE_MISSING`, `PAYROLL_OPENING_CUMULATIVE_INVALID` en `PENSIONABLE_SALARY_DEFINITION_UNSUPPORTED`, correlatie-ID `8ef79fab-10fd-4ec2-82dc-107a6284ae15`. De werkgeversbron is niet meer een blocker. Geen novemberrun is ingediend; dus geen duplicaat of resultaat-readback. De vier eerdere zondaguren zijn niet overgenomen.
- Concreet nodig voor voortzetting: (1) gecontroleerde cumulatieven uit de bestaande voorafgaande loonruns via een werkende geautoriseerde detailreadback, of een ondersteunde geauditeerde aansluitingsworkflow die die runs meeneemt; (2) afzonderlijke toestemming voor toepassing van de migration op Core TEST zodat de normale pensioeneditor de getypeerde opvolger kan opslaan. Geen FINALIZED-mutatie, betaling of aangifte.

### Lokale checks en scope

- Canonieke TEST-runtime en persona-preflight slaagden toen de launcher tijdelijk naar Edwin's bestaande Windows-`LOCALAPPDATA` wees; configuratie en credentials zijn niet geopend of getoond. Bestaande Next.js Development-server van deze worktree draaide al op 3010; een tweede start op 3011 werd door de bestaande Next dev-lock geweigerd en de server is niet gestopt.
- De actieve `payroll-setup`-codewijziging maakt werkgeversconfiguratie-activatie append-only, in lijn met de immutable tabelgrants. De bestaande DRAFT blijft behouden, de actieve opvolger wordt als nieuwe versie ingevoegd en exact gelijke actieve versies zijn idempotent. Gerichte regressietest staat in `payroll-setup-service.test.ts`.
- De eerdere aparte Mercurius-selectorbevinding blijft staan zoals hierboven geregistreerd; geen selector, administratie- of actor-scope is gewijzigd.
