# FDR-0001 — Documentzichtbaarheid en reminderdoelgroepen

Status: GOEDGEKEURD
Datum: 2026-07-18

## Besluit

Een document in een medewerkersdossier is alleen zichtbaar wanneer de server-side/RLS-permission én minstens één geconfigureerde doelgroep toegang geven. Doelgroepen mogen worden gecombineerd:

- de medewerker zelf;
- een tenantrol;
- een afdeling inclusief onderliggende afdelingen.

Een documentvervalreminder gebruikt dezelfde combinaties, aangevuld met een expliciete persoon. Publicatie resolveert alle doelgroepen naar concrete ontvangers en dedupliceert deze. De private opslag-key wordt nooit als publieke URL bewaard; downloaden gebruikt een kortlevende signed URL. Verwijderen is standaard soft-delete en blijft auditbaar.

## Gevolgen

- Alleen UI-verberging is onvoldoende; API en RLS dwingen dezelfde grens af.
- Een rol of afdeling geeft geen toegang zonder de canonieke documentpermission.
- Wijzigingen in het organogram of rolhouderschap werken door in dynamische documentzichtbaarheid.
- Gepubliceerde reminderontvangers vormen een controleerbare momentopname.
- AI/RAG leest later uitsluitend documenten die de aanroeper volgens deze regels mag lezen.
