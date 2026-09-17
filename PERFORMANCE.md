# Media performance

The site is static and runs on GitHub Pages without a runtime build dependency.

## Frame sequences

The intro retains frames 1–61 and the original gradual scroll traversal (1.35 frames per 60 Hz tick on mobile, 1.8 on desktop), normalized for refresh rate. It never converts the intro into a seeking video.

Each `[data-sequence]` declares `data-frame-from` and `data-frame-to`; optional `data-frames` and `data-frames-mobile` select asset directories. Use contiguous `frame-001.webp` numbering. Only sequences within half a viewport are buffered. One shared request pool allows at most 3 mobile / 4 desktop loads (2 on constrained connections), discards obsolete work, prioritizes current/target frames, and buffers a bounded neighborhood. Decoded bitmap budgets are 32 MiB mobile and 64 MiB desktop per nearby sequence. Eviction must discard frames outside the currently requested buffer before using distance: otherwise directional lookahead can be decoded and immediately evicted indefinitely when scrolling stops. Bitmaps are closed outside the loading zone and when the tab is hidden. Avoid overlapping many sequences in one viewport.

Canvas dimensions follow its actual stable `svh` box. Mobile address bar changes no longer wipe the canvas. The first frame is a responsive HTML image as well as a matching preload, keeping the intro visible before JavaScript or decoding completes. No animation frame loop runs while idle.

## Avatar

Source: `assets/avatar-mobile.glb` (632,002 triangles, 2,738,884 bytes).

- Mobile and desktop currently both use `avatar-desktop.glb` (restored by commit `d1506f0`).
- `avatar-low.glb` (57,834 triangles, 512,904 bytes, 512px textures) is a legacy asset and is NOT used.
- Desktop: `avatar-desktop.glb`, 126,396 triangles, 1,035,428 bytes, textures capped at 1024px.

The derived models keep textures and material; simplification is lossy, with bounded geometric error. This audit does not change model geometry, textures, or render resolution. `scripts/build-media.sh` reproduces the outputs using pinned glTF Transform 4.5.0 and FFmpeg. The source is preserved. Do not rerun legacy workflows that rewrite `index.html` using assumptions from the old inline-script version.

WebGL detection, viewer import, Draco decoding and model loading happen only near the avatar. Shadows are disabled on mobile. Camera updates are quantized and scroll-driven, with no continuous auto-rotation. Offscreen/hidden models are released with the viewer cache disabled. A readable message and service cards remain when WebGL or model loading fails. The model-viewer dependency remains pinned to 4.1.0.

## Video

Use `.lazy-video` with `data-src`, optional `data-src-mobile`, `preload="none"`, `muted` and `playsinline` in a `.scrub > .sticky` section. No `src` should exist in initial HTML. The current video has all-intra keyframes for seeking. FFmpeg generates a 540px mobile variant; avoid adding ordinary long-GOP video to a scroll-scrubbing section. Playback videos should use a separate play/pause controller.

Videos attach sources near their section and detach them outside it. Only one seek is in flight. `seeked` drains the latest target, including when the user stops scrolling during a seek. No timeout creates overlapping seeks. Poster frames load with the video. Large future videos should be split into separate sections/clips rather than retained together.

The mobile intro is 155svh (55svh scrub travel), with the system section overlapping by 9vh; desktop remains 380svh.

## Verification

- Run `node tests/frame-cache.cjs` for stationary forward/reverse buffer retention at the real mobile frame dimensions.
- Use **Buffer-rusttest** on the live test page to confirm no new frame requests after stopping at frame 30.
- Run `node tests/video.cjs` for mobile source selection, serialized seeking, final-target drain and offscreen release.
- Run `node tests/scheduler.cjs` for concurrency, cancellation, 10,000-frame scaling, stepping and bitmap budget assertions.
- Open `tests/performance.html` on the deployed origin. It loads the actual website in 390×844 / 1280×800 frames and measures forward/reverse scrolling, frames displayed, resource requests, long tasks, final video seek and release. It does not simulate physical phone CPU/GPU performance.
- The opt-in `?audit=1` diagnostics expose counters only; nothing is uploaded.
- Also inspect the avatar on a real WebGL-capable phone and desktop. A cloud browser without WebGL can verify fallback behavior but cannot verify 3D rendering smoothness.

## Live verification result

The deployed runtime at commit `86f9e0d` passed all seven checks on both 390×844 and 1280×800 viewports: no early heavy-media requests, frame 61 at the end, frame 1 on return, bounded bitmap memory, release outside sections, final video seek, and no JavaScript errors. See `tests/live-results.json`. The first live test exposed excessive catch-up time when animation callbacks were throttled; ticks over 120ms now synchronize immediately to the scroll target. Both glTF outputs validated without errors (the validator notes runtime-generated tangent space and cannot validate the Draco extension itself).

The cloud browser throttled animation callbacks to roughly 1 Hz and had no WebGL. This result verifies functional behavior and loading, not 60fps animation, visual fidelity of the simplified avatar, or physical-phone GPU smoothness. Those remain device checks.
