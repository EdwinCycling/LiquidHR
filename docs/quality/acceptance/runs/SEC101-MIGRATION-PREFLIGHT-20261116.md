# SEC101 migration reconciliation — 16-11-2026

Kandidaat: `work/liquidhr-final-20261116` / `7f53e82318f012c38cc475192c712da0b2eb287a`
HR/Core TEST-project: `wnpfloqpjvaacobppbpk`

## Lokale migratiehistorie

De remote ledger bevat 600 toegepaste versies. De kandidaat had 585 actieve SQL-bestanden: 75 remote versies ontbraken lokaal en 60 lokale versies kwamen niet overeen met de remote versie-ID's.

- De 75 ontbrekende bestanden zijn hersteld uit de exacte SQL-statements in de HR/Core-migratieledger. Per bestand is SHA-256 vergeleken: **75/75 gelijk**.
- De 59 verouderde lokale versies zijn buiten de actieve CLI-migratiemap gearchiveerd. Hun inhoudshashes zijn na verplaatsing gecontroleerd: **59/59 behouden**.
- De uiteindelijke actieve set telt 601 bestanden: alle 600 remote versies plus uitsluitend EXPAND `20261116110043`; geen ontbrekende of dubbele versies.
- De volledige versies, paden en hashes staan in [manifest.json](../../../../apps/hr-suite/supabase/migration-reconciliation/manifest.json).

De onafhankelijke lineagecontrole zocht de vijf afwijkende historische Git-paden door de beschikbare geschiedenis en vond daar geen exact SQL-blob: `20261007064118`, `20261007064155`, `20261007130507`, `20261007131544`, `20261008095650`. Voor die versies is de toegepaste ledger-SQL als primaire herstelbron gebruikt. De actieve gereconstrueerde bestanden matchen de ledger exact; dit is een ontbrekende Git-herkomst, geen hashverschil in de herstelde inhoud.

## Lokale verificatie

- 39 migratiecontracttestbestanden: **177/177 tests PASS** na correctie van twee tests die lokale afwijkende bestanden als historische waarheid aannamen. De contracttests behouden ook de latere hardening.
- TypeScript: **PASS**.
- Staged patch whitespace check: **WARN** only for 39 restored SQL files with a blank line at EOF; preserved byte-exact hashes against the applied ledger, so no whitespace normalization was applied.
- Actieve versiepariteit: **PASS** (600 remote + één bedoelde EXPAND).
- `apps/hr-suite/next-env.d.ts`: ongewijzigd; SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`.

## Officiële Supabase CLI dry-run

Edwin voerde CLI `2.122.1` uit vanuit `apps/hr-suite`; de aangeleverde terminaluitvoer is gecontroleerd tegen de lokale projectconfiguratie en 601 actieve migratiebestanden:

```text
DRY RUN: migrations will not be pushed to the database.
Would push these migrations:
 • 20261116110043_sec101_restrict_unused_keys.sql
Finished supabase db push.
```

**PASS:** uitsluitend de bedoelde EXPAND-migratie `20261116110043_sec101_restrict_unused_keys.sql` is geselecteerd. De CLI sloeg `.contract.test.ts`-bestanden over volgens het verwachte SQL-migratiebestandsnaam patroon. Er is niets naar de centrale database geschreven. De eerdere dry-run vanuit de repository-root vond geen migratiemap; er is geen `migration repair` of `db pull` uitgevoerd.

De onafhankelijke lokale reconciliatiereview en de dry-run-addendumreview zijn **PASS**. De laatste controle bevestigde de set- en hashintegriteit, alle archiefdoelen, de testinventaris, de additive EXPAND-inhoud zonder tabelrechten in te trekken en de selectie van precies deze migratie.

## PGP-voorziening en grens

Een unieke OpenPGP RSA-3072 keypair is lokaal voorbereid; een geïsoleerde pgcrypto fingerprint- en encrypt/decrypt-conformiteitstest slaagde. De private key staat alleen in Windows DPAPI current-user-encrypted opslag buiten de repository. Er zijn geen sleutelwaarden in logs of Git gezet.

De GO voor de drie afgesproken TEST-writes is ontvangen. Op dit moment zijn public key en Vercel server-only secret nog niet geprovisioneerd; de uitvoering moet nog plaatsvinden. Er is nog geen databasewrite, deployment of wijziging van migratiehistorie uitgevoerd.

Read-only Vercel-projectcontrole met `decrypt=false` vond `PAYROLL_PROVENANCE_PGP_PRIVATE_KEY` nog niet in project `liquidhr`. Edwin heeft expliciet GO gegeven voor:

1. EXPAND `20261116110043_sec101_restrict_unused_keys.sql` op HR/Core TEST (`wnpfloqpjvaacobppbpk`).
2. Provisioning van uitsluitend de publieke sleutel in `internal_security.sec101_provenance_public_key`.
3. Instellen van `PAYROLL_PROVENANCE_PGP_PRIVATE_KEY` als Vercel Secret voor project `liquidhr`, uitsluitend target `production` (de bestaande synthetische TEST-runtime).

Er wordt geen CONTRACT-migratie of deployment uitgevoerd in deze gate.
