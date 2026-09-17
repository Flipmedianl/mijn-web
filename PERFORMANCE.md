# Cinematic playback

The site is static GitHub Pages, deployed from `main`. The earlier frame-buffer implementation is preserved in history and backup branch `backup/before-cinematic-chapters-60db61b`; the current visitor path does not use canvas or fetch/decode frame sequences.

## Two chapters

- Chapter 1: original desktop frames 1–61, above the system section.
- Chapter 2: frames 62–122, after the unchanged avatar section.
- Each encoded clip lasts 3.6 seconds, with a gradual slowdown over the last 12 source frames and a 0.8-second endpoint hold.
- Native H.264 playback is started by visibility. No scroll handler sets video time or playback rate. At the end, a matching static poster and replay control communicate an intentional endpoint.
- No looping. Scroll-back does not restart completed chapters. Replay is explicit.
- Mobile intro remains 155svh. Desktop intro is reduced from 380svh to 155svh; the later chapter is 145svh on both profiles. There is no scroll lock or forced waiting.

`scripts/build-cinematic.sh` rebuilds only the six chapter assets from the original frames, using FFmpeg/libx264, CRF 24, normal inter-frame compression, yuv420p and faststart. Desktop video keeps 1280×720. Mobile crops the original center to 540×720, matching the earlier mobile intro composition and improving the effective resolution of the later chapter over the old 540×304 landscape crop. Source assets are retained. Do not run legacy avatar-simplification workflows as part of cinematic changes.

## Resource lifecycle and accessibility

`assets/js/cinematic.js` owns media state. The native media decoder owns playback; there is no cinematic animation-frame loop or bitmap cache. Sources attach near the chapter. Playback requires at least 20% of its sticky viewport to be visible. Playback pauses offscreen; distant or background-tab sources are removed. A returning unfinished chapter may perform one restoration seek. Completed chapters release their source after the endpoint poster decodes. Pause/resume and replay remain keyboard accessible.

Muted, inline, audio-free media permits autoplay where browser policy allows it. A rejected `play()` promise exposes an explicit play button; network failure displays a deliberate poster and message. `prefers-reduced-motion` prevents video loading and playback and shows a clean static poster. Changing that preference at runtime is supported. Reduced motion does not silently bypass the user's setting on a button click.

The avatar controller, sharp desktop/mobile GLB selection, Draco compression, 1024px textures, lazy import, mobile shadows off and offscreen/hidden disposal are unchanged. CSS/RAF scroll work remaining in site.js is for the avatar only, plus existing reveal observers.

## Verification

- `node tests/cinematic.cjs`: native play, absence of per-scroll seeks, user pause/resume, release/restoration, endpoint/replay, reduced motion, autoplay rejection and media errors.
- `node tests/video.cjs`: compatibility entry point for the same current video-controller regression tests.
- `tests/performance.html`: real deployed page in mobile/desktop viewports; verifies movement while scroll stays still, both chapter endpoints, pause/resume, no frame-decoder fetches, no early second video, no scroll seeks, resource release and unchanged avatar selection.
- `tests/media-manifest.json`: source frame ranges, sizes, codec, resolution and duration of produced assets.

The historical `scheduler.cjs` and `frame-cache.cjs` tests have been retired with the frame renderer. Their original implementation and test results remain in git history. The September 17 performance audit describes the prior runtime, not the current native playback model.

The cloud browser can verify state, media time and requests, but not physical iPhone smoothness, iOS Safari GPU behavior, or WebGL visual fidelity. Never present those as verified by desktop emulation.

References: [WebKit muted inline video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/), [play() promise and rejection handling](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).
