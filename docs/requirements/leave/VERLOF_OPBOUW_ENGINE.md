# Verlof: opbouw-, saldo- en configuratie-engine

Status: **LEIDEND voor de vastgelegde basisregels**

Implementatie: **GEDEELTELIJK — stap 1 t/m 3: databasefundering, pure engine/report en balance/catalog API staan; HR-admin UI en volledige mutatieflows volgen**

Fase: **alleen opbouw en beheer; geen verlofaanvragen**

Vastgelegd: 2026-07-21

## 1. Doel, bron en scope

Dit document is de duurzame bron van waarheid voor de verlof-engine van Liquid HR. Het consolideert de op 2026-07-21 aangeleverde documenten `verlof_opbouw.md`, `verlof_extra_opbouw.md` en `verlof_voorrangsregels_opbouw.md`. De inhoudelijke regels zijn volledig overgenomen en afgestemd op de projectterminologie.

De eerste verticale slice is de HR-adminconfiguratie op **`/settings/leave-accrual`** en de achterliggende opbouw-, saldo-, verval- en projectie-engine. Een verlofaanvraag, accordering, urenbepaling per aangevraagde dag, chatbot-tool en medewerkerselfservice worden **niet** in deze slice gebouwd. Het model wordt er wel op voorbereid.

Een `Employee` mag nul, één of meerdere gelijktijdige `Employment`s hebben. Ieder dienstverband heeft daarom zijn eigen profieltoewijzing, buckets, grootboek en saldo, ook wanneer twee dienstverbanden bij dezelfde administratie horen. Er bestaat nooit een verlofsaldo op persoonsniveau; een latere aanvraag kiest altijd eerst het dienstverband. Buiten de effectieve looptijd van een geldig dienstverband bouwt de engine nooit verlof op en accepteert zij geen opbouwbron.

## 2. Kernprincipes

- Verlofuren worden opgeslagen als `numeric(12,4)`; FTE en opbouwpercentages als minimaal `numeric(12,6)`. Alleen de presentatie formatteert uren later naar uren/minuten.
- Het grootboek is append-only. Opbouw, correctie, verval en toekomstige opname zijn nieuwe transacties; historische transacties worden niet gewijzigd of verwijderd.
- Saldi bestaan uit jaar- en verloftypegebonden buckets. Opbouwjaren worden nooit samengevoegd omdat het verval per bucket wordt afgedwongen.
- Regels, profieltoewijzingen, rooster en dienstverband zijn effective-dated. De bestaande halfopen intervallen `[valid_from, valid_until)` zijn leidend.
- Elke nieuwe tabel bevat tenant- en administratiegrens, RLS, passende indexen, grants en een audittrigger. De server leidt context uit de sessie af.
- De engine is de enige schrijfweg naar buckets en grootboektransacties. UI, import, cron en een latere aanvraagflow gebruiken diezelfde geteste service.
- `employment_schedules` is de bron voor roosteruren en `part_time_factor`, op de dag waarop de berekening plaatsvindt.
- Alleen een goedgekeurde werkurenboeking op een op die dag geldig dienstverband kan `WORKED_HOURS`-opbouw voeden. Planning-, thuiswerk-, locatie-, opleiding- en beursregistraties zijn nooit impliciet gewerkte uren.
- Jaarafsluiting maakt historische jaren onveranderlijk voor automatische opbouw en voorkomt eindeloze herberekening.

## 3. Enums

