# Instellingen, extra modules, roosters, feestdagen en medewerkerskalender

Status: **LEIDEND**  
Implementatie: **GEÏMPLEMENTEERD**  
Versie: `1.20260718.5`

## Toegang en navigatie

- Persoonlijke voorkeuren staan op `/personal-settings` en zijn voor iedere ingelogde gebruiker bereikbaar.
- De HR-admininstellingen staan op `/settings` en vereisen server-side `settings:read`.
- De instellingenhub toont alleen tegels waarvoor de gebruiker het bijbehorende recht heeft.
- De tegel **Medewerkers** opent tijdelijk een toegankelijk medewerkerinstellingenschermpje; de hoofdmenu-link **Medewerkers** blijft naar het medewerkersbeheer navigeren.
- Dashboardwidgets zijn vanuit de HR-adminhub per widget actief/niet-actief te zetten en aan managementrollen te koppelen.
- Rollen en rechten, vrije velden en stamtabellen staan niet meer als losse beheeritems in het hoofdmenu.

## Extra modules

- Alleen `HERA`, `DOCUMENTS` en `REMINDERS` zijn tenantbreed schakelbaar.
- Kernfunctionaliteit is niet uitschakelbaar.
- Verlof, verzuim, bedrijfsmiddelen, workflows en opleidingen worden als niet-schakelbare toekomstige modules getoond.
- Uitschakelen verwijdert geen data. Navigatie en serverfuncties verbergen de module en restrictieve RLS-policies blokkeren rechtstreekse datatoegang.

## Urenafspraak en werkpatroon

- `employment_schedules` blijft de effective-dated formele urenafspraak.
- `employment_work_patterns` en `employment_work_pattern_days` vormen een afzonderlijke effective-dated tijdlijn.
- Een werkpatroon heeft 1 tot 4 cyclusweken, een ankermaandag, begin/einddatum en exact zeven dagen per cyclusweek.
- Werkdagen bevatten begin-, eind- en pauzetijd; netto geplande minuten worden server-side gevalideerd.
- Het gemiddelde aantal minuten per week moet exact gelijk zijn aan iedere overlappende urenafspraak.
- Publicatie verloopt atomair via een RLS-gebonden RPC en wordt geaudit.

## Feestdagen

- Een HR-beheerder importeert per administratie, kalenderjaar en ISO-landcode via de server-side Nager.Date-provider.
- Voor import is een preview beschikbaar; de provider krijgt nooit tenant- of persoonsgegevens.
- De database bewaart een snapshot. Herimport behoudt lokale feestdagen en de actieve status van eerder uitgesloten providerdagen.
- Lokale feestdagen kunnen afzonderlijk worden toegevoegd en iedere dag kan in de kalender worden opgenomen of uitgesloten.

## Medewerkerskalender

- `/hr-calendar` toont alle toegestane medewerkers, ook zonder HR-wijziging.
- Per medewerker verschijnen gemiddeld weekaantal, niet-werkdagen, werkuren als hover/detail, feestdagen, medewerkerreminders en HR-wijzigingen.
- Algemene reminders staan één keer boven het raster.
- De pagina ondersteunt zoeken, afdeling, persoon en 10/25/alle medewerkers met een harde bovengrens van 100.
- Namen linken naar de medewerkerkaart. Dagkoppen en medewerkerdagen zijn aanklikbaar en reserveren het interactiecontract voor toekomstige uren, verlof en verzuim.
- Opgenomen verlof en goedgekeurde werkurenentries worden per dienstverband naar de kalender geprojecteerd. Verlof, gewone/informatieve werkuren en overuren behouden hun eigen ingestelde kleur; een icoon en patroon onderscheiden de drie typen ook zonder kleurwaarneming. Meerdere typen op één dag worden als meerdere markers en in het dagdetail samen weergegeven.

## Autorisatie en audit

- Canonieke rechten: `settings:read`, `modules:read`, `modules:write`, `work-schedule:read`, `work-schedule:write`, `holidays:read`, `holidays:write`.
- Iedere nieuwe tabel heeft RLS, expliciete grants, passende indexen en audittriggers.
- Serverroutes leiden tenant, administratie en gebruiker uitsluitend af uit de sessiecontext.
