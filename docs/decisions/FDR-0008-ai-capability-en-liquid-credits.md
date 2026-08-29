# FDR-0008 — AI-capability en Liquid Credits

- **Status:** Goedgekeurd — Wave 0 freeze
- **Datum:** 2026-08-28
- **Scope:** functioneel contract voor AI Foundation Wave 0/1A

## Besluit

LiquidHR spreekt met klanten over **Liquid Credits**. De drie klantkeuzes voor kwaliteit zijn:

- `Efficient` — laagste vaste feature/profile-charge;
- `Balanced` — standaardprofiel;
- `In-depth` — hoogste vaste feature/profile-charge.

De runtime rekent niet met provider tokens of klantonzichtbare modelnamen. Een feature registry kiest een vaste charge reference per profiel. Het toekomstige creditservice bepaalt de feitelijke reservering binnen de afgesproken HR-groep-balance.

Een AI-invocation:

1. is tenant- en HR-groep-gescopeerd;
2. vereist `ai:use` én een aparte business permission van de feature-adapter;
3. wordt eerst tegen enablement, edition, quota en HR-groep-balance gecontroleerd;
4. reserveert Liquid Credits atomisch vóór provider-executie;
5. settle't alleen na geldige output;
6. release't bij provider failure, provider unavailable of invalid result;
7. blijft charged wanneer de gebruiker een voorstel annuleert;
8. start met een nieuwe key en nieuwe charge bij `Try Again`;
9. voert geen tweede provider-call of charge uit bij een duplicate retry.

De eerste toekomstige capability, `improve-existing-hr-text`, levert alleen een voorstel en vereist menselijke beoordeling. AI voert geen HR-beslissing of write uit.

## Quota- en rolregel

Bij meerdere actieve rollen wint het hoogste toepasselijke kwaliteitsprofiel voor de quota-classificatie:

```text
In-depth > Balanced > Efficient
```

Er bestaan in V1 geen individuele overrides. De HR-groep-balance is een harde bovengrens, ook bij gelijktijdige gebruikers. De maandelijkse allowance wordt lazy gegarandeerd per `(tenant, hr_group, YYYY-MM)` in de canonieke HR-groep-timezone; een scheduler is geen voorwaarde.

## Privacy en audit

De business-audit legt vast wie, welke capability, welk business object, welk kwaliteitsprofiel, welke writing style, hoeveel Liquid Credits, welke status, welke correlatie en welke versies betroffen. De audit legt geen volledige tekst, prompt, response, raw HR-context, secret, token of providerprijs vast.

Technische usage is een afzonderlijke interne stroom voor providerstatus, beperkte usage-metadata en latency. Deze stroom wordt niet als klanttaal gebruikt.

## Consequentie voor Wave 1A

Wave 1A levert alleen ports, contracten, state handling, test-double en RLS/audit-seams. Er is geen echte wallet/ledger, geen paid provider en geen eerste UI-feature. Production execution blijft fail-closed totdat Wave 1B een goedgekeurde creditservice implementeert.