| Enum | Waarden | Betekenis |
| --- | --- | --- |
| `accrual_basis` | `CONTRACT_HOURS`, `WORKED_HOURS` | Opbouw op rooster/FTE of op geregistreerde gewerkte uren. |
| `accrual_frequency` | `PAYROLL_PERIOD`, `YEARLY` | Opbouw per loonperiode (maandelijks/vierwekelijks) of jaarlijks. |
| `accrual_timing` | `UPFRONT`, `ARREARS` | Beschikbaar aan begin respectievelijk eind van de periode. |
| `leave_type_scope` | `STATUTORY`, `NON_STATUTORY`, `ADV`, `OTHER` | Wettelijk, bovenwettelijk, ADV of overig verlof. |
| `leave_type_entitlement_mode` | `ACCRUAL`, `UNLIMITED`, `ANNUAL_HOURS_CAP`, `WEEKLY_HOURS_FACTOR_CAP` | Opbouw, onbeperkt beschikbaar, vaste jaarlimiet of jaarlimiet op basis van gemiddelde weekuren maal factor. |
| `leave_transaction_type` | `ACCRUAL`, `OPENING_BALANCE`, `MANUAL_ADJUSTMENT`, `TAKEN`, `EXPIRED_DEDUCTION` | Systeemopbouw, migratie-startsaldo, HR-correctie, toekomstige opname en systeemverval. |
| `leave_year_control_status` | `LOCKED`, `ACTIVE`, `OPEN_FOR_FUTURE_REQUESTS` | Afgesloten, lopend, of vooraf geopend voor een toekomstig jaar. |
| `work_hour_type_category` | `REGULAR_WORK`, `OVERTIME`, `INFORMATIONAL` | Gewone gewerkte uren, overwerk of uitsluitend plannings-/informatieve uren. |
| `bonus_trigger_type` | `AGE`, `SENIORITY` | Trigger op geboortedatum of anciënniteitsdatum van het dienstverband. |
| `bonus_award_timing` | `START_OF_YEAR`, `ON_TRIGGER_DATE` | Toekenning op 1 januari of de exacte verjaardag/jubileumdatum. |

## 4. Datamodel

### 4.1 Jaarsturing en verloftypen

`leave_year_controls` bevat per administratie en kalenderjaar een unieke `year` en verplichte `status`. `LOCKED` blokkeert automatische opbouw, handmatige mutaties met een transactiedatum in dat jaar en bevriest iedere opbouwregelversie die in dat jaar geldig was. Een latere opname mag nog steeds een in dat jaar opgebouwd, overgedragen bucket afboeken: de transactiedatum en aanvraagdatum horen dan bij het nieuwe jaar. Alleen `ACTIVE` en `OPEN_FOR_FUTURE_REQUESTS` staan later aanvragen voor dat jaar toe.

`leave_year_rollovers` en `leave_year_rollover_items` leggen de jaarafsluiting immutable vast. Bij afsluiting van jaar `N` maakt de engine per positief resterend bucket een carry-forward-item voor jaar `N + 1`, met minimaal `employment_id`, `leave_type_id`, `source_bucket_id`, `carried_hours` en de oorspronkelijke `expiration_date`. Het item kopieert geen financieel saldo: het originele bucket en grootboek blijven de enige financiële waarheid. Zo toont het volgende jaar bijvoorbeeld een overgedragen saldo van `100h30m` met dezelfde vervaldatum, zonder dubbeltelling in de saldoformule.

`leave_types` definieert een administratiegebonden type met `name`, `color_code`, verplichte `scope`, `is_system`, `is_active`, `is_self_service` en verplichte `entitlement_mode`. Systeemtypen kunnen niet worden verwijderd; een inactief type is niet nieuw te configureren of te kiezen.

Een verloftype heeft precies één rechtvorm:

- `ACCRUAL`: de soort krijgt een saldo via één of meer opbouwregels en buckets.
- `UNLIMITED`: de soort heeft geen saldo, geen opbouw en geen kalenderjaarlimiet; toekomstige aanvragen verbruiken geen bucket.
- `ANNUAL_HOURS_CAP`: de soort heeft geen opbouw, maar wel een configureerbare `annual_hours_cap numeric(12,4)` per kalenderjaar en per dienstverband.
- `WEEKLY_HOURS_FACTOR_CAP`: de soort heeft geen opbouw, maar wel een configureerbare `weekly_hours_cap_factor numeric(12,6)`. De kalenderjaarlimiet is de gemiddelde uren per week van het dienstverband maal deze factor.

Voorbeeld van niet-opbouwsoorten zijn later ziekenhuisbezoek of tandartsbezoek. De jaarlimieten worden pas bij de aanvraagflow afgeschreven en gecontroleerd, maar de configuratie wordt nu al per verloftype vastgelegd. Voor de factorvariant gebruikt die latere flow de relevante effective-dated `employment_schedules.average_hours_per_week`; een wijziging van urenafspraak wordt daarom nooit genegeerd.

