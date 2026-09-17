> Historisch rapport van de twee-video-release. De intro is daarna vervangen door de omkeerbare sectie-overgang; zie PERFORMANCE.md en tests/transition-production-results.json.

# Cinematic release — 17 september 2026

Productie: https://flipmedianl.github.io/mijn-web/
Implementatie: af48632f970d20ed15a07a10b7835c0f041bd2a8
Geslaagde Pages-deployment: https://github.com/Flipmedianl/mijn-web/actions/runs/35264583055
Herstelpunt: backup/before-cinematic-chapters-60db61b

## Verandering
De intro koppelde 61 losse frames direct aan scrollpositie; zonder scroll veranderde het beeld niet. De latere scène gebruikte video-seeking. Beide gebruiken nu normale, zichtbaarheidsgestuurde H.264-playback. Scroll bepaalt wanneer een hoofdstuk begint, niet iedere videoframepositie.

Hoofdstuk 1 gebruikt bronframes 1–61. Na bestaande content en de ongewijzigde AI Partner volgt hoofdstuk 2 met frames 62–122. Elk hoofdstuk duurt 3,6 seconden, vertraagt naar het eindbeeld en houdt dat bewust vast. Een vervolg-/eindlabel en herhaalknop verduidelijken deze rusttoestand. Geen automatische loop, scroll-lock of verplichte wachttijd. Introhoogte mobiel blijft 155svh; desktop gaat van 380 naar 155svh.

Gewijzigd: index.html, assets/css/site.css, assets/js/site.js; nieuw assets/js/cinematic.js, vier video’s, twee mobiele posters, reproductiescript en bijbehorende tests/documentatie. Avatarcode en kwalitatief goede GLB zijn bytegelijk aan de vorige versie.

## Bewezen
- Live mobiele (390×844) en desktop (1280×800) test: alle 11 controles geslaagd.
- Zonder scroll stijgt hoofdstuk-1-mediatijd in circa 900ms van 0,076 naar 0,977s mobiel en van 0,011 naar 0,911s desktop.
- Beide hoofdstukken bereiken hun bedoelde einde; pauze/hervatten werkt; geen scroll-seeks; geen frame-sequence-decoderrequests; hoofdstuk 2 laadt niet bij de intro; mediaresources worden vrijgegeven.
- Geen JavaScript-errors in beide tests. Alle gewijzigde productiecode en zes media-assets leveren HTTP 200 en exact de verwachte hashes.
- Desktop en mobiele scènes visueel bekeken. Navigatie naar systeem/schalen en CTA naar starten/terug gecontroleerd.
- Unit-tests dekken reduced motion, autoplayweigering met handmatige start, mediafout, resourcevrijgave en hervatten.
- Beide mobiele films samen: 1.456.254 bytes, circa 28% minder dan de oude volledige introframes plus tweede film (2.022.790 bytes), exclusief posters. De eerste film (616.187 bytes) is wel groter dan de oude initiële framebuffer (263.094 bytes). Dit is geen claim van minder initieel verkeer.

## PageSpeed
Vorige waarden zijn de drie-runmedianen uit de vorige audit; nieuwe waarden zijn één verse meting per profiel. Verschillen zijn geen statistisch bewezen snelheidswinst.

| Profiel | Score voor/na | FCP voor/na | LCP voor/na | TBT voor/na | CLS voor/na | Speed Index voor/na |
|---|---|---|---|---|---|---|
| Mobiel | 100 / 100 | 796 / 794 ms | 1054 / 1051 ms | 0 / 0 ms | 0 / 0,003 | 2161 / 2164 ms |
| Desktop | 100 / 100 | 223 / 235 ms | 343 / 281 ms | 0 / 0 ms | 0 / 0,001 | 382 / 367 ms |

Rapport: https://pagespeed.web.dev/analysis/https-flipmedianl-github-io-mijn-web/drimf6urwm?form_factor=mobile
Geen real-user field data beschikbaar; INP en echte Core Web Vitals zijn daarmee niet bewezen.

## Waarschijnlijke verbetering
Normale sequentiële videodecodering vervangt canvas, bitmapbeheer en scrollgestuurde seeks. Daardoor is minder applicatiewerk nodig tijdens scrollen. De video loopt aantoonbaar door als scroll stopt. De daadwerkelijke CPU/GPU- en geheugenwinst op telefoons is niet gemeten.

## Niet verifieerbaar
De cloudbrowser heeft geen betrouwbare fysieke iPhone/iOS Safari-, GPU- of WebGL-meting. Er is dus geen bewijs van vloeiende fysieke iPhone-weergave of avatar-renderkwaliteit uit deze tests. Het scherpe model en bestaande avataroptimalisaties zijn behouden. Reduced motion en autoplayfouten zijn controller-tests, geen fysieke Safari-tests.

Ruwe resultaten: tests/cinematic-production-results.json, tests/cinematic-live-hashes.json en tests/media-manifest.json.

