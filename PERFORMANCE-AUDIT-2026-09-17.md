# Performance-audit FLIPMEDIA — 17 september 2026

De mobiele framebuffer bevatte een reproduceerbare fout die na het stoppen met scrollen bleef laden en decoderen. Die fout is veilig gecorrigeerd, gepubliceerd en op de echte productieversie opnieuw getest. Dit bewijst niet dat alle haperingen op fysieke iPhones zijn opgelost: de beschikbare cloudbrowser kan geen betrouwbare GPU-, WebGL- of iOS Safari-performance meten.

Productie: https://flipmedianl.github.io/mijn-web/  
Repository: https://github.com/Flipmedianl/mijn-web  
Uitgangscommit: `d1506f08c511aff270d35c7f3b775bb47d8a5f76`  
Performancecorrectie: `00ac4f72fadfc623ba1c1316fdaa97a45b9c5f72`  
Herstelbranch: `backup/performance-d1506f0`

## Uitkomst en bewijskracht

| Classificatie | Resultaat |
|---|---|
| **BEWEZEN VERBETERING** | Live stilstand op frame 30: 6 extra frame-fetches in 4 seconden vóór de correctie, 0 erna. De oude fetches kwamen uit de browsercache, maar activeerden opnieuw de decoder. Dit was overbodig werk, geen extra netwerkdownload. |
| **BEWEZEN VERBETERING** | Deterministische reproductie: 80 laad-/decodeacties in 40 stilstaande updates vóór de correctie; 2 noodzakelijke acties erna. Nieuwe regressietest controleert vooruit én achteruit. |
| **BEWEZEN BEHOUD** | Hetzelfde mobiele buffergebruik bij deze live test: 21 bitmaps / 32.659.200 bytes. Alle 61 frames, bronresoluties, compressie, scrollafstand, canvasresolutie en avatarmodellen blijven behouden. |
| **WAARSCHIJNLIJKE VERBETERING** | Minder decoderwerk, allocaties en animatiecallbacks verlaagt CPU-/energiedruk bij stilstand en maakt capaciteit vrij tijdens scrollen. Het fysieke effect op iPhone-framerate is niet gemeten. |
| **NIET VERIFIEERBAAR** | Fysieke iPhone-framerate, GPU-tijden, Safari-geheugendruk, visuele avatarfideliteit in WebGL en echte gebruikers-INP. |

## Project en productie

Statische HTML, CSS en ES-modules, zonder framework, CMS, package manifest of runtime-build. GitHub Pages publiceert vanuit `main` via de bestaande automatische workflow `pages build and deployment`. Geen aparte applicatieserver of server-side rendering. GitHub/Fastly verzorgt de edgelevering.

De lokale werkmap bevatte aanvankelijk geen project. De toegankelijke GitHub-repositories zijn geïnspecteerd en het project is gekloond. De Git-status was schoon. Gericht onderzocht: HTML, CSS, beide JavaScript-modules, performancedocumentatie, vijf bestaande workflows, media-buildscript, tests, framebestanden en GLB/video-metadata. Geen README, AGENTS.md, CLAUDE.md, sitemap, robots.txt of CNAME aangetroffen in deze repository. Geen expliciete canonical-tag: de geverifieerde productie-URL hierboven is de audit-URL, geen beweerde ingestelde canonical.

De HTML bevat geen formulieren, analytics-/trackingtags of expliciete JSON-LD. CTA's zijn interne ankerlinks. Er is dus geen bestaand formulier- of trackingverkeer om in deze versie end-to-end te testen. Deze onderdelen en de content zijn niet gewijzigd.

HTTPS levert 200. HTTP en de URL zonder afsluitende slash leveren 301 naar de HTTPS-URL met slash. HTML wordt met gzip geleverd, `Cache-Control: max-age=600`, HSTS en `Vary: Accept-Encoding`. CDN-headers tonen Fastly/varnish en cache-MISS bij de onderzochte originrequests. Geen bewijs dat langduriger caching ontbrekende functionaliteit veroorzaakt; GitHub Pages-cachebeleid is niet aangepast.