#### Werkurentypen

`work_hour_types` is een administratiegebonden, beheersbare catalogus met `name`, `category` en `is_active`. Er zijn drie functionele categorieën:

- `REGULAR_WORK`: gewone gewerkte uren waarop nulurenmedewerkers kunnen boeken; één of meer van deze typen kunnen aan een verlofopbouwregel worden gekoppeld.
- `OVERTIME`: overwerkuren; deze kunnen onafhankelijk van gewone werkuren eveneens aan een verlofopbouwregel worden gekoppeld.
- `INFORMATIONAL`: planning- en locatie-informatie, bijvoorbeeld thuiswerken, op locatie werken, opleiding of beurs. Dit type kan nooit aan een verlofopbouwregel worden gekoppeld en heeft geen invloed op gewerkte uren of verlofsaldo.

`employment_work_hour_entries` registreert de bron per dienstverband: `employment_id`, `work_hour_type_id`, `work_date`, `hours`, goedkeuringsstatus en herleidbare maker/bron. Alleen goedgekeurde `REGULAR_WORK`- en `OVERTIME`-regels zijn voor de engine crediteerbaar. Een entry is altijd aan één dienstverband gekoppeld, zodat parallelle dienstverbanden nooit uren of opbouw delen. Intrekken of corrigeren van een al verwerkte entry maakt een compenserende grootboektransactie; de oorspronkelijke opbouwtransactie blijft staan.

### 4.2 Profielen, regels en uitzonderingen

`leave_profiles` is de administratiegebonden groep, bijvoorbeeld `Vast contract` of `Oproepkrachten`, met een unieke `name`. Het profiel bevat geen medewerker- of saldo-informatie.

`employment_leave_profiles` koppelt een profiel effective-dated aan één `employment_id`, nooit rechtstreeks aan `employees`. De tabel bevat `leave_profile_id`, `valid_from` en optioneel `valid_until`. Overlap voor één dienstverband is database-side verboden. Een profielwissel op 15 mei rekent dus 1–14 mei met het eerdere en vanaf 15 mei met het nieuwe profiel.

`leave_accrual_rules` koppelt één `leave_profile_id` aan één `leave_type_id` en bevat een versieketen. Een initiële regel heeft geen voorganger; iedere opvolger verwijst met `predecessor_rule_id` naar exact één eerdere versie.

| Kolom | Type/regel |
| --- | --- |
| `predecessor_rule_id` | Optionele self-FK; verplicht voor een opvolger. |
| `valid_from`, `valid_until` | Effective-dated, exclusieve einddatum. |
| `accrual_basis`, `accrual_frequency` | Verplicht. |
| `accrual_timing` | Verplicht. Toekenning aan het begin (`UPFRONT`) of einde (`ARREARS`) van de gekozen frequentie. |
| `accrual_amount` | `numeric(12,4)`, uren per periode bij 1,0 FTE voor contracturen. |
| `accrual_rate` | `numeric(12,6)`, uitsluitend voor `WORKED_HOURS`: door HR instelbare verlofuren per gewerkt uur voor deze opbouwregel. Er is geen vaste standaard; vijf minuten per uur (`0.083333`) is slechts een voorbeeld. |
| `expiration_months` | Verplicht; vervaltermijn na het opbouwjaar. |

Per profiel, type en datum mag slechts één actieve regel gelden. Alle eigenschappen van een regelversie — frequentie, periode, opbouwmoment, opbouwhoeveelheid/-ratio, opbouwpauze en vervaltermijn — wijzigen uitsluitend via een opvolger. De engine sluit dan de voorganger op de startdatum van de opvolger; de geldigheidsblokken sluiten altijd direct op elkaar aan, zonder overlap of gat. Historische en voor een afgesloten jaar geldige versies zijn onveranderlijk.

`leave_accrual_rule_work_hour_types` is de koppeltabel van één `leave_accrual_rule` met één of meer `work_hour_types`. De koppeling is uitsluitend toegestaan bij `WORKED_HOURS` en alleen naar `REGULAR_WORK` of `OVERTIME`; een uniek paar voorkomt dubbeltelling.

