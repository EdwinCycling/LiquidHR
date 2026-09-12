# Employee Wizard — synthetic contract fixtures

## Scope en status

Deze reference beschrijft uitsluitend de blijvende synthetische DEV-fixtures voor
de Employee Wizard- en contracttijdlijncontrole. Er is geen Leave/Absence Engine
gebouwd of gewijzigd. Production, Payroll en de TEST-BOUNDARY zijn buiten scope.

Remote scope:

- Supabase-project: `wnpfloqpjvaacobppbpk`
- Tenant: `07249eb9-545c-883b-b26b-d52f83b4f4a1`
- HR-groep Planeten: `6ba6f1df-e376-40f2-abff-ffdf000172e1`
- DEV-administratie: `8483abc9-f275-c80b-5a23-fedc54ce9f0a`
- Gedeelde afdeling: `b551dc4c-0482-3911-5e7a-5b40cf8fe113` (BOARD Directie)
- Gedeelde functie: `1ddf85af-721d-4887-a5e4-74dd2c037ee4` (M1 Monteur)
- Gedeelde manager: `6f2e2302-748f-8684-0ce6-1b29702d5d92`
- Kostenplaats: `f6401e40-e815-a9c0-2d5f-072dc201bb99`

## Stabiele fixture-ID's

| Fixture | Employee | Nummer | Employment | Contract | Periode |
|---|---|---:|---|---|---|
| Lisa Test | `64ad3a23-f59a-4ed0-af41-26dda20ff067` | 100020 | `b7391845-77d4-407c-bfe6-555a8a3d463b` | `10e61060-1ab7-474e-ac52-5d8d8e19b197` | 2026-01-01–open |
| Jan Test | `66ef22a5-5777-44dc-9bde-44a65d0a6d60` | 100017 | `b058d882-47a9-43ff-853e-0e05237214af` | `d3184b2c-8079-4c7a-b431-93041b1c48ff` | 2026-09-01–2026-11-30 |
| Piet Test | `069d8067-4577-4edd-9528-e01da9b8dc04` | 100018 | `9c3c07d2-2361-40bf-8157-9836f1d19cc2` | `421db26d-4c2d-4dd5-a8d8-5de037ca0d1d` | 2026-01-01–open |
| Frank Test | `174eb4b2-20ef-4aef-b5aa-835f5e1664b1` | 100019 | `1e2ab2fc-2beb-414a-84c6-7faeb2fa8912` | `56a6790c-19e8-43b6-85d3-413521007fb1` | 2026-01-01–2026-10-01 |

Alle vier employees zijn `CONFIRMED`, primair en niet gearchiveerd. Per fixture
bestaat exact één actieve intended employment en exact één contract op dat
employment. Piet heeft daarnaast één eerder aangemaakt employment-record dat
via de normale authenticated archive-route soft-archived is:
`ca3bd996-85d7-4bc3-aa58-c10306a58b92`. Dit is geen actieve duplicate en wordt
niet opnieuw gebruikt.

### Manager graph

```text
Lisa Test
├── Jan Test       2026-09-01–2026-11-30
├── Piet Test      2026-01-01–open
└── Frank Test     2026-01-01–2026-10-01
```

De bedoelde organisatieplaatsingen wijzen alle drie naar Lisa:

- Jan: `d6196270-c5a4-4013-9fdb-3b30c6fe6882`
- Piet: `af77c4af-4a24-4aa2-bb56-2ec310764b3f`
- Frank: `7f69de51-1cd0-4fdd-8b08-263c4c6c4850`

Lisa's eigen placement `11aa069d-2b33-4a8f-ba2a-6ee498467334` blijft onder de
bestaande gedeelde manager. De oude Piet-retry behoudt zijn historische Edwin-
manager, maar het employment is soft-deleted en wordt door productqueries
genegeerd.

### Lisa Test

