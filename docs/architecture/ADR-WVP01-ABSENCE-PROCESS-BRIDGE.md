# ADR WVP01 — Verzuimbron en Process Automation verbinden

Datum: 2026-10-26. Status: lokaal geïmplementeerd, Core TEST-acceptatie OPEN.

De employmentgebonden `absence_cases`, `absence_spells` en `absence_capacity_changes` blijven eigenaar van ziekte en herstel. `absence_tasks` blijft eigenaar van mijlpalen. Eén nieuwe `absence_guidance`-rij koppelt de casus aan een bestaande Process Automation-instantie. Geen tweede casus-, proces- of autorisatiemodel.

De gewone productflow maakt en publiceert een administratiegebonden WVP-definitie via bestaande services. Daarvoor blijven de bestaande schrijf- en publicatierechten vereist. Een afwijkende draft wordt niet overschreven. Een procesversie is immutable; wettelijke termijnen zijn geen vrije tenantinstelling.

Mijlpaalbevestiging is één databasetransactie: scope en idempotentie controleren, gestructureerde evidence toevoegen, domeintaak afronden, bestaande PMUX-claim/act uitvoeren en volgende stap activeren. Een mislukte kernelactie rolt evidence en domeintaak terug. Databaseguards blokkeren generieke afronding zonder domeinevidence. Na herstel bestaat vanuit iedere stap een expliciete afsluitovergang; historie blijft behouden.

Elke mijlpaal heeft een eigen PMUX-stap. Vóór INSERT materialiseert een WVP-trigger de domeindatum, na de algemene SLA-materializer. Werkitems kopiëren deze met de bestaande trigger. Bestaande PMUX-deadlines of werkkalenderrevisies worden nooit aangepast. Volgende activaties lezen de actuele casusklok; de bestaande activatiesnapshot blijft een historisch/conservatief signaal.

De bestaande HR-publicatiepermission begrenst de queue. Managers gebruiken de bestaande teamhelpers voor dossiers en afspraken; werknemers hun eigen employee-link voor inzage en kennisname. Ontbrekende kandidaten worden niet met privileges of een willekeurige persoon opgelost. `/work` toont ook toegestane manageropvolging en eigen open kennisnames.

Gebeurtenissen bevatten alleen enums, datums, actor en referenties, zonder medische vrije tekst of attachments. RLS en expliciete RPC-autorisatie gelden beide. De applicatie gebruikt de normale Supabase-userclient.

De bronset, datumconventie, signalen versus wettelijke mijlpalen en open TEST-gates staan in [het productcontract](../requirements/absence/WVP_POORTWACHTER_ENGINE.md).
