# Security Wave B — SEC-006 en SEC-010

**Status:** RELEASED — PRODUCTION GREEN
**Datum:** 2026-08-31
**Baseline:** `origin/main` `0121ff13cb8693687d873b4d33930cd2ec18e35c`
**Candidate:** `security/wave-b-uploads-rpc-grants` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\security-wave-b-uploads-rpc-grants`
**Zichtbare versie:** `1.20260831.3`

**Release:** candidate `ff8f4ee886018a62df764d8a162241cdb8a7871c` is fast-forward geïntegreerd in `main` vanaf `0121ff13cb8693687d873b4d33930cd2ec18e35c`.

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

Remote readback ná apply: beschermde wrappers `PUBLIC/anon=NO`, `authenticated=YES`, `service_role=YES`; de drie Recruitment public functions behouden `anon=YES`. De migration is exact eenmaal geregistreerd als `20260831165143 / 20260831151639_secure_wave_b_rpc_grants`. De transactionele post-apply contracttest is `11/11` GREEN.

## Verification

- upload/security en recruitment-regressies: `6` testbestanden, `24/24` tests groen;
- strict TypeScript: groen;
- ESLint: groen;
- `git diff --check`: groen;
- remote security advisors: bestaande baselinebevindingen blijven aanwezig; de negen pre-apply anon-exposure findings zijn read-only vastgesteld, niet via deze candidate remote opgelost;
- volledige suite, i18n-check, Webpack en final candidate gate worden na de laatste code/docs-update één keer uitgevoerd.

De canonical protected local state is `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local`. De vorige disappearance-root-cause is **ENV LOSS ROOT CAUSE: NOT PROVEN**; de file bestond vóór release en bleef na cleanup bestaan. Geen secrets zijn exposed of committed. `SEC-006` blijft **HARDENED WITH RESIDUAL** wegens ontbrekende malware scanning/quarantaine; `SEC-010` is **CLOSED**. SEC-004 residual en SEC-007/008/009/011 zijn niet gesloten.