- Private email: `lisa.test@liquidhr.test`
- Auth identity: `685971ca-b68d-4fea-9da8-d9c2806aa7d4`
- Accepted invitation: `40da82b4-f845-4cc7-8e63-6936ab8f64dc`
- Employment: `b7391845-77d4-407c-bfe6-555a8a3d463b`, `INDEFINITE`, vanaf
  2026-01-01, zonder einddatum en zonder proeftijd
- Contract: `10e61060-1ab7-474e-ac52-5d8d8e19b197`
- Rooster: fulltime 40/40 uur, factor 1,00, maandag–vrijdag 8 uur
- Salaris: EUR 5.500 fulltime / EUR 5.500 actual vanaf 2026-01-01
- Administration assignment: `232d9991-11b4-4517-bc43-d8c2a8ca06b2`

Lisa is via de bestaande invitation-fixture en normale login/acceptatie-flow aan
precies één employee gekoppeld. Er zijn geen echte persoonsgegevens of BSN's
gebruikt.

### Piet Test

- Preferred private email: `piet.test@liquidhr.test`
- Organization placement: `af77c4af-4a24-4aa2-bb56-2ec310764b3f`, locatie Delft verkoop hub `5c6a078a-5649-4b52-bf58-220c5b364d97`
- Administration assignment: `b82a8722-29da-44b1-b9a3-740f349cb575`
- Schedule: `761a4305-a6af-408c-b446-010c962e71f6`, 40/40 uur, factor 1,00, maandag–vrijdag 8 uur
- Labor condition: `97cfcc1a-79bb-4934-89d1-b7190b817b27`
- Salary: `73c92376-f0c9-4cbf-965c-1edafda6083a`, EUR 4.500 fulltime / EUR 4.500 actual vanaf 2026-01-01
- Cost allocation: `4c2f42a2-18a8-4600-9160-7c127cb1c279`, 100%
- Income link: `b6c150aa-969c-4d19-8704-017c579d8b3d`, relatie `2100ae46-aca8-4030-a76e-ac47ba04e238`

### Frank Test

- Preferred private email: `frank.test@liquidhr.test`
- Labor condition set: `4a3f96c5-45db-2cd9-5aff-971eee7eab44`
- Organization placement: `7f69de51-1cd0-4fdd-8b08-263c4c6c4850`, Testlocatie SERVICES `dcb0cba0-390f-33ed-6074-d05adcfef59e`
- Administration assignment: `31ca9a52-1baa-405f-b47e-ce95d5530fd1`
- Schedule: `f8daed1f-7c16-4b13-8be7-e3da0b11180b`, 20/40 uur, factor 0,50, maandag–vrijdag 4 uur
- Labor condition: `a883aab4-7e26-4190-a478-0792d04bfe15`
- Salary: `dc052d8f-9f3d-4819-af21-a8522ef0c68c`, EUR 4.000 fulltime / EUR 2.000 actual vanaf 2026-01-01
- Cost allocation: `3641aaa0-d66f-4ca3-8456-6b94ae732a8a`, 100%
- Income link: `167c5083-c719-4d3a-a060-2ad5182bfa26`, relatie `1def2b04-9d9e-4084-af65-23643c7953a9`

Frank is eerst via de normale contractdetail-UI aangemaakt met einddatum
2026-09-30. De correctie naar 2026-10-01 is daarna uitsluitend via dezelfde
normale UI/domain-flow uitgevoerd. De remote einddatum van het contract,
employment, rooster, salaris, organisatieplaatsing, kostenallocatie en
inkomenslink is nu 2026-10-01; de arbeidsvoorwaarderegel eindigt op 2026-10-02
volgens de bestaande contractafhankelijke timeline-semantiek.

### Jan Test

- Organization placement: `d6196270-c5a4-4013-9fdb-3b30c6fe6882`
- Administration assignment: `81747219-1382-4900-9d7f-21f619f305bc`
- Schedule: `cad2e59e-a608-4b27-a399-7c0f730c1106` van 2026-09-01 tot
  2026-10-01, 32/40 uur, factor 0,80, maandag–donderdag 8 uur en vrijdag 0;
  daarna `36d03ad2-f058-432c-bdd6-dc820087e2c7` vanaf 2026-10-01, 32/40 uur,
  factor 0,80, maandag/dinsdag/donderdag/vrijdag 8 uur en woensdag 0
