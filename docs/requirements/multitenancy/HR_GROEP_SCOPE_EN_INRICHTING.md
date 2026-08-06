# HR-groepen: scope, inrichting en domeingrenzen

Status: **LEIDEND voor het nieuwe HR-groepmodel**  
Datum: **2026-08-05**  
Vervangt voor het doelmodel de eerdere tenantbrede `SEPARATE`/`COMBINED`-inrichting.

## 1. Doel

Een holding kan meerdere afzonderlijke HR-omgevingen hebben. Zij werken technisch binnen één LiquidHR-tenant, maar een HR-groep is voor gebruikers een afzonderlijke entiteit en een harde zichtbaarheid- en inrichtingsgrens.

```text
Holding / tenant
├── HR-groep A
│   ├── Bedrijf
│   ├── Locaties
│   ├── Administratie A1
│   ├── Administratie A2
│   ├── Personen en dienstverbanden
│   ├── Afdelingen, functies en rollen
│   ├── Verlofregels
│   └── Verzuiminstellingen
└── HR-groep B
    └── volledig afgescheiden inrichting
```

Een gebruiker ziet alles binnen de geselecteerde HR-groep, over de administraties binnen die groep heen. Gegevens uit andere HR-groepen zijn niet zichtbaar, niet doorzoekbaar en niet via een gemanipuleerde ID opvraagbaar.

## 2. Begrippen

| Begrip | Betekenis |
|---|---|
| Holding / tenant | Technische klantgrens en RLS-grens in LiquidHR. |
| HR-groep | Afzonderlijke HR-omgeving binnen de holding. Dit is de primaire gebruikerscontext en zichtbaarheidgrens. |
| Administratie | Juridische, fiscale of salaris/payroll-entiteit binnen precies één HR-groep. |
| Bedrijf | Groepsbrede bedrijfsgegevens binnen één HR-groep. |
| Locatie | Groepsbrede operationele locatie binnen één HR-groep. |
| Persoon | Persoonskaart die één keer binnen een HR-groep voorkomt en nul of meerdere dienstverbanden kan hebben. |
| Dienstverband | Arbeidsrelatie van een persoon met precies één administratie, afdeling en functie. |
| Login/account | Authenticeerbare identiteit die eventueel toegang tot meerdere HR-groepen kan hebben. Dit is niet hetzelfde als een zakelijke e-mail of HR-persoonskaart. |

## 3. Context en autorisatie

De actieve context is:

```text
HR-groep → eventueel administratie → onderdeel
```

- De HR-admin switcht altijd expliciet tussen HR-groepen.
- Binnen de geselecteerde HR-groep zijn alle toegestane administraties beschikbaar.
- Groepsbrede onderdelen vragen geen administratiekeuze.
- Administratiegebonden onderdelen vragen een expliciete administratiekeuze.
- Een UI-switch is nooit de autorisatiebron; de server en RLS valideren de context opnieuw.
- Er is geen gecombineerde medewerkerlijst over HR-groepen heen.

### Bevoegdheden

- Edwin maakt HR-groepen aan via de aparte Control Plane.
- Edwin kan initiële of lege administraties aanmaken.
- Een HR-admin kan vanuit een geselecteerde HR-groep nieuwe administraties aanmaken.
- Een HR-admin kan groepsbrede en administratiegebonden inrichting beheren volgens de toegewezen permissions.
- Een bestaande administratie kan nooit naar een andere HR-groep worden verplaatst.
- Een administratie mag niet worden verwijderd; de enige normale lifecycleactie is latere deactivatie.
- Een HR-groep kan niet normaal worden samengevoegd of gesplitst. Dat kan alleen via een afzonderlijke, gecontroleerde migratieprocedure.
- Een HR-groep mag niet worden verwijderd zolang er administraties of historische gegevens aan gekoppeld zijn.
- Naam en omschrijving van een HR-groep mogen direct worden gewijzigd; deze wijzigingen zijn auditbaar en niet effective-dated.
- Deactivatie van administraties, personen en dienstverbanden wordt in een latere fase uitgewerkt. Verwijderen is geen normale beheeractie.

