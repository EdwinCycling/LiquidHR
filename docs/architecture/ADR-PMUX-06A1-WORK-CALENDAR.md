# ADR — PMUX-06A.1 werkkalender en immutable deadlinebinding

Datum: 25 oktober 2026. Status: geïmplementeerd en na expliciet akkoord geverifieerd op Core TEST; migratie `20261025131521`, Jupiter-publicatie versie 1 en P9-acceptatie PASS. Zie [eindbewijs](../quality/acceptance/runs/PMUX-06A1-20261025-CORE-TEST.md). Geen deployment.

## Context

Process Automation kent een getypeerd `businessDays`-contract en materialiseert deadlines bij stapactivatie. Het bestaande HR-groepfeestdagenregister bevat broninformatie, maar legt niet voor elke organisatie vast welke feestdagen vrij zijn en wat de gewone werkdagen/sluitingen zijn. Individuele werkpatronen en bedrijfsactiviteiten kunnen die keuze niet impliciet bepalen.

## Besluit

1. Eén organisatiescopekalender: HR-groepsstandaard met optionele administratieafwijking. Geen tenantoverschrijdende bindingen. Een aanwezige ongeldige afwijking blokkeert en valt niet terug op een andere kalender.
2. Elke expliciete publicatie creëert een immutable `work_calendar_versions`-snapshot plus `work_calendar_exceptions`. Bestaande `holidays` blijven de bron; geselecteerde vrije feestdagen worden gesnapshot, niet live meegerekend. Een lege selectie vereist dezelfde expliciete bevestiging als een niet-lege selectie.
3. Eén SQL-berekeningspad, `internal_security.work_calendar_deadline`, bedient runtime en beheerpreview. De bestaande normalisatiefunctie en PMUX-06A-trigger worden hergebruikt. JavaScript presenteert het resultaat en implementeert geen tweede kalenderberekening.
4. De binding hoort bij de stapactivatie. De stap bewaart kalenderrevisie en deadline. Kalenderwijzigingen raken alleen latere activaties, ook in al lopende cases. Bestaande deadlines blijven immutable. Er komt geen retroactieve backfill.
5. De startdatum telt niet mee; er worden N volgende werkdatums geteld met behoud van de lokale wandkloktijd. Expliciete afwijkingen overrulen het weekpatroon. Dubbele datumkeuzes worden geweigerd. DST-resolutie volgt de bestaande PostgreSQL-tijdzoneconversie.
6. Publicaties hebben een eindige geldigheidsperiode en een verplichte reden. De activatie én deadline moeten binnen die periode vallen. Er is geen stille fallback voor een ontbrekende kalender, ontbrekende dekking of ongeldige tijdzone.
7. Beheer hergebruikt `process-definition:write`; RLS begrenst SELECT en clients hebben geen directe tabelmutatierechten. Drie gecontroleerde RPC's verzorgen lezen, atomic publiceren met optimistic concurrency, en read-only preview. Alle interne helpers zijn niet uitvoerbaar door anon/authenticated. Er worden geen rolgrants toegevoegd.
8. De private oude P7-update-trigger en zijn ongebruikte weekdaglus worden verwijderd om twee concurrerende deadlinepaden en herberekening bij updates te voorkomen. Read-only Core-inspectie vond alleen `set_process_step_deadline()` als gebruiker van de oude calculator.

## Gevolgen

Een toekomstige stap in een bestaande case kan een nieuwere kalender gebruiken dan een eerdere stap; de gebruikte versie is per stap controleerbaar en geaudit. Kalenderbeheer moet de geldigheidsperiode tijdig verlengen en feestdagen voor die periode expliciet beoordelen. Zonder passende publicatie stopt activering met een specifieke fout, zonder gedeeltelijke processtart.

De bestaande SLA-contracten en procesdefinities worden niet geconverteerd. Minuten, uren en kalenderdagen behouden hun gedrag. De compiler controleert alleen structurele SLA-geldigheid; de scopegebonden kalender is runtimeconfiguratie.

Remote schema- en configuratiewrites vallen onder een afzonderlijke goedkeuringsgate. Dit besluit autoriseert geen deployment, uitbreiding van rollen, accounts of writes buiten de genoemde kalender/P9-acceptatie.
