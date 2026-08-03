# Talent fase 2 — release-hardening 2026-08-02

## Resultaat

M2.0 t/m M2.8 zijn functioneel afgerond in de lokale/testomgeving. De vier resterende M2.9-controles zijn opnieuw uitgevoerd of expliciet begrensd:

| Controle | Resultaat | Bewijs |
|---|---|---|
| Medewerkerlanding `/departments` | Opgelost | `/login` gaat naar `/dashboard/start`; directe toegang tot `/departments` gaat naar `/geen-toegang` |
| Grote-dataset-performance | Geslaagd als veilige representatieve baseline | tijdelijke transacties met 20.000 synthetische rijen, rollback na iedere meting |
| Axe/keyboard met drie rollen | Geslaagd | 3 rollen, 4 toegestane routes, 0 axe-violations, keyboard-focus op iedere toegestane route; de resterende kleurcheck is handmatig in de browser beoordeeld |
| Provider snapshot/restore | Nog formeel open | een echte herstelproef vereist een tijdelijke Supabase-branch of expliciet provider-backupvenster |

## Performance-baseline

De proef gebruikte alleen tijdelijke tabellen binnen een transactionele `BEGIN ... ROLLBACK`. Er is geen persistente testdata toegevoegd. De queryvormen zijn gebaseerd op de bestaande Talent-services:

| Queryvorm | Dataset | Indexpad | Execution time |
|---|---:|---|---:|
| doelen per tenant/medewerker/status | 20.000 | tenant/employee/status | 0,412 ms |
| capabilityrecords per tenant/medewerker/capability | 20.000 | tenant/employee/status | 0,299 ms |
| importregels per tenant/batch, 5.000 teruggegeven | 20.000; 10.000 in batch | tenant/batch/status/row | 7,545 ms |

De huidige demo-dataset is daarnaast read-only met `EXPLAIN (ANALYZE, BUFFERS)` gecontroleerd. Die kleine dataset blijft alleen een smoke-baseline; de tijdelijke proef is de representatieve schaalcontrole. De grens voor deze lokale release-gate is niet overschreden.

## Snapshot-, restore- en rollbackbewijs

De applicatieve herstelroute is bewezen met een HR-import: de batch eindigt als `ROLLED_BACK`, de importregel als `ROLLED_BACK`, het nieuw aangemaakte imported capabilityrecord als `ARCHIVED` en er blijft geen actief imported record achter. Auditdata blijft behouden. Dit is een batchrollback, geen provider-database-restore.

De actuele remote migratie-inventaris is read-only gecontroleerd. Een tijdelijke Supabase-developmentbranch kost volgens de provider $0,01344 per uur. Die branch is niet aangemaakt, omdat een providerbranch en een restorehandeling expliciete kosten- en hersteltoestemming vereisen. Zonder die toestemming wordt geen formele productie-releaseclaim voor snapshot/restore gedaan.

## Toegankelijkheid en rollen

De herhaalde gate gebruikte geïsoleerde HR Admin-, manager- en medewerkerfixtures:

- HR Admin: Talentbeheer en Workforce Talent toegestaan; Mijn Talent geweigerd;
- manager: alleen Workforce Talent toegestaan, inclusief buiten-scope-functieafwezigheid;
- medewerker: alleen Mijn Talent toegestaan, self-bound API gecontroleerd;
- manager en medewerker kregen 403 op de negatieve capabilitymutatie;
- cross-tenant reads eindigden in 403/404;
- alle vier toegestane routes kregen keyboard-focus en de axe-scan meldde 0 echte violations.

De gedeelde product-updatebadge en het M2 Talent-statistieklabel zijn explicieter contrastrijk gemaakt. De resterende axe-`incomplete` kleurcontrole op het gedeelde/themed oppervlak is in de Codex-browser handmatig gecontroleerd met donkere tekst op wit oppervlak; er is geen functionele contrastfout vastgesteld.

## Releasebesluit

De M2-functionaliteit is klaar voor verdere productontwikkeling in de testomgeving. Formele productie-release-hardening is pas volledig gesloten nadat een tijdelijke niet-productiebranch is gebruikt voor snapshot/restore, of nadat een bevoegde eigenaar een bestaand provider-backupvenster en herstelprocedure aantoonbaar heeft uitgevoerd.
