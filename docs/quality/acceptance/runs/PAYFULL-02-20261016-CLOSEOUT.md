# PAYFULL-02 — gecontroleerde TEST-closeout 2026-10-16

## PAYFULL-02C hercontrole — 2026-10-16

- De meegeleverde PAYFULL-02C-hercontrole meldt **nul** `payroll_individual_artifacts`-records voor de twee onderstaande FINALIZED-run-ID's. Dat botst met de artifact-ID's en hashes die in de eerste closeout zijn vastgelegd. Die eerdere metadata blijven hieronder behouden als historisch gerapporteerde uitkomst, maar gelden niet als actuele, bevestigde persistentie-readback zolang de botsing niet via de normale geautoriseerde Payroll-route is opgelost.
- De in-app browser weigerde de lokale `127.0.0.1:3022`-pagina te observeren via haar URL-beleid. Er is geen alternatieve browser-, CDP- of directe database-route gebruikt om die acceptatie te omzeilen. Daardoor zijn de opgeslagen bytes, PDF-inhoud, retry-idempotentie en ESS-self-/negatieve-readback in deze hercontrole **niet geverifieerd**.
- De ACL-beschermde lokale runtimeconfiguratie slaagde eerder voor de canonieke preflight, maar deze hercontrole heeft DEMO-002 niet geprovisioneerd of ingelogd. Bestaande DEMO-001-identiteit en -rechten zijn niet gewijzigd.
- De route `/api/local/personas/provision` is aanvullend fail-closed gemaakt voor DEMO-002: naast geverifieerde identiteit en exacte Mars-scope vereist de route nu dezelfde vaste HR Admin-identiteit die de Core-link-RPC autoriseert. De alternatieve Mars-admin wordt vóór Auth-creatie geweigerd. Gerichte route-tests, TypeScript en ESLint slagen; live autorisatie-/browseracceptatie blijft open.

- Status: **PARTIAL**. De twee gecontroleerde Mars-runs zijn volledig berekend, REVIEWED en FINALIZED; de volledige live ESS-/privacyacceptatie en leesbare PDF-contentreadback zijn niet aangetoond.
- Branch/PR: `work/PAYFULL-01-20261014`, Draft PR #33. Geen merge, deployment, aangifte of bankbetaling.
- Exacte implementatie- en buildcode: `9df1187a3bcd5a4b703bda37021f6dfa7742f015`. De latere delta wijzigt alleen de lokale migratiebestandsnaam/testverwijzing en documentatie; de SQL-inhoud/runtimeberekening is niet veranderd.
- Core TEST: `wnpfloqpjvaacobppbpk`; Payroll Lab TEST: `jhgeriucbkfarxiudzfy`.

## 1. Twee definitieve Mars-berekeningen

| Medewerker / run | Bruto | Werknemerspensioen | Fiscaal loon | Loonheffing | Nettovergoeding | Nettoloon |
|---|---:|---:|---:|---:|---:|---:|
| DEMO-001 / `731e2a73-af7c-59d6-af88-5d0455c68374` | €3.517,00 | €191,93 | €3.325,07 | €1.188,58 | €45,00 | **€2.181,49** |
| DEMO-002 / `48f47ffd-191c-5cbb-a22a-9061a2b7e5c3` | €3.534,00 | €251,72 | €3.282,28 | €1.173,42 | €32,50 | **€2.141,36** |

Het nettoloon sluit aan als bruto minus werknemerspensioen en loonheffing plus nettovergoeding. Werkgeverspremies, werkgeverspensioen en reserveringen zijn niet als werknemersinhouding verwerkt. Beide runs zijn door de normale HR Admin-lifecycle gegaan: controles vóór REVIEWED, daarna FINALIZED; elk met **32/32 geslaagde controles**.

| Werkgeverskosten | DEMO-001 | DEMO-002 |
|---|---:|---:|
| AWf hoog | €257,36 | €254,05 |
| Aof laag | €208,48 | €205,80 |
| Whk | €60,18 | €59,41 |
| Wko | €16,63 | €16,41 |
| Werkgeversheffing Zvw | €202,83 | €200,22 |
| Totale werkgeverspremies | €745,48 | €735,89 |
| Werkgeverspensioen | €287,90 | €251,72 |
| Vakantiegeldreservering | €281,36 | €282,72 |
| Nettovergoeding als werkgeversuitgave | €45,00 | €32,50 |
| **Totale werkgeverskosten** | **€4.876,74** | **€4.836,83** |

De vaste extra DEMO-001-revisie `ab47136a-a62f-5866-a0d0-3e74b1f1bff4` bevat €500,00 variabel loon en blijft CONCEPT: bruto €4.017,00, pensioen €241,93, fiscaal loon €3.775,07, loonheffing €1.357,67, netto €2.462,40 en werkgeverskosten €5.592,64.

De oorspronkelijke oktober-CONCEPT-runs `f33294bf-2eea-52d6-ab36-3f740e822a51` en `7034df4f-7dbb-57d5-ba2c-498855092587` en hun hashes/lifecyclehistorie zijn behouden.