## 4. Ownershipmatrix

| Onderdeel | Eigendom/scope | Belangrijkste regel |
|---|---|---|
| Bedrijf | HR-groep | Eén bedrijfsprofiel per HR-groep. |
| Locaties | HR-groep | Alle administraties binnen de groep kunnen groepslocaties gebruiken. |
| Afdelingen en functies | HR-groep | Operationele organisatie is niet per administratie dubbel ingericht. |
| Rollen en leidinggevenden | HR-groep | Eén afdeling mag meerdere leidinggevenden hebben. |
| Persoon | HR-groep | Eén groepspersoon, nul of meerdere dienstverbanden. |
| Administratienaam en -nummer | Administratie | Nummer is externe referentie voor onder andere salarisintegraties. HR-admin mag wijzigen. |
| Dienstverband | Administratie | Eén administratie, afdeling, functie en vaste CAO. |
| Salaris en payroll | Administratie | Nooit groepsbreed samenvoegen. |
| Verlofregels | HR-groep | Eén inrichting voor de groep; afwijkingen via medewerker sets of dienstverbanduitzondering. |
| Verlofsaldo en grootboek | Dienstverband | Nooit een persoonsbreed saldo. |
| Verzuiminstellingen | HR-groep | Groepsbrede instellingen en standaardregels. |
| Verzuimcasus en ziekteperiode | Dienstverband | Eén casus hoort bij één dienstverband. Parallelle casussen over dienstverbanden zijn toegestaan. |
| CAO-catalogus | Administratie | Maximaal drie actieve CAO's per administratie. |
| CAO op dienstverband | Dienstverband | Vast; overstap vereist afsluiten en nieuw dienstverband. |

## 5. Persoon, login en zakelijke e-mail

Een persoon bestaat één keer binnen een HR-groep en kan daar nul of meerdere dienstverbanden hebben. Hetzelfde natuurlijke persoon kan ook in een andere HR-groep voorkomen. Groepsspecifieke persoonsgegevens en zakelijke e-mailadressen blijven dan gescheiden.

De technische login-/accountkoppeling moet meerdere groepsrelaties kunnen ondersteunen zonder HR-gegevens tussen groepen zichtbaar te maken. Een zakelijke e-mail is geen stabiele persoonsidentifier. Een medewerker kan per HR-groep een ander zakelijk e-mailadres hebben.

Als dezelfde natuurlijke persoon technisch aan meerdere groepspersonen wordt gekoppeld, is die koppeling uitsluitend voor identiteit, login en gecontroleerde systeemfuncties. Zij geeft geen leesrecht op de andere HR-groep.

## 6. Administraties

Iedere administratie heeft minimaal:

- een interne immutable `id`;
- een naam;
- een administratienummer;
- precies één HR-groep;
- aanvullende velden voor salaris- en externe koppelingen.

Het administratienummer is een wijzigbare externe bedrijfsreferentie. De applicatie gebruikt het interne ID als technische foreign key en mag historische gegevens niet aan de hand van de naam of het nummer koppelen. Een wijziging van het nummer wordt geaudit.

## 7. Organisatie en leidinggevenden

- Een afdeling hoort bij één HR-groep.
- Een afdeling kan meerdere gelijktijdige leidinggevenden hebben.
- Een leidinggevende kan meerdere afdelingen aansturen.
- Binnen één HR-groep kan de leidinggevende over meerdere administraties heen werken.
- Dezelfde persoon kan in meerdere HR-groepen leidinggevende zijn, maar iedere groepsrelatie vereist aparte autorisatie en context.
- De roltoewijzingsdropdown, afdelingsfilters en lijst **Afdelingen zonder leidinggevende** gebruiken dezelfde HR-groep-scope.
- Een organisatieplaatsing koppelt het dienstverband aan afdeling en functie. De functie- en afdelingskeuze mag niet uit een andere HR-groep komen.

## 8. CAO

