# Dienstverbanddetail en slimme mutaties — ontwerp

Datum: 15 juli 2026  
Status: goedgekeurd in gesprek

## Doel

Liquid HR krijgt per dienstverband een eigen moderne detailpagina met onafhankelijke tijdlijnen, veilige mutatie- en rollbackflows, ketenadvies, gecombineerde wijzigingspakketten, opvolgacties en een uitbreidbare medewerkerheader.

## Route en informatiearchitectuur

De detailroute is `/employees/{employeeId}/employments/{employmentId}`. De pagina controleert dat dienstverband, medewerker, tenant en actieve administratie bij elkaar horen.

De header toont profielfoto met initialenfallback, naam, personeelsnummer, functie, afdeling, administratie, dienstverbandnummer, status, looptijd, contactacties en externe profielkoppelingen. De pagina ondersteunt via URL-state `view=expanded|compact`.

Tabs worden eveneens via URL-state bestuurd:

- overzicht;
- basis en IKV;
- arbeidsvoorwaarden;
- rooster;
- salaris;
- organisatie;
- kostenverdeling;
- historie.

Het overzicht bevat een gereserveerde AI-samenvattingskaart zonder fictieve inhoud, actuele kernwaarden, toekomstige modulekaarten en een gesaneerd activiteitenlogboek. De compositie blijft uitbreidbaar voor documenten, verlof, verzuim, opleidingen, bedrijfsmiddelen en workflows.

## Tijdlijnsemantiek

Arbeidsvoorwaarden, rooster, salaris, organisatieplaatsing en kostenverdeling gebruiken onafhankelijke halfopen perioden `[valid_from, valid_until)`. Een nieuwe mutatie:

1. vergrendelt het dienstverband voor de transactie;
2. vindt het tijdblok waarin de ingangsdatum valt;
3. sluit dat blok af op de nieuwe ingangsdatum;
4. voegt het nieuwe blok in met als einddatum de einddatum van het gesplitste blok;
5. laat alle latere geplande blokken ongemoeid;
6. schrijft auditgegevens binnen dezelfde transactie.

Een correctie verloopt door het laatste tijdblok te verwijderen en daarna opnieuw in te voeren. Alleen het blok met de meest toekomstige `valid_from` mag worden verwijderd. Het enige resterende blok is niet verwijderbaar. Bij verwijderen wordt de voorganger doorgetrokken tot de voormalige einddatum van het verwijderde blok.

Kostenverdeling is één logisch tijdblok met meerdere kostenplaatsregels. De verdeling wordt atomair vervangen, telt exact op tot 100% en wordt als groep teruggerold.

## Mutatie-UX

Een mutatieformulier opent op desktop in een zijpaneel en op mobiel schermvullend. Het toont huidige en nieuwe waarden, het geraakte tijdblok en behouden toekomstige mutaties.

Iedere mutatie vereist een bevestigingsmodal. Bij terugwerkende kracht vermeldt deze expliciet dat historie en mogelijk payrollresultaten wijzigen. Salarismutaties tonen voltijd- en afgeleid deeltijdbedrag; roostermutaties tonen uren en FTE; kostenverdeling toont oude en nieuwe totalen.

Verwijderen heeft een afzonderlijke bevestigingsmodal met het verwijderde blok en de herstelde voorganger.

## Gecombineerde mutatiebegeleider

Een deterministische, versiebeheerbare impactregelset stelt gerelateerde mutaties voor zonder gegevens stil te wijzigen. Voorbeelden:

- uren/FTE → salaris, verlof, pensioen en payroll;
- salaris → functie, schaal/trede en arbeidsvoorwaarden;
- functie/afdeling → manager, kostenverdeling, salaris en bedrijfsmiddelen;
- arbeidsvoorwaarden/CAO → standaarduren, schaal, salaris en verlof;
- contracttype/einddatum → ketenadvies, IKV, aanzegging en documenten;
- adres → woon-werkafstand, reiskosten en fiscale verwerking.

