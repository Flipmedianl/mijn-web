# Current intro transition

The section-1/section-2 transition now uses `assets/js/intro-transition.js` and the existing sharp WebP assets. The following chapter-playback description applies only to the later #scale chapter; the first chapter described below is historical (af48632).

- Frame 1 → 61 before #system first enters the viewport; then 61 → 31 during the overlap. Geometry includes the existing negative mobile margin. No change to intro height or section placement.
- No video, controls, end card, autoplay clock or video seeking in #top. Scroll direction controls the trajectory. Small frame catch-up is bounded; there is no perpetual idle animation loop.
- Fully covered: cancel loading, retain one decoded image and the unchanged canvas. On return, anchor to the exact last rendered frame and join the endpoint continuously. Do not reset the backing store or replace it with a starting poster.
- At most 12 decoded mobile frames or 8 desktop frames, plus up to 2 transient decodes. Native source resolution; no DPR allocation growth. Prior HTTP caching, bounded concurrency, wanted-frame eviction protection and reduced-motion behavior remain.
- Reduced motion retains a static image without loading the sequence. Background tabs suspend work. Failed assets keep the existing image; no retry loop.
- New tests: `node tests/intro-transition.cjs` and deployed `tests/transition.html`. Earlier `tests/performance.html` and cinematic production measurements describe the previous two-video release, not this transition.
- Avatar code/model and later chapter video/controller are unchanged. The mobile full intro sequence is 1,566,736 bytes versus the replaced 616,187-byte movie: reversibility costs additional media bytes; no unmeasured load-speed improvement is claimed.

## Production validation

Implementation c135d9e; test synchronization d156331. All 17 checks pass on the real GitHub Pages deployment in 390×844 and 1280×800 browser windows. Observed: frame 1 → 31 → 61, down through overlap → 54 → 41/42, up → 49, down → 39, exit/return → 31 unchanged, up again → 46. Rapid alternating targets settle on the latest target. No hidden or settled-idle redraws, no intro movie, no controls, no website JavaScript/resource errors or HTTP error responses. Raw snapshots are in tests/transition-production-results.json.

Retained decoded images: at most 12 mobile (~17.8 MiB) / 8 desktop (~28.1 MiB), plus a maximum of two transient decodes and the canvas. Fully covered: one retained image, no active decode. These are controlled allocations, not measurements of total browser/GPU memory.

Production HTML and changed runtime scripts were fetched with HTTP 200 and matched local hashes. The test initially sampled stale state in the throttled cloud browser; it now waits for the processed target and fully settled renderer. The cloud environment sometimes schedules animation callbacks at roughly 1 Hz. These tests verify direction/state/resource lifecycle, not frame pacing on physical iOS Safari. No new PageSpeed score is claimed for this transition.

---

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