De oorspronkelijke live HTML was byte-identiek aan de uitgangscommit. Na deployment zijn HTML én `site.js?v=9` opnieuw live opgehaald en met SHA-256 vergeleken: beide exact gelijk aan de aangepaste bestanden. Ook de browser laadde aantoonbaar `site.js?v=9`. De productie-deployment van de correctie is geslaagd: https://github.com/Flipmedianl/mijn-web/actions/runs/35255833319.

## PageSpeed Insights: drie geldige runs per profiel, vóór en na

De hoofdpagina is de enige bezoekerspagina. De belangrijke secties daarvan zijn aanvullend afzonderlijk doorlopen. De technische testpagina is geen tweede commerciële landingspagina.

**Field data:** PageSpeed meldt op mobiel en desktop **Geen gegevens**. Er is geen bruikbare CrUX-uitkomst voor LCP, INP, CLS, FCP of TTFB. Ontbrekende data is geen geslaagde Core Web Vitals-test. TBT is geen vervanging voor INP.

**Lab data:** dezelfde productie-URL, Lighthouse 13.4.1, mobiel Moto G Power met langzame 4G en desktop met de standaard desktopinstellingen. Mediaan van drie geldige runs; tijden in milliseconden, CLS dimensieloos.

| Metric | Mobiel vóór | Mobiel na | Desktop vóór | Desktop na |
|---|---:|---:|---:|---:|
| Performance | 99 | 100 | 100 | 100 |
| FCP | 794 | 796 | 238 | 223 |
| LCP | 1.054 | 1.054 | 284 | 343 |
| TBT | 0 | 0 | 0 | 0 |
| CLS | 0 | 0 | 0 | 0 |
| Speed Index | 3.552 | 2.161 | 334 | 382 |

**Interpretatie:** de initiële mobiele LCP is niet verbeterd. Speed Index varieerde aanzienlijk: vóór 767–3.617 ms en na 796–2.210 ms. De buffercorrectie richt zich op scrollen/stilstand verder in de sequence en bewijst geen oorzaak-gevolgrelatie met de hogere Lighthouse-score. Desktop-LCP en Speed Index waren iets hoger; één desktopnameting had 16 ms TBT (UI afgerond 20 ms), de andere twee 0. Geen consistente startupversnelling of structurele startupregressie aangetoond.

| Run | Mobiele score / FCP / LCP / TBT / CLS / SI | Desktopscore / FCP / LCP / TBT / CLS / SI |
|---|---|---|
| Vóór 1 | 99 / 797 / 1057 / 0 / 0 / 3617 | 100 / 220 / 284 / 0 / 0 / 280 |
| Vóór 2 | 100 / 767 / 767 / 0 / 0 / 767 | 100 / 238 / 283 / 0 / 0 / 334 |
| Vóór 3 | 99 / 794 / 1054 / 0 / 0 / 3552 | 100 / 278 / 288 / 0 / 0 / 497 |
| Na 1 | 100 / 796 / 796 / 0 / 0 / 796 | 100 / 223 / 343 / 0 / 0 / 382 |
| Na 2 | 100 / 823 / 1054 / 0 / 0 / 2161 | 100 / 223 / 343 / 0 / 0 / 382 |
| Na 3 | 100 / 786 / 1067 / 0 / 0 / 2210 | 100 / 414 / 679 / 16 / 0 / 705 |

PageSpeed-rapporten, elk met mobiel- en desktoptab:

- Vóór: [run 1](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/8y6515la3g?form_factor=mobile), [run 2](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/ldgh035jvx?form_factor=mobile), [run 3](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/7yalupu6jc?form_factor=mobile).
- Na: [run 1](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/s0u89121hm?form_factor=mobile), [run 2](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/f6bxq3fo22?form_factor=mobile), [run 3](https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/euvuj2g8dh?form_factor=mobile).