`leave_accrual_rule_pause_types` is de koppeltabel van één opbouwregel met één of meer verloftypen die de opbouw voor precies die regel pauzeren. Voorbeeld: de regel voor Wettelijk verlof kan pauzeren tijdens opgenomen Onbetaald verlof en Ouderschapsverlof, zonder de opbouw van een ander verloftype te wijzigen. Een koppeling mag alleen verwijzen naar een ander actief verloftype; een uniek paar voorkomt dubbeltelling.

`leave_accrual_exceptions` is de individuele, effective-dated afwijking per dienstverband en type: `employment_id`, `leave_type_id`, `valid_from`, `valid_until`, `no_accrual`, optioneel `accrual_amount` en optioneel `expiration_months`. Dit is de enige route voor onderhandelde afwijkingen; overlappende uitzonderingen zijn verboden.

### 4.3 Bonusregelingen en treden

`leave_bonus_rules` koppelt een `leave_profile_id` en `leave_type_id` aan `name`, `trigger_type`, `award_timing` en `pro_rate_first_year` (verplicht, standaard `true`). Het verloftype bepaalt het bucket waarin de bonus terechtkomt.

`leave_bonus_tiers` bevat `bonus_rule_id`, unieke `threshold_years` en `bonus_amount numeric(12,4)`: extra uurwaarde per jaar bij 1,0 FTE. Een regel heeft ten minste één trede. Een trede is een voortdurende toestand: de hoogst behaalde trede blijft jaarlijks gelden tot een hogere trede is bereikt.

### 4.4 Voorrangsregels, voorbereid op opname

`leave_priority_rules` koppelt een profiel aan een medewerkerslabel, bijvoorbeeld `Vakantie`, met `valid_from`, optioneel `valid_until` en `is_active`.

`leave_priority_rule_items` bevat `priority_rule_id`, `leave_type_id` en `sort_order`. Een type en een volgordenummer komen hoogstens eenmaal per bundel voor. De bundel bepaalt de volgorde tussen typen; de vervaldatum bepaalt de volgorde binnen een type.

### 4.5 Buckets en grootboek

`leave_balance_buckets` bevat `employment_id`, `leave_type_id`, `accrual_year`, `total_accrued`, `total_taken`, `total_expired` en `expiration_date`. De combinatie dienstverband/type/jaar is uniek. Het restsaldo is altijd `total_accrued - total_taken - total_expired` en mag niet negatief worden door een engineboeking.

`leave_accrual_transactions` bevat `bucket_id`, `transaction_type`, ondertekende `amount`, optionele `reason`, optionele `actor_id` en `transaction_date`. `reason` is verplicht bij `MANUAL_ADJUSTMENT`; `actor_id` is alleen `null` voor systeemboekingen. Bij elke boeking legt de implementatie ook de herleidbare bron vast (opbouwregel, werkurenentry, bonusregel, correctie, cron-run of latere aanvraag), zodat regelwijzigingen historische transacties nooit anders verklaren.

Een migratiestartsaldo is geen blijvend uitzonderingsveld. Een geautoriseerde HR-beheerder geeft per dienstverband, verloftype, aantal uren en startdatum een **startbucket**. De engine maakt daarvoor één bucket met de startdatum als opbouwreferentie en één immutable `OPENING_BALANCE`-boeking; verval volgt de op die datum geldige vervalconfiguratie. Zo is ook een overgenomen historisch saldo volledig traceerbaar en nooit dubbel in projecties opgenomen.

## 5. Rekenregels

### 5.1 Opbouw en pro rata

De engine bepaalt per dag het actieve dienstverband, profiel, opbouwregel of uitzondering, rooster-FTE en eventuele relevante onbetaalde afwezigheid. Zonder geldig dienstverband is de uitkomst nul. Wijzigingen halverwege een periode splitsen die in slices. Voor contracturen geldt:

`(werkdagen in slice / werkdagen in volledige periode) × basisopbouw × FTE`