## 2. TEST-bronwaarden, geldigheid en cumulatieven

De synthetische setup geldt effectief van 2026-01-01 t/m 2026-12-31 en draagt provenance `TEST_SETUP_PAYFULL_02`. Geen van de pensioen- of Whk-invoer beweert een echt fondscontract of echte werkgeversbeschikking.

| Parameter | DEMO-001 | DEMO-002 | Bron/herkomst |
|---|---:|---:|---|
| Contractloon / deeltijd | €3.517,00 / 1,0 | €3.534,00 / 1,0 | Synthetische Mars-dienstverbanden en periodieke TEST-brondata |
| Pensioenfranchise | €19.172/jaar; €1.597,67/maand | Zelfde | TEST-planversie; maandfranchise op cent afgerond |
| Pensioenmaximum | €137.800/jaar; €11.483,33/maand | Zelfde | TEST-planversie; niet bereikt |
| Pensioengrondslag | €1.919,33 | €1.936,33 | Bruto minus maandfranchise |
| Totale pensioenpremie; werknemer/werkgever | 25%; 10% / 15% | 26%; 13% / 13% | Verschillende synthetische planversies |
| AWf-classificatie | Hoog, 7,74% | Hoog, 7,74% | Contractaanname; percentage Belastingdienst 2026 |
| Aof-classificatie | Laag, 6,27% | Laag, 6,27% | Synthetische kleine-werkgeverclassificatie; percentage Belastingdienst 2026 |
| Whk | 1,81% | 1,81% | Synthetische TEST-beschikkingaanname |
| Wko | 0,50% | 0,50% | Belastingdienst 2026 |
| Werkgeversheffing Zvw / maximum | 6,10% / €79.409 | Zelfde | Belastingdienst 2026; maximum niet bereikt |
| Vakantiegeld / overige reservering | 8% / 0% | 8% / 0% | Synthetische werkgeversconfiguratie |
| Loonheffingstabel | Wit, NL, onder AOW, LHK uit | Zelfde | Witte maandtabel 2026; bijzondere-beloningstabel apart versioned |
| Nettovergoeding | €45,00 | €32,50 | Synthetische variabele TEST-invoer |

Voor januari-september is een afzonderlijke gehashte TEST-openingsbalans gebruikt op basis van negen maandbronsnapshots; er zijn geen gefingeerde historische FINALIZED-runs aangemaakt. Aansluiting in oktober:

| Cumulatief | DEMO-001 opening + oktober = nieuw | DEMO-002 opening + oktober = nieuw |
|---|---:|---:|
| Bruto | €31.653,00 + €3.517,00 = €35.170,00 | €31.806,00 + €3.534,00 = €35.340,00 |
| Fiscaal/SV/Zvw-loon | €29.925,63 + €3.325,07 = €33.250,70 | €29.540,52 + €3.282,28 = €32.822,80 |
| Loonheffing | €10.697,22 + €1.188,58 = €11.885,80 | €10.560,78 + €1.173,42 = €11.734,20 |
| Vakantiegeldreservering | €2.532,24 + €281,36 = €2.813,60 | €2.544,48 + €282,72 = €2.827,20 |

De onafhankelijke vaste oracle importeert geen payroll-engine of rule package. De loonheffing is vergeleken met de officiële [Belastingdienst witte maandtabel 2026](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf); pensioen-, Whk- en cumulatieve TEST-waarden zijn eigen, expliciete scenario-invoer. De [Cijferbijlage 2026](https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf) en het [Handboek Loonheffingen 2026](https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf) staan als onderbouwing bij de oorspronkelijke [PAYFULL-02 run-evidence](PAYFULL-02-20261015.md).

## 3. Hashes, trace en PDF-artifacts

| Run | Source hash | Input hash | Result hash |
|---|---|---|---|
| DEMO-001 `731e2a73-af7c-59d6-af88-5d0455c68374` | `0c7d2c519ff230bd06e77a361fa920983c18235c4c8aacf9685f1495bca4e571` | `ebe480708e1e2fa51b9c898b353dfa9e4668d3909d3e8f7c0dc843b05884919c` | `8e990f74cca21c2b500958757d2dea426237e14e47cf6b34952303acef4058c5` |
| DEMO-002 `48f47ffd-191c-5cbb-a22a-9061a2b7e5c3` | `202fc2dd37b989e1871e83d9944c64949c05a0b46cce4e42a96f8ac50d2250d0` | `5ada019bf722da383c119fb4631efbf3fc47b1abbb81bb1ffb3d3f8bff999ff7` | `667a40a57a14e13903214a807a93fbfe5b3270ad70529d4ff96103c72477fd0a` |

De eerste PAYFULL-02-closeout rapporteerde voor beide FINALIZED-runs een gebonden PDF-artifactrecord met SHA-256. De PAYFULL-02C-hercontrole hierboven meldt nul records voor deze run-ID's. Onderstaande waarden zijn daarom uitsluitend de eerder gerapporteerde metadata en geen bewijs van de huidige opgeslagen staat:

| Run | Artifact ID | Grootte | PDF SHA-256 |
|---|---|---:|---|
| DEMO-001 | `cc3066c6-dd1d-4fc4-8503-8bdf3fa2c673` | 513.704 bytes | `6d1499151d79ea1ea470dfe5bac1a73b0cecbd34a3ae41ded48acefefe108a2b` |
| DEMO-002 | `94cc630b-f8f0-4085-99ce-3126bcce893d` | 513.406 bytes | `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977` |

De normale PDF-endpoints antwoordden volgens de eerste closeout eerder HTTP 200 met `application/pdf`; de nieuwe tegenstrijdige nul-rijenmelding maakt actuele persistentie nog onbewezen. Er was geen visuele/tekstuele inhoudscontrole van de bytes en geen PDF-download via een Employee-sessie. De run-detailtrace, componenten, controles en cumulatieven staan op runniveau; de oorspronkelijke evidence bevat aanvullende configuratie- en tracegegevens.

## 4. Migratie en autorisatie

Core TEST registreert migratie `20261016065512_payfull02_demo002_employee_persona_link`. De lokale migratiebestandsnaam is hiermee uitgelijnd; SQL-inhoud is gelijk gebleven. Het auditveld `migration: 20261016064505` blijft als oorspronkelijke source-generation-markering staan; het wijzigt de geregistreerde migratieversie niet. De persoonslink-functie gebruikt een lege `search_path`, vaste Mars-tenant/groep/administratie en exacte employee/employment/actor/target-identiteiten, controleert HR Admin-scope en `salary:write`, schrijft auditprovenance, en grant `EXECUTE` uitsluitend aan `authenticated` (niet `PUBLIC`, `anon` of `service_role`). De PGlite-migratiecontracttests controleren de begrenzing.

De Supabase security advisor signaleert de nieuwe authenticated `SECURITY DEFINER`-functie als waarschuwing. Dit is een relevante advisor-uitkomst, ook al zijn `anon`/`PUBLIC` uitgesloten en is de functie strikt begrensd; deze closeout verzwijgt die waarschuwing niet. Geen RLS- of autorisatiebypass is gebruikt.

## 5. Tests en build

- Finale relevante Payroll-suite, serieel en met verhoogde timeout om de eerdere PGlite/PDF-timeout onder parallelle belasting uit te sluiten: **68 testfiles geslaagd, 3 overgeslagen; 480 tests geslaagd, 3 overgeslagen**.
- Gerichte regressie-/integratiesuites: **4 files / 52 tests geslaagd**. Migratiecontract na bestandsnaamuitlijning: **1 file / 4 tests geslaagd**.
- `npm run type-check`, scoped ESLint en NL/EN i18n-controle (43 namespaces): geslaagd.
- Exacte productionbuild op `9df1187a3bcd5a4b703bda37021f6dfa7742f015`: Next.js 16.4.0 Turbopack, TypeScript en 332 statische pagina's geslaagd; Payroll-client-boundary negative control, 167 assetscan en source/runtimeprovenance geslaagd. Niet-fatale tracingwaarschuwing: dynamische logo-padzoeker in `payrun01-payslip-pdf.ts:156`.
- Geïsoleerde `npm ci` meldde dat `@sparticuz/chromium@149` Node `^22.17.0 || >=24` verwacht terwijl de buildomgeving Node 22.14 gebruikt, en 10 dependency-auditmeldingen (2 moderate, 8 high). Er is geen `npm audit fix` uitgevoerd. De build zelf eindigde succesvol.
- `git diff --check` is vóór commit gecontroleerd; geen test- of buildresultaat is afgeleid uit een skip als pass.

De finale run-detailpagina van DEMO-001 is op Development bij 390×844 gecontroleerd zonder horizontale overflow. Mobiele PDF- en ESS-schermen zijn niet gecontroleerd.

## 6. Open browser- en ESS-acceptatie

Een DEMO-002 Employee-account-/sessie-readback is in deze hercontrole niet uitgevoerd. De ACL-beschermde runtimeconfiguratie slaagde voor preflight, maar de in-app browser blokkeerde observatie van het lokale adres via URL-beleid. Daardoor zijn deze live controles **OPEN**:

- ESS-positive: de medewerker leest uitsluitend de eigen definitieve loonstrook;
- ESS-negative: een andere medewerker krijgt geen PDF-inhoud;
- live Manager/Employee lifecycle-weigering en cross-administration browserprobe;
- PDF-inhoud visueel/tekstueel en PDF/ESS op 390 px.

Er is geen DEMO-002-account buiten het bestaande auditbare linkpad gemaakt, geen credential geraden of aangepast, geen scope verruimd en geen RLS/autorisatie omzeild. De bestaande open items staan in [AA-OPEN](../../../AA/AA-OPEN.md). Daarom is de eindstatus **PARTIAL**, niet volledige end-to-end acceptatie.