De anonieme PageSpeed-API gaf een quota-429; daarom zijn de geldige metingen via de openbare PageSpeed-interface uitgevoerd, zonder Google-accountkoppeling. Twee mislukte nametingspogingen met URL-resolutiefout zijn uitgesloten.

**TTFB-beperking:** de PSI-LCP-uitsplitsing toonde 0 ms TTFB en in een run een documentlatency-auditfout. Dat is niet als betrouwbare servermeting gebruikt. De diagnostische iframe-navigatie was warm gecachet (circa 0,2 ms, nul transferbytes). De shellroute via de testomgeving mat een mediane eerste-byte-tijd van 7,675 s vóór, tegenover 8,177 s in één nacontrole; deze route bevat proxy-/omgevingsvertraging en is niet representatief voor bezoekers. CDN-headers lieten circa 49–50 ms edgeverwerking zien. Er is onvoldoende bewijs om hosting als de scrollbottleneck aan te wijzen.

## Netwerk en media

Onderstaande laadgewichten zijn expliciet gescheiden van volledige scrollsessies. Gzipwaarden zijn met HTTP opgehaald; framegewichten zijn de werkelijke bronbestanden. De som is een body-budget, exclusief headers en eventuele dubbele resource-accounting. Dit is geen PSI-mediaan.

| Initiële pagina | Mobiel vóór → na | Desktop vóór → na |
|---|---:|---:|
| HTML, gzip | 2.772 → 2.775 B | 2.772 → 2.775 B |
| JavaScript, gzip | 4.279 → 4.399 B | 4.279 → 4.399 B |
| CSS, gzip | 2.904 → 2.904 B | 2.904 → 2.904 B |
| Framebuffer-afbeeldingen | 263.094 → 263.094 B | 604.036 → 604.036 B |
| Body-budget totaal | 273.049 → 273.172 B | 613.991 → 614.114 B |
| Video / 3D bij initiële laad | 0 → 0 B | 0 → 0 B |
| Resource Timing entries incl. document | 17 → 17 | 14 → 14 |
| Derden bij initiële laad | 0 → 0 | 0 → 0 |

De requestentries bevatten de gecachete fetch van het al voorgeladen eerste frame. Het aantal werkelijke netwerktransfers kan dus lager zijn. PSI's payload-audit toonde circa 298 KiB mobiel en 668 KiB desktop in de geïnspecteerde vóór- en narapporten; dat is een andere telmethode/meetfase dan bovenstaand body-budget, geen reductieclaim. Bij bezoek aan de avatar komen model-viewer en eventueel decoderafhankelijkheden van derden erbij. Dat deel is niet volledig als live netwerkpad getest doordat WebGL in deze browser ontbreekt.

**Cinematic intro:** 61 WebP-frames. Desktop 1280×720, totaal 4.038.442 B, 59.414–79.220 B per frame. Mobiel 540×720, totaal 1.566.736 B, 19.796–33.408 B per frame. De repository bevat daarnaast desktopframes 62–122 voor de latere mediascène. Het oorspronkelijke encoderkwaliteitsgetal is niet betrouwbaar uit het beeldbestand af te leiden; de historische workflow noemt q72. Geen recompressie uitgevoerd.

Eén ongecomprimeerde mobiele bitmap gebruikt ongeveer 1.555.200 bytes; alle 61 zouden circa 90,5 MiB kosten, exclusief canvas/decoder/browseroverhead. De bestaande 32-MiB-limiet bewaart maximaal 21 van deze bitmaps. Desktop bewaart bij 64 MiB maximaal 18 bitmaps. Maximaal drie mobiele of vier desktoplaad-/decodetaken tegelijk; twee op beperkte verbindingen. Vooruitbuffer: 12 mobiel, 9 desktop; drie achteruit plus huidig/doelframe. Bitmaps worden buiten de nabijheidszone en bij verborgen tab vrijgegeven. De canvas-DPR-caps blijven 1,25 mobiel en 1,5 desktop.

