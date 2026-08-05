# ADR-0003 — Employee, Employment, IKV en herintreding

> **Actuele aanvulling 2026-08-05:** de persoonskaart is binnen één HR-groep uniek, niet als gebruikersscope tenantbreed. Het doelmodel voor meerdere HR-groepen, vaste CAO per dienstverband en de UX-keuze bij meerdere actieve dienstverbanden staat in [HR-groepen: scope, inrichting en domeingrenzen](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md). De historische tenantbrede formulering hieronder blijft behouden voor de eerdere implementatie.

Datum: 15 juli 2026  
Status: Goedgekeurd

## Context

Een persoon kan zonder dienstverband in een administratie voorkomen, meerdere gelijktijdige dienstverbanden hebben en na volledig uitdienst opnieuw terugkomen. De fiscale inkomstenverhouding (IKV) is niet hetzelfde als de contractuele arbeidsrelatie.

## Besluit

- Employee is een blijvende identiteit binnen precies één HR-groep en heeft nul tot meerdere Employments. Een technische accountkoppeling kan dezelfde natuurlijke persoon aan een andere HR-groep verbinden zonder HR-gegevens te delen.
- Employment is administratiegebonden; overlap is toegestaan, ook binnen dezelfde administratie.
- IKV staat in `income_relationships` en is via een effectieve koppeltabel historisch aan Employment gekoppeld.
- Arbeidsvoorwaarden, rooster, salaris en kostenverdeling gebruiken niet-overlappende halfopen perioden `[valid_from, valid_until)`.
- Een uitdiensttreding is een geaudite workflow met een administratiegebonden interne reden en een versiegebonden wettelijke code.
- De wettelijke 2026-codes volgen het [Handboek Loonheffingen 2026, paragraaf 29.28](https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf). Code 31 is vanaf 1 januari 2026 vervallen en vervangen door 32, 33 en 34.
- Arbeidsstatus wordt afgeleid: nooit in dienst, toekomstig, actief of uit dienst. Eén actief parallel Employment houdt de persoon actief.
- Een herintreder hergebruikt de bestaande Employee. Een exacte BSN-match binnen dezelfde tenant blokkeert een duplicaat; zonder BSN volgt beperkte tenant-only kandidaatmatching met menselijke beslissing.
- De BSN-vingerafdruk is HMAC-SHA-256 over tenant-ID en genormaliseerd BSN. Daardoor is dezelfde persoon niet database-side over tenants te correleren.

## Gevolgen

`employees.is_active` betekent alleen dat de persoonskaart niet is gearchiveerd. BSN, de HMAC-invoer en vingerafdruk komen niet in URL's, logs of analytics. Salaris-RLS blijft gescheiden van contract-RLS.

Vervangen besluiten: geen.