De som van alle slices wordt één `ACCRUAL`-transactie per bucket en boekingsmoment. Voor iedere `leave_accrual_rule_pause_types`-koppeling trekt de engine alleen de werkelijk opgenomen uren van dat geselecteerde verloftype af van de opbouwgrondslag van deze regel. De vermindering is pro rata ten opzichte van de geplande uren in dezelfde slice; een halve opgenomen werkdag verlaagt dus alleen die halve dag. Een niet-gekoppelde verlofsoort pauzeert de opbouw nooit.

`UPFRONT` boekt aan het begin en `ARREARS` aan het einde van de gekozen opbouwfrequentie; dit geldt zowel voor `PAYROLL_PERIOD` als voor `YEARLY`. `PAYROLL_PERIOD` volgt de op de periode effectieve `employment_salaries.payment_frequency` (`MONTHLY` of `FOUR_WEEKLY`) en boekt nooit buiten een geldig dienstverband.

Voor `WORKED_HOURS` telt de engine alleen de goedgekeurde uren van de gekoppelde `REGULAR_WORK`- en `OVERTIME`-typen. Goedkeuring triggert verwerking op basis van de `work_date`: die datum bepaalt het opbouwjaar, de bucket en de vervaltermijn. Per entry is de opbouw `hours × accrual_rate`; dezelfde entry mag via de bronverwijzing hoogstens één keer worden verwerkt. `INFORMATIONAL`-uren blijven altijd buiten deze berekening.

### 5.2 Bonus-tredenmotor

Voor iedere toepasselijke bonusregel:

1. bepaal op de relevante peildatum de jaren sinds `employees.birth_date` (`AGE`) of `employments.seniority_date` (`SENIORITY`);
2. sorteer treden aflopend en kies de eerste met `threshold_years <= jaren`;
3. ken geen bonus toe wanneer geen trede is bereikt;
4. vermenigvuldig `bonus_amount` met de op de triggerdatum actieve `employment_schedules.part_time_factor`;
5. boek de uitkomst als `ACCRUAL` in het bucket van de regel, met een verklaarbare reden, bijvoorbeeld `Seniorendagen toekenning (leeftijd: 57)`.

Bij `AGE` is de triggerdatum de exacte verjaardag; bij `SENIORITY` de exacte `employments.seniority_date`, die bewust van de indiensttredingsdatum kan verschillen, bijvoorbeeld na een overname. Bereikt het dienstverband de drempel in het lopende jaar, dan kent `START_OF_YEAR` de volledige bonus op 1 januari toe. Bij `ON_TRIGGER_DATE` en `pro_rate_first_year = true` volgt op de verjaardag/jubileumdatum:

`(resterende dagen in jaar / 365) × (bonus_amount × FTE)`

In jaren ná het drempeljaar wordt op 1 januari de volledige jaarwaarde toegekend, totdat een hogere trede geldt.

### 5.3 Saldo-overzicht voor medewerker en manager

`getLeaveBalanceReport(employmentId, asOfDate)` is de enige server-side leesprojectie voor verlofsaldi. Zij retourneert altijd afzonderlijke gegevens per `employmentId` en `leaveTypeId`; parallelle dienstverbanden worden nooit samengevoegd. Het rapport leest buckets, immutable transacties, carry-forward-items, effectieve opbouwregelversies, rooster en einddatum van het dienstverband. De browser berekent geen saldo uit losse rijen.

Per verloftype bevat het rapport minimaal:

| Veld | Betekenis |
| --- | --- |
| `startOfYearBalance` | Saldo aan het begin van het huidige kalenderjaar, inclusief alle geldige overhevelingen uit eerdere opbouwjaren. |
| `carryForwards` | Per overgedragen bucket: oorspronkelijk opbouwjaar, carry-forward-snapshot, actuele restwaarde en onveranderde vervaldatum. |
| `currentBalance` | Saldo nu: beginsaldo plus feitelijke opbouw en positieve correcties min opname, verval en negatieve correcties tot `asOfDate`. |
| `projectedEndBalance` | Verwacht saldo op 31 december of, wanneer eerder, de einddatum van het dienstverband: huidig saldo plus nog te verwachten opbouw min toekomstige goedgekeurde opnames. |
| `monthlyAccrualMoments` | Per kalendermaand de relevante periode, geplande boekingsdatum, opbouwmoment (`UPFRONT`/`ARREARS`), effectieve regelversie, verwachte uren en reeds werkelijk geboekte uren/transacties. Bij jaaropbouw is dit het relevante moment in januari. |
| `expirationBuckets` | Per bucket met positief saldo: verloftype, opbouwjaar, actuele restwaarde, `expiration_date` en aantal dagen tot verval. |
| `manualAdjustments` | Alle `MANUAL_ADJUSTMENT`-mutaties met plus/min-bedrag, reden, datum en HR-adminactor. |
| `taken` | Geaccordeerde opnames en afboekingen; in deze fase leeg wanneer nog geen aanvraagflow bestaat, maar het contract is nu al verplicht. |