De mobiele intro is 155svh, met 55svh effectieve scrubafstand: ongeveer 464 px bij 844 px schermhoogte. Sectie 2 overlapt bovendien met 9vh en komt daardoor eerder in beeld. Verder verkorten is hier niet onderbouwd; de animatie heeft al een korte mobiele scrollweg. Desktop blijft 380svh / 280svh scrubafstand. Geen video-scrubbing als vervanging van de intro toegepast.

**Avatar:** mobiel én desktop gebruiken het bestaande `avatar-desktop.glb`: 1.035.428 B, 126.396 driehoeken, Draco-meshcompressie en drie WebP-textures van 1024×1024. Het origineel `avatar-mobile.glb` blijft behouden: 2.738.884 B, 632.002 driehoeken. De afgewezen 512.904-B-variant staat nog als ongebruikte asset in de repository; hij wordt niet geladen. Documentatie die anders suggereerde is bijgewerkt.

3D wordt pas nabij de sectie geïmporteerd, heeft geen auto-rotate, geen mobiele schaduw en alleen gekwantiseerde scrollgestuurde cameraveranderingen. De vastgepinde model-viewer 4.1.0-broncode slaat rendering van ongewijzigde/onzichtbare scènes over en reset de scène bij verwijderde `src`. KTX2/Basis kan ongecomprimeerd texturegeheugen beperken, maar zonder GPU-profiel of visuele vergelijking is een conversie geen bewezen veilige verbetering. Daarom geen nieuwe polygonreductie, lager-resolutietextures of onbewezen vervangende avatar geïntroduceerd. De bestaande foutfallback is tekst/cards, geen hoogwaardige avatarposter; een visueel gelijkwaardige mobiele fallback blijft ongerealiseerd en onbewezen nodig.

**Video:** `scale-mobile.mp4` is 456.054 B, H.264 540×304, 61 frames op 30 fps, 2,033 s. Alle frames zijn keyframes, passend bij seeking. Desktopvideo is 1.195.434 B. Geen initiële `src`, preload uitgesteld, één seek tegelijk, laatste target wordt na `seeked` verwerkt, bron wordt buiten de sectie verwijderd. De bestaande tests voor serialisatie en uiteindelijke seekpositie slagen. Geen codec-, video- of kwaliteitswijziging nodig op basis van het beschikbare bewijs.

## Oorzaak, prioriteit en wijziging

**Prioriteit 1 — decodecyclus, hoge impactpotentie en laag wijzigingsrisico.** Het oude `trim()` sorteerde uitsluitend op afstand tot het huidige frame. Bij frame 30 bleef nabijgelegen oude geschiedenis bewaard, terwijl gewenste vooruitframes 41 en 42 als verste frames werden weggegooid. Elke voltooide decode plande een update; die vroeg dezelfde ontbrekende frames opnieuw op. Ook bij stilstand ontstond daardoor herhaald fetch/decode/close-werk. Een geheugenlimiet alleen detecteert deze fout niet.

`FramePool.reconcile()` bewaart nu de gewenste set. `FrameSequence.trim()` verwijdert eerst ongewenste geschiedenis en gebruikt daarna pas afstand. Het laatst getekende frame en de bestaande geheugenlimiet blijven beschermd. De runtimewijziging bestaat uit zes toegevoegde regels en één vervangen regel. Geen andere visuele of commerciële code gewijzigd.

