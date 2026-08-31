# Security Wave B — SEC-006 en SEC-010

**Status:** CODE GREEN — MIGRATION APPROVAL STATUS OPEN
**Datum:** 2026-08-31
**Baseline:** `origin/main` `0121ff13cb8693687d873b4d33930cd2ec18e35c`
**Candidate:** `security/wave-b-uploads-rpc-grants` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\security-wave-b-uploads-rpc-grants`
**Zichtbare versie:** `1.20260831.2` (ongewijzigd)

## SEC-006 — internal upload hardening

De employee- en company-documentroutes controleren nu vóór multipart-verwerking die via `Content-Length` kan worden begrensd en vóór opslag:

- 25 MB bestandsgrootte, plus een beperkte multipart-request-cap van 27 MiB;
- extensie en browser-MIME tegen één gesloten allowlist;
- magic bytes voor PDF, PNG, JPEG, WEBP, BMP, legacy Office en OOXML-containerentries (`word/document.xml` en `xl/workbook.xml`);
- geldige UTF-8 en actieve inhoudsmarkers voor TXT/MD/CSV;
- canonical MIME bij storage-upload en metadata-opslag;
- veilige storage-key filename-normalisatie zonder padsegmenten.

De bestaande server-side permission-, tenant-, administratie-, HR-groep-, private-bucket-, checksum-, metadata- en signed-downloadcontracten zijn behouden. Client-side checks blijven alleen UX; de servervalidator is leidend. De recruitment-public boundary, public buckets en bucket allowlists zijn niet gewijzigd.

**Residual:** interne uploads hebben in deze slice nog geen quarantine- of malware-scannerketen. De 25 MB bodycap en signature/contentchecks beperken het risico, maar bewijzen geen malwarevrij bestand of veilige decompressie van een Office-container. Een toekomstige gedeelde ingestion/quarantinevoorziening blijft daarvoor nodig; er is geen dummy scanner toegevoegd.

Voor SEC-006 is geen database-migratie nodig.

## SEC-010 — RPC grant drift

Read-only inventaris op Supabase-project `wnpfloqpjvaacobppbpk` bevestigde negen publieke functies met `anon` EXECUTE:

- drie bewust publieke Recruitment-functies: `recruitment_public_vacancy`, `recruitment_public_vacancy_state` en `recruitment_submit_public_application`;
- zes interne process-wrappers met grant drift: `get_process_recipe_catalog`, `get_process_recipe_start_context`, `activate_process_recipe`, `get_internal_transfer_preview`, `commit_internal_transfer` en `request_process_work_item_changes`.

De lokale forward migration [`20260831151639_secure_wave_b_rpc_grants.sql`](../../apps/hr-suite/supabase/migrations/20260831151639_secure_wave_b_rpc_grants.sql) revoket op exact die zes functies `PUBLIC` en `anon`, en regrant alleen `authenticated`. Bestaande `service_role` grants, `SECURITY DEFINER`, lege `search_path`, `internal_security`-delegatie en de drie publieke Recruitment-functies worden niet gewijzigd.

Remote readback vóór apply: beschermde wrappers `anon=6`, `authenticated=6`, `service_role=6`; alle public functions met `anon` EXECUTE `9`; Wave-B migration geregistreerd `false`. De remote migration is niet toegepast. De post-apply contracttest staat in [`security_wave_b_rpc_grants.sql`](../../apps/hr-suite/supabase/tests/security_wave_b_rpc_grants.sql) en wacht op expliciete migration approval.

## Verification

- upload/security en recruitment-regressies: `6` testbestanden, `24/24` tests groen;
- strict TypeScript: groen;
- ESLint: groen;
- `git diff --check`: groen;
- remote security advisors: bestaande baselinebevindingen blijven aanwezig; de negen pre-apply anon-exposure findings zijn read-only vastgesteld, niet via deze candidate remote opgelost;
- volledige suite, i18n-check, Webpack en final candidate gate worden na de laatste code/docs-update één keer uitgevoerd.

Geen remote migration, `db push`, migration-history repair, typegen-write, main-merge, version bump of deployment is onderdeel van deze candidate.