Voor `UNLIMITED` toont het rapport de status onbeperkt en geen financieel bucketsaldo of vervaldatum. Voor `ANNUAL_HOURS_CAP` en `WEEKLY_HOURS_FACTOR_CAP` toont het rapport de geldende jaarlimiet en, zodra aanvragen bestaan, gebruikte en resterende jaarruimte. De vier kernsaldi blijven voor opbouwsoorten de financiële waarheid.

Projecties zijn leesberekeningen en schrijven nooit transacties. Handmatige bij- en afboekingen lopen uitsluitend via de centrale engine als `MANUAL_ADJUSTMENT`: een reden is verplicht, het bedrag is ondertekend en actor, tijdstip en reden zijn altijd zichtbaar in het rapport.

De medewerker krijgt uitsluitend het rapport van het eigen dienstverband via de toekomstige selfpermission `self:leave:read`. Een manager krijgt uitsluitend rapporten binnen de bestaande effectieve managementscope via `leave:read`; een gemanipuleerd `employmentId` levert geen data buiten die scope op. De route valideert dit server-side en RLS dwingt dezelfde grens database-side af.

### 5.4 Verval

De nachtelijke job verwerkt iedere bucket op zijn `expiration_date`: het verlof moet vóór die datum zijn genoten en opgenomen. De datum is de eerste dag waarop het saldo niet meer beschikbaar is. Bij een positief restsaldo boekt de job op die datum één negatieve `EXPIRED_DEDUCTION`-transactie en werkt zij `total_expired` atomair bij; de job is idempotent. De vervaltermijn is configureerbaar per opbouwregel of uitzondering en wordt berekend als het ingestelde aantal kalendermaanden na einde van het opbouwjaar (bijvoorbeeld zes maanden: 1 juli van het volgende jaar). De job selecteert dus buckets met `expiration_date <= vandaag`.

### 5.5 Jaarafsluiting en overheveling

Een HR-beheerder sluit een kalenderjaar pas af nadat de engine de jaaropbouw heeft verwerkt. De afsluitactie is atomair:

1. bepaal per dienstverband, verloftype en bucket het resterende saldo op de afsluitdatum;
2. maak voor ieder positief saldo één immutable carry-forward-item voor het volgende kalenderjaar, met de originele bucketreferentie en vervaldatum;
3. markeer de jaarafsluiting als `LOCKED`;
4. blokkeer iedere wijziging aan een opbouwregelversie die in het afgesloten jaar geldig is.

De carry-forward is een controleerbare jaarovergang, geen tweede financiële boeking. Opname in het nieuwe jaar blijft daarom rechtstreeks via het originele bucket en de originele vervaldatum lopen. Een reeds overgedragen bucket staat in het volgende jaar als overgedragen saldo zichtbaar, maar telt nooit tweemaal in `currentBalance` of `projectedEndBalance`.

Een regelopvolger met een startdatum in een later, niet-afgesloten jaar blijft mogelijk. Een regelwijziging die een afgesloten jaar raakt wordt altijd afgewezen; de beheerder maakt dan uitsluitend een opvolger vanaf de eerstvolgende toegestane datum.

### 5.6 FIFO-afboek-engine, voor latere fase

Deze fase levert geen aanvraagroute, maar de afboekregel ligt nu vast:

1. een actieve bundel, bijvoorbeeld `Vakantie`, levert `leave_priority_rule_items` op in `sort_order`;
2. per verloftype zoekt de engine positieve buckets van het gekozen dienstverband;
3. binnen één type sorteert zij buckets op `expiration_date` oplopend (first-expire-first-out);
4. zij boekt later `TAKEN`-transacties tot de uren zijn gedekt of het type leeg is;
5. resterende uren schuiven door naar het volgende type; onvoldoende totaal saldo wijst de hele aanvraag af zonder gedeeltelijke boeking.

Een aanvraag die nieuwjaar kruist, splitst eerst uren per kalenderjaar. Het deel na nieuwjaar is alleen mogelijk wanneer dat jaar `ACTIVE` of `OPEN_FOR_FUTURE_REQUESTS` is. De latere API ondersteunt zowel directe `leave_type_id` als de medewerker-vriendelijke `priority_rule_id`.

## 6. HR-adminpagina Verlofopbouw

De nieuwe tegel onder HR-admininstellingen opent `/settings/leave-accrual`. De pagina bevat geen aanvraagflow, maar wel:

- overzicht van actieve/komende profielen, gekoppelde dienstverbanden, opbouwregels met opvolgeraantal/-status en jaarstatus;
- beheer van verloftypen met opbouw, onbeperkt recht, vaste jaarlimiet of gemiddelde-weekurenfactor; de drie categorieën werkurentypen; profielen; en versiegebonden opbouwregels met begin-/eindmoment, gekoppelde werkurentypen, opbouwpauze-typen en vervaltermijnen; daarnaast uitzonderingen, bonusregels/treden en voorrangsregels;
- een opbouwregeloverzicht als tijdlijn/keten. De beheerder selecteert een voorganger of opvolger om de details te bekijken; wijzigen maakt een opvolger met een aansluitende ingangsdatum in plaats van een historische versie te overschrijven;
- jaarsturing om jaren te openen, voor toekomstige aanvragen vrij te geven en af te sluiten, inclusief preview van ieder over te dragen bucket, saldo en vervaldatum;
- dienstverbandafwijkingen die altijd het specifieke dienstverband tonen, niet alleen de medewerker;
- saldo-audit per dienstverband, type en opbouwjaar met buckettotalen en immutable grootboek;
- de voorbereide leesprojectie voor medewerker en manager: beginjaarsaldo, carry-forwards, saldo nu, saldo einde jaar/dienstverband, maandelijkse opbouwmomenten, verval en handmatige mutaties; opnames verschijnen automatisch zodra de aanvraagflow bestaat;
- verplichte reden bij een handmatige correctie.

Alle zichtbare teksten en fouten staan in paritaire `messages/nl/leave.json` en `messages/en/leave.json`. De route beschermt lezen en muteren server-side. De slice voegt definitieve canonieke verlofrechten via migratie en rolseeds toe; tot dat moment geldt de bestaande HR-admingrens `settings:read`. RLS blijft onafhankelijk tenant-, administratie- en dienstverbandscope afdwingen.

### 6.1 Kleuren en kalenderprojectie

Iedereen van de drie typen die in de verlofengine uren kan leveren of opnemen heeft een eigen beheerbare kleurcode: verloftype, gewoon/informatief werkurentype en overurentype. De kleurcode is geen autorisatie- of saldo-informatie; de kalender gebruikt daarnaast altijd een typegebonden icoon/patroon zodat kleur nooit het enige onderscheid is.

De kalender projecteert per administratie en dienstverband alleen opgenomen verloftransacties (`TAKEN`) en goedgekeurde werkurenentries. Een medewerker met parallelle dienstverbanden wordt niet opgeteld in de engine; de kalender mag de items in één medewerkerregel combineren, maar behoudt per item het `employmentId` voor detail en latere aanvraagacties. Meerdere items op dezelfde dag worden als afzonderlijke gekleurde markers getoond, met een `+n`-samenvatting en een toegankelijk detailpaneel met type, naam en uren.

## 7. Integriteit en acceptatie

