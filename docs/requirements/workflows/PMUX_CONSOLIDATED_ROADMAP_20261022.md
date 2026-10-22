# PMUX — Geconsolideerde roadmap (22 oktober 2026)

## Productbesluit

De komende Process Automation-ontwikkeling bestaat uit drie productwaves: **PMUX-05 — Slimme formulieren en gegevens**, **PMUX-06 — Deadlines, uitval en procesregie** en **PMUX-07 — ESS, Focus en productfinish**. PMUX-04 blijft een afzonderlijke security- en releasegate en is geen productwave.

Deze roadmap vervangt de oude PMUX-deelreeks als actieve planning. PMUX-02A/02B, PMUX-03A/B/C en PMUX-05A/B blijven historische capability- en acceptance-labels voor bestaand werk; ze vormen geen nieuwe toekomstige projectsplitsing. De oude P0–P10-uitvoeringsfasen in de [Process Automation Blueprint](LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md) zijn historisch. De blueprint blijft referentie voor product- en architectuurprincipes.

## Wave 05 — Slimme formulieren en gegevens

**Eerstvolgende en actieve wave.** Rond de bestaande Processtudio, Formulierenstudio, getypeerde conditiecontracten, compiler, bindingcatalogus en formulier-RPC af tot één veilige configuratie-ervaring.

- Formulierveld zichtbaar maken en verplicht stellen op basis van dezelfde getypeerde `ConditionNode`, zonder tweede evaluator.
- Herstel het concept-save-contract: een wijziging aan bronwaarden kan de nieuwe zichtbare veldprojectie teruggeven; definitief indienen controleert de dan geldige verplichte velden.
- Verwijder verborgen waarden uit de actieve antwoordset zonder immutable revisies of audit te wijzigen.
- Onderzoek en lever veldrechten per stap én deelnemer alleen met echte server-side handhaving. De huidige runtime contracteert rechten per deelnemer; per-stap-instellingen mogen niet live zichtbaar worden zolang de server deze niet afdwingt.
- Maak bestemming duidelijk als vrij procesveld, HR-domeinwaarde, domeinvoorstel of berekende waarde. De bestaande developer-owned bindingcatalogus blijft de enige bron van toegestane bindingen.
- Bied synthetische formulierpreview per rol, stap en scenario en rond mobiele weergave op 390px af.
- Behoud draft revisions, optimistic concurrency, autorisatie, immutable publicaties en bestaande domeinservices.

**Huidige status op de PMUX-branch:** PMUX-05A en de lokale PMUX-05B editor zijn aanwezig. `ConditionNode`, de bestaande compiler/evaluator en serverprojecties worden hergebruikt. De serveracceptatie blijft **OPEN**: concept-save valideert nu al conditioneel verplichte antwoorden voordat de nieuwe projectie beschikbaar is en bewaart oude verborgen antwoorden in `new_values`. In deze documentatieconsolidatieslice is geen SQL-contractwijziging toegepast. Zie [PMUX-05B-evidence](../../quality/acceptance/runs/PMUX-05B-20261022-LOCAL.md) en het actuele [PMUX-05 delivery record](../../quality/acceptance/runs/PMUX-05-20261022-LOCAL.md).

## Wave 06 — Deadlines, uitval en procesregie

Na PMUX-05: procesdeadline en stap-SLA, reminders, escalaties, ontbrekende manager, uitdienstgetreden behandelaar, HR-uitvallijst, geautoriseerde herverdeling binnen scope, prognoses en inzichten. Deze wave wordt nu alleen gepland; hier wordt in PMUX-05 geen functionaliteit voor gebouwd.

## Wave 07 — ESS, Focus en productfinish

Na PMUX-06: volledige ESS/MSS/Focus-ervaring, mobile-first formulieren, visuele routes en processtatus, dashboard, handmatige UX-review, E2E en releasevoorbereiding. Deze wave wordt nu alleen gepland; hier wordt in PMUX-05 geen functionaliteit voor gebouwd.

HR Admin kan blokkades binnen de bestaande scope beheren. Dat geeft HR Admin geen recht om namens een andere procesdeelnemer goed te keuren.

## Afzonderlijke gate — PMUX-04

PMUX-04 blijft de aparte TEST-security- en releasegate voor bestaande synthetic flows: toegangs- en JWT-scope-negatives, bestaande actor/role-switcher, database- en RPC-readback, desktop-/390px-browserbewijs en eigenaaracceptatie. Bestaande historische acceptance-evidence blijft onveranderd; actuele open punten staan in [AA-OPEN](../../AA/AA-OPEN.md).

## Capabilitymatrix bij consolidatie

| Capability | Bestaand op de branch | UX- of contractgat | PMUX-05-doel |
| --- | --- | --- | --- |
| Conditionele procesroutes | Getypeerd conditiecontract, bestaande compiler, SQL-route-engine, evaluator en Procesproef. | Authenticated save/readback en browseracceptatie open. | Dezelfde contracten behouden; geen tweede route-engine. |
| Conditionele formuliervelden | `visibilityCondition` en `requiredCondition`, compilerchecks en bestaande serverprojectie/-validatie. De editor en synthetische preview zijn lokaal aanwezig. | Autosave weigert een nieuw zichtbaar verplicht veld; verborgen oude waarden blijven in actieve opslag. | Herstel de bestaande response-RPC en bewijs finale validatie en purge. |
| Veldtoegang | Bestaande participant-regels en server-side actor/work-item-controle. | Geen fijnmazig `(stap, deelnemer)`-contract. | Alleen toevoegen met server-side enforcement, compilerchecks en regressies. |
| Gegevensbestemmingen | Getypeerde `PROCESS_ONLY`, `DOMAIN_READ`, `DOMAIN_PROPOSAL` en `COMPUTED`-contracten, veilige vaste catalogus, typechecks en serverbindingen. | Bestemmingsuitleg was onnodig technisch zichtbaar. | Begrijpelijke bestemmingsteksten; geen vrije tabel-, kolom- of formule-invoer. |
| Preview | Synthetische velden, dynamische condities, rol/stapselectie en desktop/390px-preview zijn aanwezig. | Browserbewijs en volledige server-/rolacceptatie open. | Zelfde preview hergebruiken en bewijs afronden. |

Geen nieuwe login-, role-switcher-, browser- of formulierinfrastructuur. Geen databasepublicatie, echte aanvraag, remote migratie of release in deze lokale roadmap slice.