- Een administratie heeft maximaal drie actieve CAO's.
- Een dienstverband heeft één vaste CAO.
- De CAO mag niet worden gewijzigd binnen een bestaand dienstverband.
- Een CAO-wijziging betekent: oud dienstverband afsluiten en een nieuw dienstverband aanmaken.
- Een historische CAO-wijziging wordt dus als dienstverbandhistorie bewaard, niet als mutatie op hetzelfde dienstverband.

## 9. Verlof

Verlofregels worden op HR-groepniveau ingericht, maar de opbouw, het saldo en het grootboek horen bij het dienstverband.

```text
HR-groep
└── verlofregeling
    ├── standaardregels
    ├── medewerker sets
    └── uitzonderingen
```

De toepassingsvolgorde is:

1. individuele uitzondering op het dienstverband;
2. regel voor een medewerker set;
3. standaardregel van de HR-groep.

Een medewerker met meerdere actieve dienstverbanden heeft per dienstverband een afzonderlijk verlofsaldo. Bij iedere verlofweergave of verlofactie wordt eerst het dienstverband gekozen, tenzij de afdeling/functiecontext exact één geldig dienstverband bepaalt.

De Step-7-implementatie van deze scope is op 2026-08-05 end-to-end vastgesteld. De groepscatalogi, employee sets en regels zijn via schema, RLS, API/RPC en UI aan de HR-groep gekoppeld; uitzonderingen, saldo, buckets, grootboek, rollovers, allocaties en aanvragen blijven employmentgebonden. De resolver volgt `employment exception -> employee set -> HR-group default`. Remote contract-, pgTAP-, RLS- en functionele tests plus de relevante geauthentiseerde browserflows zijn groen of conform de autorisatiescope.

## 10. Verzuim

Verzuim volgt voor context en selectie dezelfde logica als verlof, maar de verzuimcasus blijft altijd dienstverbandgebonden.

- Verzuiminstellingen en standaardregels zijn HR-groepgebonden.
- Een `absence_case` hoort bij exact één `employment_id`.
- Een `absence_spell` hoort bij één casus en dus één dienstverband.
- Binnen hetzelfde dienstverband mogen ziekteperioden niet overlappen.
- Over verschillende dienstverbanden van dezelfde persoon mag verzuim wel gelijktijdig bestaan.
- Dit geldt ook wanneer de dienstverbanden in verschillende HR-groepen zitten.
- Herstel op dienstverband 1 sluit of wijzigt nooit de verzuimcasus op dienstverband 2.
- De vierwekenketen en casusklok worden per dienstverband berekend.
- Verzuim wordt niet samengevoegd tot één persoonsbrede status.

Voorbeeld:

```text
Dienstverband 1: portier, 50% — hersteld gemeld
Dienstverband 2: badmeester, 50% — nog ziek
```

Deze combinatie is geldig en moet door de applicatie worden ondersteund.

### Dienstverbandkeuze

- Bij één passend actief dienstverband selecteert de server dit automatisch.
- Bij meerdere passende dienstverbanden toont de UI een keuze met afdeling, functie, administratie en startdatum.
- Vanuit een leidinggevendeactie kan de afdeling/functie de keuze beperken.
- Een gemanipuleerd dienstverband buiten de geselecteerde HR-groep wordt server-side geweigerd.

## 11. Bedrijf en locaties

Bedrijfsgegevens en locaties zijn groepsbreed. Een dienstverband kan een locatie uit de eigen HR-groep gebruiken. Een andere HR-groep kan deze locatie niet zien of selecteren.

De testimplementatie heeft het model gemigreerd in `20260805180000_hr_group_company_administration_locations.sql`: `administration_company_data` en `administration_locations` dragen `hr_group_id` en hebben geen legacy `administration_id`-eigenaarskolom meer. Per HR-groep bestaat precies één bedrijfsprofiel; locaties zijn een groepsbrede catalogus. De relatie van een employment/organisatieplaatsing naar een locatie blijft wel dienstverbandgebonden als effectieve plaatsing en gebruikt een composite foreign key met tenant en HR-groep.