- Een databaseconstraint blokkeert overlapping van profieltoewijzingen, regels en uitzonderingen; de regelketen constraint bewaakt directe datum-aansluiting tussen voorganger en opvolger. Unieke constraints bewaken buckets, jaarsturing, rollover-items, tiers en priority-orders.
- Een engineboeking schrijft grootboek en buckettotalen samen of niets. Gelijktijdige jobs of mutaties mogen geen dubbele boeking of negatief saldo veroorzaken.
- Kritieke tests dekken parallelle dienstverbanden, geen opbouw buiten een geldig dienstverband, profiel-/roosterwissel halverwege een periode, aansluitende opvolgers en selectie van regelversies, begin- en eindtoekenning per frequentie, FTE-pro-rata, nuluren- en overwerkopbouw met regel-specifieke ratio per gekoppeld werkurtype, uitsluiting van informatieve uren, gerichte opbouwpauze met gedeeltelijke dag, idempotente verwerking van werkurenentries, startbuckets, onbeperkte en beide jaarlimietsoorten, bonusdrempels, hoogste trede, triggerdatum, verval-idempotentie, jaarafsluiting met carry-forward-snapshot en onveranderlijke afgesloten regelversies, volledig saldo-overzicht voor self en manager met scopeblokkade, tenantisolatie en FIFO-volgorde.
- Iedere schemawijziging omvat typesgeneratie, Supabase-advisors en database-integratietests. De slice sluit af met unit-tests, lint, strict typecheck, i18n-pariteit, build, ingelogde browsercontrole op poort 3000 en publieke previewcontrole.

## 8. Buiten scope van deze eerste slice

- indienen, wijzigen, intrekken en accorderen van verlofaanvragen;
- urenberekening voor een concrete aangevraagde werkdag, feestdag en gedeeltelijke dag;
- selfservice, managerworkflow, notificaties en chatbot-tool;
- daadwerkelijke `TAKEN`-boekingen vanuit een aanvraag;
- selfservice voor het boeken of goedkeuren van werkuren; de engine is wel voorbereid om alleen goedgekeurde werkurenentries te verwerken.

De latere HR-adminflow vanuit de medewerkerskalender is functioneel uitgewerkt in [`VERLOF_AANVRAAG_HR_ADMIN.md`](VERLOF_AANVRAAG_HR_ADMIN.md) als stap 8. Dat document wijzigt de scope van deze eerste engine-slice niet.

## 9. Beslispunten vóór schemawerk

| ID | Beslispunt | Waarom |
| --- | --- | --- |
| D-1 | Wat is de fallback wanneer een geldig dienstverband geen effectieve `employment_salaries.payment_frequency` heeft? | `PAYROLL_PERIOD` kent `MONTHLY` of `FOUR_WEEKLY` nodig; de engine mag geen frequentie gokken. |
| D-2 | Wat is de niet-schrikkeljaar-triggerdatum voor een medewerker die op 29 februari is geboren of in dienst is gekomen? | Verjaardag en jubileum zijn verder exact vastgelegd. |

## 10. Herkomst

- 2026-07-21: geconsolideerd uit de drie door de gebruiker aangeleverde verlofblauwdrukken; aangepast aan `Employment` (niet het historische `EmploymentContract`) en de bestaande tenant-/administratiegrenzen.
- Toekomstige functionele of technische regelwijzigingen krijgen een gedateerde aanvulling of ADR/FDR.

## 11. Implementatiestatus 2026-07-22

Stap 1 t/m 5 zijn gerealiseerd voor de configuratie- en rapportlaag: databasefundering, pure engine/report-berekeningen, RLS-gebonden balance/catalog-API, configuratie-mutaties, opvolger-/bonus-/priority-regeltransacties en profieltoewijzingen staan. De centrale ledger-slice van stap 6 bevat nu startsaldoboekingen, handmatige correcties, jaarafsluiting/carry-forward en idempotente vervalboekingen, met lock-beveiliging en settings-jaarsturing. De HR-admin-aanvraagflow van stap 8 gebruikt deze ledger via FIFO en is als directe, geautoriseerde kalenderboeking gecontroleerd; actieve feestdagen worden in meerdaagse reeksen overgeslagen. Nog open zijn de volledige saldo-audit/adjustmentformulieren en toekomstige opbouwprojectie voor periodieke regels. ESS blijft buiten scope van deze slice.
