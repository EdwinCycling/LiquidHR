# WVP-FUNCTIONAL-COMPLETION — 19 november 2026

## Verdict

**Lokale WVP-code en gerichte checks: PASS. End-to-end functionele acceptatie: PARTIAL/OPEN.** De volledige gerichte WVP-regressiesuite slaagt, maar de bestaande PMUX-werkvoorraaddeadline kan bij een weekend/erkende feestdag eerder verlopen dan de zichtbare UWV-standaardmeldwerkdag. Hosted personaacceptatie is deze run niet herhaald. De bestaande PMUX-flow blijft de procesengine; WVP02 SEC01 en WVP05 zijn volgens de readback van 13 november al op Core TEST toegepast en zijn niet herhaald. Deze run deed geen live TEST-writes, migratie, push, merge of deployment.

| Gegeven | Waarde |
| --- | --- |
| Baseline | `69d29bbe80a5791cf31c1d4966347f756cd10130` |
| Branch | `work/wvp-functional-completion-20261119` |
| Lokale commit | Dit rapport hoort bij de lokale oplevercommit; de exacte SHA staat in de eindrapportage. |
| TEST-kandidaat | `https://liquidhr-r82s3zcwc-edwinitsolutions.vercel.app` (alleen-lezen bekeken; deze branch is niet uitgerold) |

## Geleverd

- De casuswerkplek, persoonlijke werkkaart en het regieoverzicht gebruiken voor week 42 een voorbereidingssignaal op basis van de effectieve verzuimklok. Ze tonen daarnaast apart de berekende standaard UWV-meldwerkdag. Week-42-urgentie en prioriteit volgen het voorbereidingssignaal.
- De mijlpaalstatussen `OPEN`, `COMPLETED` en `CANCELLED` zijn als afzonderlijke voortgangsteller zichtbaar. Geannuleerde taken tellen niet mee als open, verlopen of binnenkort vervallend.
- Bekende WVP- en documentkoppelfouten krijgen begrijpelijke NL/EN-meldingen. De bestaande privacygrens en vaste keuzevelden blijven van kracht; er is geen medisch veld, medische vrije tekst of medische documentcategorie toegevoegd.
- PGlite-dekking bewijst transactionele terugrol van taak, gebeurtenis, audit en PMUX-act bij een kernelerror, sluiting met annulering van resterende taken en opnieuw koppelen van dezelfde documentrelatie na ontkoppeling met aparte audit.
- De WVP-requirement, roadmap, huidige status en openpunten verwijzen naar deze kandidaat. Historische acceptance-rapporten zijn ongewijzigd gelaten.

## Wettelijke datumhulp week 42

