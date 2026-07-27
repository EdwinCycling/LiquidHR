# FDR-0002 — Verzuimcasusscope en privacy

Datum: 26 juli 2026  
Status: Goedgekeurd voor implementatie

## Besluit

Verzuimgegevens zijn een afzonderlijke gevoelige domeinscope. `absence:read`, `absence:write` en `absence:recover` worden server-side en via RLS afgedwongen. De eerste release biedt geen `self:absence:write`.

Werkgeversinformatie bevat alleen noodzakelijke ziekmeldings- en re-integratiegegevens. Diagnose, symptomen, oorzaak, behandeling en medisch advies worden niet opgeslagen. Verzuimdata komen niet in algemene employeeprojecties, dashboardpayloads, zoekresultaten of AI-context.

## Auditing

Mutaties gebruiken de centrale auditfunctie. Casusdetail, documentmetadata en downloads krijgen een expliciete server-side leesaudit; gewone geaggregeerde kalender- en dashboardprojecties worden niet per rij als dossierinzage gelogd.
