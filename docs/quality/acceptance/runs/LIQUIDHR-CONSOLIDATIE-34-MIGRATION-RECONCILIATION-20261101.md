# CONSOLIDATIE-34 — migratiereconciliatie en releasegate (1 november 2026)

**Status: HOLD — géén databasewrite, release, cleanup of migration repair uitgevoerd.**

## Canonieke uitgangspositie

- GitHub `main`: `814d747285c4a69725a1ce5a5a382e288b2d566a` (read-only geverifieerd 1 november 2026).
- Supabase Core TEST: `wnpfloqpjvaacobppbpk`; 591 migratieregistraties, hoogste versie `20261029114914` (read-only geverifieerd).
- Beoogde Insights-fasen: A `20261030065603`, A2 `20261030120000`, **dan** Vercel B, **dan** C `20261030120901`, **dan** rolacceptatie D.
- A, A2 en C ontbreken volgens `supabase_migrations.schema_migrations`; A/A2/C staan onder dezelfde identifiers als SQL-bronnen in `main`.
- Op basis van de afzonderlijke Codex-inventaris: 55 lokale versies hebben geen exacte remote-ID, waarvan 40 met semantische naamgenoot onder andere remote versie, 12 overige, 3 A/A2/C. Omgekeerd hebben 69 remote registraties geen exact overeenkomstig lokaal SQL-bronbestand. **Deze tellingen komen uit het lokale Codex-rapport en zijn hier niet afzonderlijk herberekend.**
- Het oude Vercel-deployment is niet als nieuwe CONSOLIDATIE-34 release aangemerkt; toekomstige runtime-provenance op de doel-SHA is nog te bewijzen.

## Veiligheidsbesluit

**Niet uitvoeren:** ongefilterde `supabase db push`, `migration repair`, `db reset`, mutaties in `supabase_migrations.schema_migrations`, generieke SQL-DDL buiten migratiebeheer, of `apply_migration` met een nieuw/tijdgestempeld versie-ID. De laatste route kan de canonical migratie-ID niet expliciet kiezen en creëert anders migratiedrift.

De hogere versie van C mag **niet** vooruitlopend op Vercel B worden uitgevoerd. Een geïsoleerde migratiemap is uitsluitend toegestaan wanneer die de volledige lokale/remote historie aantoonbaar en ongewijzigd reconcilieert; 52 afwijkingen wegfilteren is geen bewijs.

## Eén begrensde recovery-wave

1. **Read-only inventaris.** Exporteer op de bestaande Windows-werkplek uit Git alle canonical migratiebestanden als lijst `version,file,sha256`. Lees remote via de reeds gekoppelde Core TEST-migratielijst de tabel `version,name`; bewaar beide bewijsbestanden zonder geheimen.
2. **Classificeer elke afwijking.** Maak een machineleesbare mapping van alle 40 naamgenoten, 12 overige lokale SQL en 69 remote-only registraties. Per item: lokaal ID, remote ID, naam, SQL-hash, bewijs voor SQL-equivalentie, migratie-ouder, ontbrekend bronpad, effect op afhankelijkheden en classificatie: `VERIFIED_EQUIVALENT`, `MISSING_CANONICAL_SOURCE`, `TRULY_PENDING` of `UNRESOLVED`. Vergelijk de daadwerkelijke SQL en waar nodig read-only databasecatalogus; een gelijke naam is geen SQL-equivalentiebewijs.
3. **Geen historie herschrijven.** Recovery van historische bronbestanden mag op een aparte documentatie-/recovery-branch plaatsvinden. Een versie-ID-hernoeming alleen na reproduceerbare canonical bronverificatie en review; nooit een reeds toegepaste SQL opnieuw uitvoeren.
4. **Officiële CLI-gate.** Gebruik een toegestane CLI-authenticatiecontext zonder secrets in logs. Voer de volledige remote/local `migration list`-reconciliatie uit en daarna uitsluitend een officiële `db push --dry-run` die **exact A en A2** als toepasbaar toont en geen van de 52 overige lokale verschillen of C.
5. **Eerste releasewindow.** Pas A en A2 uitsluitend na geslaagde gate toe en verifieer exacte registratie-ID's, helper-signatures, grants, RLS en data-invariantie. Pas daarna Vercel B op exact `main`-SHA; behoud rollback; verifieer READY, runtime-bron-SHA en aliasroutes. Pas C pas daarna toe en controleer Manager direct-team, tenant-scope, actief/niet-verwijderd en negatieve RLS-probes. Rond D af.
6. **Cleanup pas na D.** Bescherm alle lokale stashes, unieke worktrees/bronarchieven, credentials en rollback totdat hun equivalente code/bewijs elders is behouden.

## Definitie van GO

- Alle afwijkende migraties aantoonbaar geclassificeerd, geen `UNRESOLVED` afhankelijkheden.
- Officiële volledige-history-gate plus **exact-two** dry-run op het juiste project.
- Bevestigde mogelijkheid de twee oorspronkelijke IDs te behouden.
- Security-/rollbackplan en `main`-SHA vastgelegd.

## Opdrachtgrenzen

Dit rapport is documentatie van een blokkade, geen toestemming om historie om te schrijven of database-/Vercel-writes te doen. Edwin wil nog steeds **één GitHub main, één Vercel TEST-app en volledige geautoriseerde functionaliteit, behalve externe Nmbrs**. Vermijd extra productbranches of afzonderlijke deploys.
