# BRAND01 — LiquidHR productbranding

**Status:** geïmplementeerd op een lokale featurebranch; zie de gedateerde acceptance-run voor bewijs en grenzen.

## Goedgekeurde assets

De ongewijzigde assetpack staat onder `apps/hr-suite/public/brand/logo/`. Alle 23 verwachte bestanden uit `README.md` zijn aanwezig. De PNG-signaturen zijn geldig. De primaire horizontale master is 2039 × 678, het woordmerk 2030 × 665 en het beeldmerk 1254 × 1189. Hun transparante varianten hebben alfatransparantie. De favicon-PNG's zijn 16 × 16 en 32 × 32; de PWA-iconen zijn 192 × 192 en 512 × 512; het Apple touch icon is 180 × 180. `favicon.ico` bevat geldige 16, 32 en 48 px entries.

De `.svg`-bestanden bevatten ingebedde rasterdata en zijn geen native vectoren. De witte PNG-varianten hebben een ondoorzichtige witte achtergrond. De horizontale, woordmerk- en beeldmerkmasters zijn byte-identiek aan hun transparante varianten. De PNG's bevatten geen ingesloten ICC-, sRGB- of gamma-profielmetadata.

De vierkante `app-icon.png`-master is 1052 × 1026 en de transparante variant is 1149 × 1221; die zijn daarom niet als web-, PWA- of Apple-icon geregistreerd. Daarvoor gebruikt de app uitsluitend de gecontroleerde vierkante platformiconen.

## Component en plaatsingen

`apps/hr-suite/components/layout/liquidhr-logo.tsx` is de centrale component. Hij ondersteunt `horizontal`, `wordmark` en `mark`, elk in de maten `xs`, `sm`, `md` en `lg`. De component gebruikt de transparante PNG-masters, legt de intrinsieke afmetingen vast en geeft een passende `sizes`-waarde aan Next Image mee. Daarmee reserveert de browser de juiste beeldverhouding en vraagt hij een kleine geoptimaliseerde variant op. De logo-afbeelding gebruikt `loading="eager"` omdat deze boven de vouw staat; er wordt geen head-preload afgedwongen.

De assetpack bevat geen lichte variant met transparante achtergrond. Daarom staat de officiële transparante afbeelding op een kleine witte, afgeronde contrastplaat. De afbeelding zelf bevat geen witte rechthoek; de plaat houdt het donkerblauwe woordmerk leesbaar op donkere, lichte en bedrijfsthema-oppervlakken. De component geeft standaard de alttekst `LiquidHR`; `decorative` maakt de afbeelding decoratief wanneer de omringende link al een toegankelijke naam heeft.

Gebruikte varianten:

| Positie | Variant |
| --- | --- |
| Auth-shell desktop (login, uitnodiging, wachtwoordherstel en OAuth-schermen) | horizontaal, `lg` |
| Auth-shell mobiel boven het formulier | horizontaal, `md` |
| HR Suite desktop-sidebar uitgeklapt | horizontaal, `sm` |
| HR Suite desktop-sidebar ingeklapt | beeldmerk, `sm` |
| Mobiele hoofdheader | horizontaal, `sm` |
| Focus ESS/MSS-header | horizontaal, `sm` |

## Product- en klantbranding

De productlogo's linken in de navigatie naar de bestaande HR Suite-startpagina. Een ingesteld `preferences.companyBranding.logoUrl` blijft ongewijzigd en staat los van het LiquidHR-logo: naast de mobiele topbar verschijnt het achter een scheidingslijn; in de uitgeklapte sidebar staat het als HR-groepbranding op een afzonderlijke regel. De HR-groep- en administratiekeuze, bedrijfsthema's en LinkedHR blijven werken. Er zijn geen database-, instellingen- of autorisatiewijzigingen.

Plaatsen zonder ingesteld klantlogo gebruiken een neutraal gebouwicoon in de bedrijfsbrandinginstellingen en op openbare vacatures; de oude `LH`-initialen suggereren daar geen LiquidHR-productlogo meer.

Er is geen codegegenereerd logo of letterfallback: een ontbrekend assetpad is een fout die de asset- en HTTP-controles moeten vangen, geen reden om een niet-goedgekeurde variant te tonen.

## Browser- en PWA-metadata

De app gebruikt één expliciete `metadata.icons`-configuratie met openbare paden naar de goedgekeurde `.ico`, 16 × 16 PNG, 32 × 32 PNG en Apple touch icon. Het oude `app/icon.svg` is verwijderd, zodat Next.js geen tweede oud icoon registreert. `/brand/logo` en `/manifest.webmanifest` zijn expliciet publiek in de routebeveiliging; anders krijgt Next Image een loginredirect in plaats van een afbeelding. De productnaam is `LiquidHR` in `title`, `applicationName`, NL- en EN-berichten.

`app/manifest.webmanifest` volgt de Next.js-bestandsconventie. `start_url` en `scope` zijn `/`; de bestaande rootroute stuurt door naar `/dashboard/start`. De manifest-iconen zijn de gecontroleerde 192 × 192- en 512 × 512-PNG's. De kleurwaarden `#14264a` en `#f3f5f9` komen overeen met respectievelijk `--primary` en `--background` van het standaardtheme `liquid-navy`. Geen icoon is als `maskable` opgegeven. De bestaande metadata-description blijft gelijk. Er is geen service worker, offline-cache, pushnotificatie of installprompt toegevoegd.

## Assets later veilig vervangen

Vervang de masters alleen met de opnieuw goedgekeurde bronbestanden en behoud de vaste openbare bestandsnamen. Controleer eerst PNG-signatuur, dimensies, vierkantheid waar van toepassing, alfakanaal, profielmetadata, visuele leesbaarheid en SVG-inhoud. Werk alleen de mapping in `LiquidHRLogo`, de favicon-/Apple-URLs of manifesticonen bij wanneer de bronbestandsnamen of platformmaten wijzigen. Behoud masterbestanden en registreer `maskable` pas na een expliciete veilige-uitsnedecontrole.
