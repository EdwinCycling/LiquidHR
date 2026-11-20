# LiquidHR — migratiereconciliatie 2026-11-20

Deze notitie legt een lokale bron-/naamreconciliatie vast. Er is geen SQL uitgevoerd, geen migratiehistorie hersteld en geen databasewrite gedaan.

## Read-only registryvergelijking

- HR/Core TEST: 603 geregistreerde migraties; de lokale Core-map bevat nu 603 bestanden met exact de geregistreerde versie- en naamcombinatie.
- Payroll TEST: 19 geregistreerde migraties; de lokale Payroll-map bevat 18 exacte bronnen en geen extra bestanden. Eén reeds toegepaste historische bron, versie 20261113073051, ontbreekt nog als exact SQL-artefact.
- DATABASE MIGRATION REQUIRED: NO voor deze applicatiekandidaat. De bestaande Core- en Payroll-registraties zijn niet opnieuw uitgevoerd.

## Core

Drie lokale bestandsnamen zijn administratief afgestemd op hun bestaande registryvermelding. SQL-bytes zijn ongewijzigd; de bijbehorende testpaden verwijzen nu naar de canonieke bestandsnamen.

| Geregistreerd | Oorspronkelijke lokale naam | Canonieke lokale naam | SHA-256 |
| --- | --- | --- | --- |
| 20261007131203 / 20261007142637_apiai07_remote_mcp_test | 20261007131203_apiai07_remote_mcp_test.sql | 20261007131203_20261007142637_apiai07_remote_mcp_test.sql | C23F8B326E684B69A59116614DF6AF1343AC80F04F9A45D0F0F224F0E30BE950 |
| 20261119160230 / 20261119120000_wvp_week42_pmux_deadline_contract | 20261119120000_wvp_week42_pmux_deadline_contract.sql | 20261119160230_20261119120000_wvp_week42_pmux_deadline_contract.sql | 49B45C3334BE74D5824A952821EABD0EF1724A51B66E575BE4F1FDE5430DB510 |
| 20261119161917 / sec101_contract_column_access_20261116120304 | 20261119161917_sec101_contract_column_access.sql | 20261119161917_sec101_contract_column_access_20261116120304.sql | 2653A882457E9DA3845FA001218F93B21A064E405F9D57CCDBEE34500664A125 |

Voor WVP week-42 bevestigt het bestaande readbackrapport dat de exacte SQL-hash 49B45C3334BE74D5824A952821EABD0EF1724A51B66E575BE4F1FDE5430DB510 eenmaal is toegepast en onder versie 20261119160230 is geregistreerd. Dit is dezelfde hash als het canonieke lokale bestand. De migratie en registratie zijn niet herhaald. Historisch bewijs blijft ongewijzigd in [WVP-PMUX-week42-integratie](WVP-PMUX-WEEK42-INTEGRATION-20261119.md).

## Payroll

Vijftien bestaande Payroll-bronnen zijn naar de versie/naam uit de registry hernoemd; de SQL-bytes zijn gelijk gebleven. De negentien registryregels zijn daardoor als volgt afgedekt:

- 17 eerder aanwezige Payroll-bronnen zijn lokaal aanwezig onder de exacte geregistreerde bestandsnaam.
- 20261113070540_payfast_mss_payroll_actor_bound_20261112_vault_setrole_fix is hersteld vanuit de oorspronkelijke 58.588-byte artifactkopie. De hash is 8246F2044B9A75625B13524CDE8CC2F82C5B3BBEB1A3DB17B8FD5D6FA87E041C; de historische uitvoeringsregistratie meldt dat deze exacte bron eenmaal via de officiële apply-route is toegepast. Deze migratie is niet opnieuw uitgevoerd.
- 20261113073051_payfast_mss_actor_bound_cleanup_restore_ess_hradmin_only staat geregistreerd in Payroll TEST, maar het exacte toegepaste SQL-bestand ontbreekt in de beschikbare repositorybronnen. De bewaarde kandidaat PAYFAST-MSS-PAYROLL-ACTOR-BOUND-20261112-RECONCILED.sql is 56.707 bytes / SHA-256 4C3D37F1EBE62D0C3FE0FFFF04EE398550F69751FAB3039473E2C78F5D6BFC91; het uitvoeringsrapport markeert die kandidaat als lokaal en niet centraal vrijgegeven. Zij bevat actor-bound setupobjecten en is niet de cleanup-bron. Daarom is zij niet onder de geregistreerde versie geplaatst.

Manager-MSS blijft PARKED. De ontbrekende cleanup-bron is een historisch traceerbaarheidspunt; het registryrecord bewijst dat de versie al is toegepast en er is geen nieuwe schemawijziging nodig voor deze kandidaat.