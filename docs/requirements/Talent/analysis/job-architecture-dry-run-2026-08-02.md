# Job Architecture dry-runrapport 2026-08-02

## Scope

Dit rapport beschrijft de testfasecontrole voor Milestone 4 van het opgeslagen Talent-plan. Het functiehuis blijft tenant-owned; `employee_organizations` en employments blijven de administratiegebonden plaatsingslaag. Er is geen tweede functiecatalogus aangemaakt en bestaande identifiers zijn behouden.

## Resultaat `Liquid HR Demo Holding`

| Controle | Resultaat |
|---|---:|
| Actieve functiefamilies | 6 |
| Actieve functiegroepen | 3 |
| Actieve functies | 7 |
| Groepen zonder functiefamilie | 1 |
| Functies met senioriteit | 6 |
| Functies zonder senioriteit | 1 |
| Bestaande functieplaatsingen | 68 |
| Orphan job-group/job-relaties | 0 |
| Dubbele actieve naam + groep + senioriteit | 0 |

De optionele paden zijn expliciet gevuld met `J3-UNSCOPED` / `Algemeen project`: deze groep heeft geen family en deze functie heeft geen senioriteit. De overige demo-functies tonen Junior, Medior, Senior en Lead.

## Negatieve checks

- Een dubbele actieve functienaam binnen dezelfde tenant, groep en senioriteit wordt door `JOB_DUPLICATE_NAME_SENIORITY` afgewezen.
- Een functiegroep die naar een family uit een andere tenant verwijst wordt door de tenantconsistente foreign key afgewezen.
- Beide checks zijn transactioneel uitgevoerd; er blijft geen negatieve testrecord achter.

## Open release-gate

De volledige HR-admin/manager/medewerker-browsermatrix kan pas worden gesloten nadat de testomgeving aparte, veilige auth-fixtures voor Manager en Medewerker bevat. De huidige browserevidence is HR-admin-only. De uitgevoerde accessibilitycontrole is een gerichte DOM/heading/label/accordion-smokecheck en geen volledige WCAG/axe-audit.