**Overige bevindingen:** LCP was de hero-`h1` “Van aandacht naar inkomen.”, niet de 3D-avatar. PSI noemt renderblokkerende CSS met een geschatte besparing tot 300 ms; de kleine CSS is niet invasief herschreven omdat LCP al goed is en flash/layoutregressies daarmee niet gerechtvaardigd zijn. CLS was in alle labmetingen nul; geen daadwerkelijk verschuivend element gevonden. Geen bewijs voor slechte gebruikers-INP. Geen voortdurend actieve eigen scrolllus wanneer er geen werk is, behalve de nu verholpen decodecyclus. CSS verandert voornamelijk opacity/transform; mobiele backdrop-blurs waren al uitgeschakeld. Echte compositing-/GPUkosten blijven buiten het meetbereik.

Gewijzigde bestanden:

- `assets/js/site.js`: gewenste framebuffer beschermen tegen herhaald weggooien.
- `index.html`: versieparameter van site.js naar v9 voor nieuwe caches.
- `tests/frame-cache.cjs`: regressie op stilstand, beide richtingen, huidige frameafmetingen en geheugenbudget.
- `tests/performance.html` en `tests/performance.js`: live buffer-rusttest, meer netwerkgegevens en verse HTML per nieuwe diagnostische sessie.
- `PERFORMANCE.md`: juiste avatarkeuze, bufferbeleid en testinstructies.
- Dit rapport en `tests/audit-*.json`: meetbewijs.

## Productievalidatie en beperkingen

Mobiele en desktop-scrolltests slagen vóór én na voor: geen vroeg geladen zware media, frame 61 aan het einde, frame 1 bij terugkeer, begrensd bitmapgeheugen, media vrijgeven buiten secties, juiste uiteindelijke videopositie en geen geobserveerde site-scriptfouten. De nieuwe stilstandtest faalde vóór en slaagt na. De mobiele nacontrole is ook opnieuw vanuit een verse iframe uitgevoerd, zodat eerder gevulde buffers de laadvergelijking niet beïnvloeden.

Handmatig via browserautomatisering gecontroleerd: hero zichtbaar, mobiele lay-out, systeem-CTA, avatarnavigatie, start-CTA en terug-naar-boven. De bronbeelden, CSS en modellen zijn byte-ongewijzigd; er is geen geconstateerde visuele regressie in de bekeken weergaven. Geen claim van een volledige pixelvergelijking of WebGL-kwaliteitscontrole.

De cloudbrowser vertraagt animation callbacks tot ongeveer 1.017 ms. De gemeten 7–9 waargenomen frames in de scrolltest zijn daarom geen bewijs voor dropped frames bij echte bezoekers. Geen bruikbare WebGL-context: alleen de avatarfallback kon live worden gecontroleerd. Geen fysieke iPhone, Safari-profiel, GPU-trace, totale browserheap of GPU-memorymeting beschikbaar. Bitmap-bytecounters omvatten geen volledige browser/GPU-overhead. De browserconsole bevatte uitsluitend waargenomen extensiemeldingen, geen nieuwe sitefouten; het volledige 3D-netwerkpad kon niet worden doorlopen.

De bestaande toegankelijkheidsscore bleef 92 mobiel / 95 desktop, met bestaande contrastmeldingen; SEO en best practices bleven 100. Dit zijn beperkte automatische controles, geen volledige toegankelijkheids- of SEO-certificering.

## Herstel en reproduceerbaarheid

De veilige herstelbranch bewaart de oorspronkelijke werkende versie. De runtimecorrectie kan met een normale revert van commit `00ac4f7` worden teruggedraaid; geen force-push of infrastructuurwijziging nodig. De twee aanvullende diagnostiekcommits wijzigen geen bezoekersfunctionaliteit.

Reproduceerbare lokale controles: `node tests/frame-cache.cjs`, `node tests/scheduler.cjs`, `node tests/video.cjs`. Live diagnostiek: https://flipmedianl.github.io/mijn-web/tests/performance.html. Meetdetails staan in `tests/audit-results-2026-09-17.json`; HTTP-metingen en live hashes in `tests/audit-network-2026-09-17.json`.
