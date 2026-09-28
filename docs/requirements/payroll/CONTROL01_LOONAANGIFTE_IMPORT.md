# CONTROL01 — Loonaangifte-import

Status: LEIDEND voor de CONTROL01-slice; `READY_FOR_CONVERGENCE` op 2026-09-28.

## Doel en grenzen

De payroll-import start binnen een actief tenant-, HR-groep- en administratiecontext. Analyse en preview zijn read-only. Pas na expliciete bevestiging worden stagingrecords en daarna canonieke employees, employments en income relationships verwerkt. De import gebruikt bestaande employee-, employment- en payrollservices en houdt tenant- en HR-groepsisolatie server-side en via RLS in stand.

De officiële Loonaangifte-XML/XSD is in deze slice bewust niet gegokt. De adapter geeft `REAL_XML_PENDING` terug zolang de officiële broncontracten niet beschikbaar zijn. Voor lokale contracttests is alleen een synthetische `INTERNAL_REPRESENTATIVE`-fixture toegestaan; die bevat geen plaintext BSN, raw XML of secrets.

## Canoniek importmodel

De lagen zijn:

1. bronadapter/parser;
2. canonical person- en income-relationship-model;
3. validatie en deterministische matchvoorstellen;
4. gescopeerde staging per batch, persoon en IKV;
5. preview/selectie;
6. bestaande domeinservices voor definitieve writes;
7. importresultaat met counts, warnings en auditmetadata.

LhNr wordt alleen geaccepteerd als `9 cijfers + hoofdletter L + 01..99`. LhNr-binding is administratiegebonden en niet globaal uniek. Een protected BSN-fingerprint mag uitsluitend als matchhulpmiddel worden gebruikt; de import slaat geen plaintext BSN op.

Initialen vullen nooit automatisch `first_name`. Een ontbrekende voornaam is blocking en moet inline worden aangevuld of uit de selectie worden verwijderd. Ambigue matches, dubbele IKV's, scope-mismatch, ongeldige datums en ontbrekende verplichte velden zijn blocking of warning volgens de validatie-uitkomst.

## Acceptatiegrenzen

- `payroll-import:read` en `payroll-import:write` zijn tenant/HR-groepgebonden.
- De actieve administratiecookie moet overeenkomen met de requestcontext.
- Een ontbrekende LhNr-binding blokkeert analyse.
- Staging is idempotent op tenant, HR-groep, administratie, bronhash en belastingjaar.
- Definitieve verwerking schrijft geen rijen buiten de gekozen tenant/HR-groep/administratie.
- Rapportage bevat geen plaintext BSN, raw XML, tokens of secrets.
- De volledige contract- en organisatorische mapping van een nieuw dienstverband blijft een expliciete vervolgactie wanneer de bron die gegevens niet levert; de slice maakt dan alleen een bestaande veilige draft-flow aan en rapporteert dit als warning.

## Convergentie

De migrations `20260928090000_control01_first_admin_invitation_enum.sql`, `20260928090100_control01_customer_bootstrap.sql` en `20260928090200_control01_payroll_import_staging.sql` zijn additive broncodecontracten en dragen `CONVERGENCE_REQUIRED`. Ze zijn in deze run niet op Supabase TEST toegepast en `packages/db/types.ts` is daarom niet opnieuw gegenereerd. Eerstvolgende convergentie moet de migrations, Supabase advisors, typegen en authenticated browsermatrix in die volgorde uitvoeren.
