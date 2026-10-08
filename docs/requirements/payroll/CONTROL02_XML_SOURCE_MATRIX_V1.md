# CONTROL02 XML-bronmatrix V1

**Status:** read-only parsercontract en formele server-only runtimevalidatie gereed voor de officiële LH2026 v2.0-bron. De validator accepteert uitsluitend het vastgepinde XSD met de gecontroleerde SHA-256; desktop/390px- en gehoste runtimeacceptatie blijven apart open.

**Controle:** 2026-10-03, branch `work/CONTROL02-XML-V1-20261003`, baseline `6349d02538351cd01fc51f298c6e6fa0ba88006c`.

## Officiële herkomst

| Jaar/versie | Bron | Namespace | XSD-evidence | Parserstatus |
| --- | --- | --- | --- | --- |
| 2026 / v2.0 | [ODB release notes Loonheffingen Aangifte 2026v09](https://odb.belastingdienst.nl/documentatie/loonheffingen-aangifte-2026v09/) en het officiële [LH2026v09.zip](https://odb.belastingdienst.nl/wp-content/uploads/2026/01/LH2026v09.zip) | `http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01` | `Loonaangifte2026v2.0.xsd`, ZIP SHA-256 `134CF1464CCCE87ACFF81C8C624C0AD31878A43E541BABB46514926912B1836E`, XSD SHA-256 `EB862BEA8C7232154CFB30BB37C4ECF192B4A86540944358B065BB7FA54FC441` | `SUPPORTED_READ_ONLY`; formele runtimevalidatie geeft `VALIDATED` of `INVALID`; niet-gevalideerde/ontbrekende schema-asset faalt gesloten |
| 2026 gegevensspecificatie | [Belastingdienst Gegevensspecificaties aangifte loonheffingen](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/gegevensspecificaties-aangifte-loonheffingen), versie 3.1 van 1 juli 2026 | geen namespacebron | De PDF beschrijft betekenis en formaat; het document is zelf geen XSD | Alleen semantische veldreferentie; geen zelfstandige schema-green |
| 2027 | [ODB planningsoverzicht 2026 doelgroep Salaris](https://odb.belastingdienst.nl/salaris/planningsoverzicht-salaris/) | niet geregistreerd in deze parser | Geen 2027-artefact gebruikt voor 2026 | `SOURCE_GAP` / `UNSUPPORTED_YEAR`; 2027 mag 2026 niet valideren |
| 2025 en ouder | Geen gecontroleerd bronartefact in deze checkout voor CONTROL02 | niet geregistreerd | `SOURCE_GAP` totdat exact jaar, namespace, release-artefact en XSD zijn geïnventariseerd | Niet parserbaar |

De release notes noemen de definitieve LH2026-release en het XSD-artefact expliciet. De officiële 2026 gegevensspecificatie noemt werknemersgegevens, inkomstenverhouding, natuurlijk persoon, `NumIV`, `LhNr`, `DatAanv`, `DatEind`, `PersNr`, `SofiNr`, `Voorl`, `SignNm`, `Gebdat`, `Nat`, `Gesl` en `Inkomstenperiode` als afzonderlijke bronbegrippen. De parser gebruikt alleen deze aantoonbaar gedocumenteerde importrelevante velden.

## Parsercontract

De implementatie staat onder `apps/hr-suite/lib/payroll-import/xml/` en blijft los van `lib/payroll-import/model.ts` en `source-adapter.ts`.

```ts
parseLoonaangifteXml({
  bytes,
  context: {
    identity: {
      protectBsn: (bsn) => serverOwnedProtectedFingerprint(bsn),
    },
  },
})
```

Een succesvolle parse geeft:

- `status: "SUPPORTED_READ_ONLY"`;
- `profile` met jaar, namespace, release-URL en gecontroleerde checksums;
- `document` met de volledige `LhNr`, aangiftetijdvakken, gegroepeerde bronpersonen en IKV-relaties;
- `xsdValidation: "VALIDATED"` als het document tegen het hash-gecontroleerde officiële XSD slaagt.

De parser retourneert nooit het ruwe `SofiNr`. De caller moet een server-only beschermingsfunctie meegeven. Die functie moet een lowercase SHA-256-vormige fingerprint (64 hextekens) retourneren; de parser weigert andere waarden. De concrete fingerprintstrategie, sleutelbeheer en matchservice blijven bij Core/security. Een browser of externe XML-bron mag geen voorbewerkte fingerprint aanleveren.

De eerste persoonidentiteit wordt gegroepeerd op de door de server beschermde BSN-fingerprint. Als BSN ontbreekt, wordt alleen een brongebonden `PersNr` gebruikt; als beide ontbreken blijft de rij afzonderlijk (`row:<nummer>`) zodat downstream matching handmatige beoordeling kan afdwingen. Twee IKV's van dezelfde beschermde bronpersoon blijven één parserpersoon met twee relaties. De parser maakt geen Employee, Employment, IKV, salaris- of arbeidsvoorwaardenrecord.

`SignNm` wordt bewaard als `significantSurnamePart`; het wordt niet als volledige achternaam of `birthName` ingevuld. `DatEind` blijft de bronwaarde; de omzetting naar een eventueel halfopen Core-interval is bewust niet in deze parser opgenomen. `NumIV` volgt het officiële 2026 XSD-bereik (0–9999); bestaande LiquidHR-matchvalidatie beslist later of de Core-contractgrens nauwer is.

## Veiligheids- en fail-closed-contract

De veilige XML-scanner en XSD-validator:

- decodeert uitsluitend UTF-8/US-ASCII en berekent een SHA-256 bronhash;
- weigert DTD, `ENTITY`, externe entiteiten, onveilige XML-declaraties en onbekende entiteitsreferenties;
- begrenst bronbytes, elementdiepte, elementaantal en tekstgrootte;
- controleert gebalanceerde tags, dubbele attributen, namespacebindingen en schema-rootmetadata;
- valideert de 2026 v2.0-documentstructuur met uitsluitend de lokale asset `apps/hr-suite/lib/payroll-import/xml/schemas/Loonaangifte2026v2.0.xsd`, na controle van SHA-256 `EB862BEA8C7232154CFB30BB37C4ECF192B4A86540944358B065BB7FA54FC441`; schema-validatiefouten geven een generieke `XML_XSD_INVALID`-diagnose zonder ruwe persoonsvelden;
- weigert validatie als de asset ontbreekt of de hash niet exact overeenkomt (`XSD_UNAVAILABLE`); schema-resolutie naar netwerk of externe entiteiten staat uit;
- test expliciet ontbrekende en hash-afwijkende schema-bytes, een schema-compilatiefout en de parserafwijzing wanneer de validator unavailable is; registry en validator importeren de hash uit één gedeelde constante;
- maakt `UNSUPPORTED_YEAR`, `UNSUPPORTED_NAMESPACE`, `UNSUPPORTED_SCHEMA_VERSION`, `XML_MALFORMED`, `XML_UNSAFE_DOCTYPE`, `XML_TOO_LARGE`, `XML_TOO_DEEP`, `MALFORMED_VALUE` en `IDENTIFIER_PROTECTION_REQUIRED` onderscheidbaar;
- retourneert bij contract- of veiligheidsfouten geen gedeeltelijk canonical document.

De parser leest alleen in-memory bytes. Er is geen XML-staging, geen Core-write, geen Payroll Lab-write, geen log van XML/BSN en geen wijziging aan bestaande importservices. `SUPPORTED_READ_ONLY` beschrijft een lokale parser-/validatiestatus en is geen browser-, gehoste of productieacceptatie. De gerichte tests bewezen een geldige synthetische fixture, afwijzing van een XSD-onvolledig document en fail-closed gedrag bij validatorbeschikbaarheid. De productiebuild bevat de hash-gecontroleerde asset in de API-route-trace; een gehoste runtime is niet gedeployed of getest in deze ronde.

De officiële XSD is in root `.gitattributes` als binary gemarkeerd. De staged Git-blob en production build asset behielden de gepinde hash en lengte van 28.315 bytes. `libxml2-wasm` staat in `serverExternalPackages` voor de Node-route; de lokale browserroute is na die runtimefix opnieuw geladen en bereikte de bestaande permissionguard. Dat bewijst geen gehoste server-runtime.

## Fixture en beperkingen

`apps/hr-suite/lib/payroll-import/xml/fixtures/loonaangifte-2026-v2.0.synthetic.xml` is een synthetische, niet-persoonsgebonden contractfixture met één bronpersoon met twee IKV's en één BSN-loze bronpersoon. De bijgewerkte fixture is gevalideerd tegen het exacte officiële XSD; ze is geen klantbericht of officiële productie-export en bewijst geen compatibiliteit met alle echte exports.

De volgende assertions blijven buiten deze slice:

1. geauthenticeerde desktop-/390px-browseracceptatie en gehoste server-runtimevalidatie;
2. officiële productie-/klant-XML met gecontroleerde herkomst en brede exportrepresentativiteit;
3. jaar-/tijdvakgebonden LhNr-readiness tegen Core;
4. definitieve Employee-, Employment-, IKV- of salariswrites;
5. matching, expliciete gebruikersbevestiging, immutable provenance en recovery.