De [UWV-richtlijn voor de 42e-weeksmelding](https://www.uwv.nl/nl/ziek/re-integratie/42e-weeksmelding) zegt dat de melding uiterlijk op de eerste werkdag na 42 ziekteweken binnen moet zijn. De projectie gebruikt de effectieve verzuimklok, neemt de kalendergrens op `+294` dagen en schuift een weekend of herkende feestdag door naar de eerstvolgende werkdag. Het voorbereidingssignaal ligt 14 kalenderdagen voor die datum.

Dit is een operationele standaarddatum, geen volledige wettelijke beoordeling en geen verzending naar UWV. De gebruiker moet opgebouwd ziekteverzuim en uitzonderingen handmatig beoordelen, waaronder samengestelde ziekteperioden en situaties rond zwangerschaps- en bevallingsverlof; zie [UWV over ziekteperiodes optellen](https://www.uwv.nl/nl/ziek/ziekteperiodes-optellen). Voor het plan van aanpak blijft de bestaande vroege grens van twee weken na de probleemanalyse of uiterlijk week 8 leidend volgens [UWV](https://www.uwv.nl/nl/ziek/loondoorbetaling/plan-van-aanpak).

## Acceptatiematrix

| Persona / grens | Lokale contractdekking | Hosted bewijs in deze run |
| --- | --- | --- |
| HR Admin — lezen, processtart, mijlpaalactie, afsluiten | PGlite WVP01/WVP02-contract: toegestane start is idempotent; mijlpaalactie en afsluiting gebruiken de bestaande PMUX-transactie. Na herstelvenster worden resterende toekomstige taken geannuleerd. | NOT RUN. Kandidaat alleen-lezen bekeken; ingelogde rol/persona niet vastgesteld. |
| Manager — eigen directe team, toegestane taakactie, geen processtart | PGlite WVP01/WVP02-contract: teamcasus read/write positief; vreemde teamscope en START geweigerd. Manager zonder `process-task:act` kan geen mijlpaal voltooien. | NOT RUN in deze run. Eerdere handoff bewijst beperkte lokale/hosted reads en directe START-weigering, niet de volledige matrix. |
| Employee — eigen dossier en eigen kennisname, geen beheeracties | PGlite WVP01/WVP02-contract: self-only read/acknowledgement; START, andere medewerker en beheermutaties geweigerd. | NOT RUN in deze run. Eerdere handoff bevestigde eigen dossier en ontbreken van documentbeheeracties. |
| Andere medewerker, administratie, HR-groep en tenant | Directe publieke RPC-contracttests weigeren scopevervalsing zonder gedeeltelijke mutaties. WVP05-test controleert documentmedewerker, administratie, groep en tenant apart. | NOT RUN. Geen directe HTTP/JWT-proef of echte persona-switch uitgevoerd. |
| Documentrechten | WVP05-PGlite-test: bevoegde HR Admin/Manager kan alleen binnen beschikbare documentrechten koppelen; Employee leest uitsluitend eigen toegankelijke relatie; ontkoppelen verwijdert de bron niet; opnieuw koppelen maakt een nieuwe actieve relatie en auditrij. | NOT RUN in deze run. Historische positieve HR Admin-link/unlink is gedocumenteerd in de handoff van 13 november. |
| Medische privacy | RPC-, database- en UI-contracten weigeren medische vrije tekst; WVP05 bewaart alleen relatie-ID's en auditmetadata. | Geen medische gegevens ingevoerd of gelezen. |

## Uitgevoerde controles

| Controle | Resultaat |
| --- | --- |
| Gerichte WVP-domein-, service-, procesdefinitie-, UI-, statuslabel-, dossier- en PGlite-contracttests — 10 bestanden | **PASS — 81/81** |
| TypeScript `tsc --noEmit` | **PASS** |
| ESLint op gewijzigde WVP TypeScript-/TSX-bestanden | **PASS** |
| `check:i18n` | **PASS — 43 namespaces, NL/EN-sleutels gelijk** |
| `git diff --check` | **PASS** |
| Volledige HR Suite-testset | **NOT RUN** — deze run draaide de complete gerichte WVP-regressieset, geen releasegate voor de volledige applicatie. |
| Build en lokale geauthenticeerde browserflow | **NOT RUN** — er is geen geïsoleerde WVP-runtime/persona in deze worktree ingericht; canonical configuratie is niet gelezen of gekopieerd. |
| Hosted persona/API/RLS-acceptatie en live fixtures | **NOT RUN** — rol in de kandidaatbrowser was niet verifieerbaar; geen live TEST-mutaties uitgevoerd. |
| Nieuwe migratie, advisors, gegenereerde DB-types, deployment | **NOT RUN** — geen schemawijziging of afzonderlijk GO. |

Dependency-installatie waarschuwde dat huidige Node `22.14.0` lager is dan de engine-eis `^22.17.0` van `@sparticuz/chromium`. De uitgevoerde tests, typecheck, lint en i18n-controle slaagden; een productiebuild is niet uitgevoerd.

## Gedeelde PMUX-afhankelijkheid

De bestaande `wvp_materialize_deadline`-trigger leest de opgeslagen taakdatum (`effective_clock_start_on + 294`) en zet de PMUX-deadline op middernacht na die datum. De nieuwe WVP-schermprojectie schuift een kalendergrens die op weekend/erkende feestdag valt door naar de eerstvolgende werkdag. In dat randgeval kan de generieke PMUX-werkvoorraad dus eerder verlopen dan de zichtbare UWV-standaarddatum.

Voorstel voor een aparte forward-only migratie, **niet voorbereid of toegepast**: wijzig alleen de WVP-week-42-deadlinematerialisatie zodat nieuwe PMUX-stappen dezelfde standaardwerkdagprojectie gebruiken; behoud reeds geactiveerde immutable PMUX-snapshots; voeg weekend-/feestdag-, effective-clock-, idempotentie- en transactiecontracttests toe. Voor de volledige shared-kalenderbetekenis en centrale toepassing is afzonderlijk GO nodig. De contractafwijking is overgedragen aan de centrale thread **Integreer WVP en Talent definitief** (`01a1bc87-0b2d-7892-81f4-a9a73fec375c`).

## Data en resterende acceptatie

Nieuwe taaklifecycle- en documentgevallen gebruiken geïsoleerde PGlite-testfixtures; week-42-datums gebruiken pure kalenderunitfixtures. Niets is geschreven naar Core TEST. De eerder gerapporteerde WVP02 SEC01- en WVP05-toepassing in Core TEST is hergebruikt als historische readback en niet opnieuw gecontroleerd.

**Resterend:** echte HR Admin/Manager/Employee-sessies, directe authenticated API/RPC-negatives over andere medewerkers/administraties/HR-groepen/tenants, actuele documentrechten, herhaalde hosted link/unlink/relink-audit en het gedeelde PMUX-week-42-contract na een apart migratie-GO. De lokale checks zijn groen; volledig end-to-end en hosted acceptatie blijven PARTIAL/OPEN.
