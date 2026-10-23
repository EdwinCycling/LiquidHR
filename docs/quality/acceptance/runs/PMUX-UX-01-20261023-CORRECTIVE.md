# PMUX-UX-01 Foundation-correcties — 2026-10-23

## Scope

Gerichte herstelronde van de zeven P2-afwijkingen uit de PMUX-conformiteitsreview. Startpunt: branch `work/BRANCH-SPLIT-PMUX-20261021`, HEAD `f3362e9cdd4652536f760828d9ce2f619402b77e`. Geen nieuwe functionaliteit, autorisatie-, runtime- of procesproeflogica, schemawijziging, remote write, push, merge of deployment.

## Correcties

| Nr. | Resultaat | Component en bewijs |
|---|---|---|
| 1 | FIXED | `form-runtime-renderer.tsx`: multiselect is een benoemd `fieldset` met `legend`, help- en foutbeschrijving; checkboxopties dragen `aria-invalid` en zijn native toetsenbordfocusbaar. De componenttest controleert groepering, beschrijvingen, invalid-status, focus en selectie. Echte Space-toetsactivering blijft onderdeel van browseracceptatie: happy-dom voert de native standaardactie niet uit. |
| 2 | FIXED | `studio-workspace.tsx`: catalogus gebruikt `ul`/`li` met native `button`; de onjuiste `role="listitem"` is verwijderd. Bestaande selectie en `aria-current` blijven behouden. Componentcontracttest controleert dit. |
| 3 | FIXED | `field-access-matrix.tsx`: aparte NL/EN-meldingen voor geen processtappen, stap zonder deelnemer en lege configureerbare veldrechten. Componenttest controleert alle drie toestanden. |
| 4 | FIXED | `studio-workspace.tsx`: proefresultaten tonen vertaalde deelnemer-, selectieregel-, toegang-, status- en SLA-eenheden. Technische sleutels, codes en ruwe eenheden staan alleen in de ingeklapte diagnoseweergave voor gebruikers met bestaande schrijf- of publicatierechten. Proeflogica is ongewijzigd. NL/EN-sleutelpariteit en componentcontract zijn gecontroleerd. |
| 5 | FIXED | Processtudio gebruikt semantische status- en waarschuwingstokens, Foundation-radiusvariabelen en vlakke oppervlakken. De undefined `--radius-card`, hardcoded amber/emerald-kleuren en onnodige shadows zijn verwijderd uit de beoordeelde Studio-, recept- en startschermoppervlakken. De tokencontracttest controleert de standaard LiquidHR- en LinkedHR-kleurvariabelen en radius. |
| 6 | FIXED | `process-workspace.tsx`: urgentietellingen worden als aantallen van “Op deze pagina” aangekondigd. Er is geen nieuwe query toegevoegd. Componenttest controleert een pagina-item naast een hoger gefilterd totaal. |
| 7 | FIXED | `REDESIGN_WORKFLOWS_EN_FORMULIEREN.md`: conflicterende modaltekst is gericht vervangen door de bestaande full-page-wizardafspraak. De drie stappen en review vóór aanmaken blijven staan; componentcontracttest controleert de wizardstructuur. |

## Lokale verificatie

- Vitest: 4 gerichte bestanden, 18 tests geslaagd.
- TypeScript `type-check`: geslaagd.
- ESLint op de gewijzigde TS/TSX-bestanden: geslaagd.
- `check:i18n`: geslaagd; 43 namespaces met gelijke NL/EN-sleutels.
- `git diff --check`: geslaagd.
- Geen SQL- of migratietest uitgevoerd: deze correctieronde wijzigt geen SQL of databasecontract.

## Open acceptatie

Desktop- en 390px-browseracceptatie, echte toetsenbordbediening met Space en visuele bevestiging in een bestaande geautoriseerde Process Automation-sessie blijven OPEN. De eerdere review vond geen bruikbare bestaande geauthenticeerde browsersessie. Er is geen login- of browserinfrastructuur gestart.

## Beschermde werkboomstatus

`apps/hr-suite/next-env.d.ts` en bestaande PMUX-04-acceptance-evidence zijn buiten deze correctie gehouden. Deze evidence blijft historisch; deze aanvulling vervangt of herschrijft die niet.
