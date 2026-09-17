# Media performance

The site is static and runs on GitHub Pages without a runtime build dependency.

## Frame sequences

The intro retains frames 1–61 and the original gradual scroll traversal (1.35 frames per 60 Hz tick on mobile, 1.8 on desktop), normalized for refresh rate. It never converts the intro into a seeking video.

Each `[data-sequence]` declares `data-frame-from` and `data-frame-to`; optional `data-frames` and `data-frames-mobile` select asset directories. Use contiguous `frame-001.webp` numbering. Only sequences within half a viewport are buffered. One shared request pool allows at most 3 mobile / 4 desktop loads (2 on constrained connections), discards obsolete work, prioritizes current/target frames, and buffers a bounded neighborhood. Decoded bitmap budgets are 32 MiB mobile and 64 MiB desktop per nearby sequence. Bitmaps are closed outside the loading zone and when the tab is hidden. Avoid overlapping many sequences in one viewport.

Canvas dimensions follow its actual stable `svh` box. Mobile address bar changes no longer wipe the canvas. The first frame is a responsive HTML image as well as a matching preload, keeping the intro visible before JavaScript or decoding completes. No animation frame loop runs while idle.

## Avatar

Source: `assets/avatar-mobile.glb` (632,002 triangles, 2,738,884 bytes).

- Mobile: `avatar-low.glb`, 57,834 triangles, 512,904 bytes, textures capped at 512px.
- Desktop: `avatar-desktop.glb`, 126,396 triangles, 1,035,428 bytes, textures capped at 1024px.

Both keep the original textures and material; simplification is lossy, with bounded geometric error. `scripts/build-media.sh` reproduces the outputs using pinned glTF Transform 4.5.0 and FFmpeg. The source is preserved. Do not rerun legacy workflows that rewrite `index.html` using assumptions from the old inline-script version.

WebGL detection, viewer import, Draco decoding and model loading happen only near the avatar. Shadows are disabled on mobile. Camera updates are quantized and scroll-driven, with no continuous auto-rotation. Offscreen/hidden models are released with the viewer cache disabled. A readable message and service cards remain when WebGL or model loading fails. The model-viewer dependency remains pinned to 4.1.0.

## Video

Use `.lazy-video` with `data-src`, optional `data-src-mobile`, `preload="none"`, `muted` and `playsinline` in a `.scrub > .sticky` section. No `src` should exist in initial HTML. The current video has all-intra keyframes for seeking. FFmpeg generates a 540px mobile variant; avoid adding ordinary long-GOP video to a scroll-scrubbing section. Playback videos should use a separate play/pause controller.

Videos attach sources near their section and detach them outside it. Only one seek is in flight. `seeked` drains the latest target, including when the user stops scrolling during a seek. No timeout creates overlapping seeks. Poster frames load with the video. Large future videos should be split into separate sections/clips rather than retained together.

## Verification

- Run `node tests/scheduler.cjs` for concurrency, cancellation, 10,000-frame scaling, stepping and bitmap budget assertions.
- Open `tests/performance.html` on the deployed origin. It loads the actual website in 390×844 / 1280×800 frames and measures forward/reverse scrolling, frames displayed, resource requests, long tasks, final video seek and release. It does not simulate physical phone CPU/GPU performance.
- The opt-in `?audit=1` diagnostics expose counters only; nothing is uploaded.
- Also inspect the avatar on a real WebGL-capable phone and desktop. A cloud browser without WebGL can verify fallback behavior but cannot verify 3D rendering smoothness.