Een gebruiker kiest `Direct meenemen`, `Niet van toepassing` of `Later controleren`. Direct meegenomen mutaties vormen één atomair wijzigingspakket. Een onbevoegde gebruiker krijgt een opvolgsignaal; permissions worden nooit omzeild.

`Later controleren` maakt een opvolgactie met verantwoordelijke, streefdatum, prioriteit en status. Dit datacontract wordt later hergebruikt door notificaties, Liquid Display en beveiligde AI-tools.

## Ketenadvies

De ketenengine geeft advies op basis van geregistreerde gegevens en blokkeert contractaanmaak niet. De engine is versioned op ingangsdatum.

Voor het huidige regime worden onder meer contractaantal, totale ketenduur, onderbrekingen, opvolgend werkgeverschap en CAO-afwijkingen beoordeeld. Voor contracten vanaf de inwerkingtreding van de Wet meer zekerheid flexwerkers wordt de dan geldende administratieve vervaltermijn toegepast.

Uitkomsten zijn `CLEAR`, `ATTENTION`, `LIKELY_INDEFINITE` en `INSUFFICIENT_DATA`. Bij een zwaar signaal adviseert Liquid HR een contract voor onbepaalde tijd. Toch doorgaan met tijdelijk vereist een reden, optionele toelichting, bevestiging en audit van regelversie en uitkomst.

Externe contracthistorie en uitzonderingsgegevens worden expliciet vastgelegd; een ontbrekende CAO- of voorgeschiedenis leidt tot `INSUFFICIENT_DATA`, nooit tot schijnzekerheid.

## Datamodel

Nieuwe of uitgebreide schemaonderdelen:

- `employee_profile_links` voor LinkedIn, website, portfolio, GitHub en vrije links;
- `employment_change_sets` voor gecombineerde besluiten en waarschuwingen;
- `employment_change_follow_ups` voor open opvolging;
- `employment_chain_history` voor relevante externe voorgeschiedenis;
- `employment_chain_assessments` voor herleidbare advies-snapshots;
- uitbreidingen op `audit_logs` voor medewerker-, dienstverband- en wijzigingspakketkoppeling;
- audittriggers op alle dienstverbandtijdlijnen en nieuwe tabellen;
- beveiligde RPC's als enige atomaire schrijfweg voor toepassen en rollback.

De bestaande `avatar_url`, `income_relationships`, `employment_income_relationships`, `employee_organizations` en tijdlijntabellen blijven leidend.

## Autorisatie en privacy

- Contractdata: `contract:read` en `contract:write`.
- Salarisdata: `salary:read` en `salary:write`, onafhankelijk van contractrechten.
- Organisatieplaatsing: bestaande organisatiepermissions.
- Auditlog: `audit:read`, met veldsanering en aanvullende salariscontrole.
- Profielkoppelingen volgen `employee:read`/`employee:write` en de bestaande managementscope.
- Iedere API-route valideert tenant, administratie, medewerker en dienstverband; RLS blijft de databasegrens.

## Foutafhandeling en gelijktijdigheid

Alle routes retourneren consistente JSON-fouten. Mutatie-RPC's vergrendelen per dienstverband, controleren de actuele tijdlijn opnieuw en geven typed conflictcodes terug bij overlap, stale state, ontbrekende voorganger, ongeldige rollback of onvoldoende rechten. De UI ververst bij conflict de serverbron en toont een Nederlandse, i18n-gebonden melding.

## Verificatie

Kritieke salaris-, keten-, autorisatie- en tijdlijnlogica wordt test-first ontwikkeld. Verificatie omvat unit-tests, API-tests, database-integratietests, RLS-isolatietests, advisors, opnieuw gegenereerde databasetypes, ESLint, strict TypeScript, i18n-pariteit, productiebuild en browsercontrole op desktop en mobiel via poort 3000 en een publieke preview.