De bedrijf-/locatie-service, `/api/settings/company-data` en de locatie-RPC filteren op de actieve HR-groep. De groepsbrede beheerpagina vraagt daarom geen administratiekeuze. De administratiebeheerroute `/api/hr-groups/administrations/[administrationId]` wijzigt alleen naam en administratienummer; het interne ID, de tenant en de HR-groep zijn immutable. Nummerwijzigingen worden geaudit en verbreken geen historische foreign keys.

De gecontroleerde `TEST-BOUNDARY`-fixture bevat één bedrijf, één administratie, één locatie en bewust nul medewerkers. Een cross-group locatie-RPC-aanroep wordt geweigerd; dit is naast RLS en de composite foreign key een expliciete server-side grenscontrole.

### Implementatiestatus personen en organisatie — 2026-08-05

Stap 6 is uitgevoerd volgens deze ownershipmatrix. `employees`, `departments`, `department_management`, `employee_organizations`, `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` zijn HR-groepgebonden; `employments` en de onderliggende contract-/arbeidsvoorwaardentijdlijnen blijven administratie- en employmentgebonden met dezelfde `hr_group_id`. De complete-employment-RPC publiceert de eerste geldige employment atomair en weigert ongeldige kostenverdelingen zonder gedeeltelijke writes. `list_employee_overviews`, organogram, roltoewijzingen en medewerkerdetail gebruiken de actieve groep als primaire grens.

De reproduceerbare Step-6-fixtures zijn `TEST-BOUNDARY` met nul personen, `TEST-MULTIGROUP` met één groepspersoon, dezelfde managerlogin in twee groepen, `DEMO-028` met twee actieve employments in twee administraties en twee leidinggevenden op `RICH-02` over twee administraties. Remote RLS-, contract- en transactietests zijn geslaagd. De medewerkerdirectory blijft administratiegebonden voor een medewerkercontext; wanneer zo'n context ontbreekt, weigert de server de route expliciet in plaats van groepsgegevens zonder administratiekeuze te projecteren.

## 12. Niet in deze eerste fase

- normale deactivering en historische filtering van administraties, personen en dienstverbanden;
- samenvoegen of splitsen van HR-groepen als normale beheeractie;
- productie-migratie voor bestaande klanten;
- gecombineerde cross-group HR-rapportage;
- automatische CAO-wijziging binnen een bestaand dienstverband.

## 13. Testdatabase en geen compatibilitylaag

De huidige database bevat uitsluitend synthetische testdata. Er zijn geen productieklanten of productiedienstverbanden die voor het nieuwe model behouden moeten blijven.

Daarom geldt voor deze eerste implementatie:

- bestaande testrecords mogen zonder businessmigratiebehoud worden aangepast, opnieuw gekoppeld, gearchiveerd of opnieuw geseed;
- de huidige administratie-, tenant- en scopekolommen zijn geen reden om het nieuwe ontwerp uit te stellen;
- er komt geen fallback naar het oude `SEPARATE`/`COMBINED`-model;
- er komt geen dual-read, dual-write, compatibiliteitslaag of verborgen legacy-route;
- oude scopekolommen, filters, RPC-parameters en constraints mogen in een gecontroleerde testmigratie worden vervangen of verwijderd;
- bestaande testdata mag niet leiden tot uitzonderingslogica in productiecode of RLS;
- iedere aanpassing van testdata blijft reproduceerbaar via een versioneerbare seed- of migratiemethode.

De enige reden om bestaande gegevens tijdelijk te behouden is het testen van de nieuwe migratie en de nieuwe autorisatie. De applicatie mag na de slice uitsluitend het HR-groepmodel uitvoeren.

## 13. Gerelateerde documentatie

- [ADR-0009 — HR-groepen als zichtbaarheids- en inrichtingsgrens](../../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md)
- [FDR-0006 — Parallel verzuim per dienstverband](../../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md)
- [Luna-implementatieplan](../../delivery/LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md)
- [Multitenancy-basis](MULTITENANCY_EN_MULTI_ADMINISTRATIE.md)
- [Entiteiteigendom](ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md)