- Labor condition: `2ce96ae6-5b96-42f2-86dc-01f842b1cb9f`
- Cost allocation: `a6cf8510-5bb2-4ccc-9466-4a12e8c9ddb2`, 100%
- Income link: `dd3f139d-83ff-424a-b5b1-9fe94a03d92f`, relatie `686104a1-4f9f-4387-a22c-e0a784dcd4bc`
- Salary history: `fb828844-dabb-4b0c-ab39-7768bcececd0` (vanaf 2026-09-01) en `b31c9818-2e46-4317-84b5-fe16e27e3478` (vanaf 2026-10-01)

De bestaande Jan-salarishistorie blijft aantoonbaar behouden: peildatum
2026-09-15 geeft EUR 4.000 / EUR 3.200 en peildatum 2026-10-15 geeft EUR
4.250 / EUR 3.400.

De roosterwijziging is via de echte Employee Wizard/domain-flow vastgelegd met
change-set `057d8635-9289-41e1-83b5-96bde28405a7`; salaris is daarbij niet
gemuteerd.

## Manager- en temporal-acceptance

- Lisa logt normaal in met haar gekoppelde synthetic auth identity; `/employees`
  toont Jan, Piet en Frank en sluit Lisa zelf uit van de teamrijen.
- Lisa kan de drie bedoelde employee-details lezen, maar krijgt geen
  employment-`Wijzigen`-actie en geen `/authorization`-rechten.
- Een same-tenant employee buiten Lisa's directe team en een foreign-tenant
  fixture geven op de detail-API `404`; tenant- en HR-groep-isolatie blijven
  daardoor ononderscheidbaar afgedwongen.
- De server-side employment-detailservice herhaalt de directe-manager-scope
  vóór het laden van detaildata. De gerichte helpertest en de normale Lisa-
  browserflow zijn groen; er is geen RLS-, grant- of bypass-wijziging nodig.
- HR Admin ziet Lisa en Jan na browser reload; Jan toont beide effectieve
  roostersegmenten en de bestaande salary history.

Remote effective-dated readback:

| Peildatum | Rooster | Uren/factor | Salaris fulltime/actual |
|---|---|---|---|
| 2026-09-15 | `cad2e59e-a608-4b27-a399-7c0f730c1106` | 32/40, 0,80 | EUR 4.000 / EUR 3.200 |
| 2026-10-15 | `36d03ad2-f058-432c-bdd6-dc820087e2c7` | 32/40, 0,80 | EUR 4.250 / EUR 3.400 |

## Leave Engine readiness

Deze records zijn geschikt als stabiele toekomstige input voor toekomstige
Leave/Absence-acceptance: Lisa levert fulltime 100%, Jan levert 80% met een
effective-dated niet-werkdagwijziging, Frank levert 50% met een eindige
contractperiode en Piet levert fulltime/open-ended historie. Samen dekken zij
ook manager-scope, administratie/HR-groep, contract, werkdagen/uren/factor,
salary history en het negeren van deleted employments. De contractreeks gebruikt
de bestaande effective-dated regels; er is in deze slice geen Leave/Absence-code
toegevoegd.

Acceptance-invarianten:

- HR Admin ziet en laadt Lisa, Jan, Piet en Frank via de echte UI; browser reload blijft correct.
- Lisa ziet haar directe team en krijgt geen contractactie buiten haar scope; een Employee krijgt geen geautoriseerde contractactie.
- Cross-employment contract-ID's worden geweigerd; een foreign-tenant employment path lekt geen fixturegegevens.
- Een bezoek aan `Controle` veroorzaakt geen employment POST; alleen de expliciete CTA publiceert.
- TEST-BOUNDARY tenant `80975e8a-b0dd-4552-be20-cd3944da9b2b` blijft 0 actieve employees / 0 actieve employments.
