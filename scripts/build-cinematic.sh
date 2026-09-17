#!/usr/bin/env bash
set -euo pipefail
# Original, non-overlapping source ranges. No avatar assets are rebuilt.
# Ease the final 12 source frames, then hold the authored chapter endpoint.
for chapter in 1 2; do
  start=$((1 + (chapter - 1) * 61))
  for profile in desktop mobile; do
    crop='null'
    if [ "$profile" = mobile ]; then crop='crop=540:720'; fi
    ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number "$start" -i frames/frame-%03d.webp \
      -vf "trim=end_frame=61,$crop,setpts=N/(30*TB)+if(gte(N\,49)\,0.65*pow((N-49)/11\,2)/TB\,0),fps=30,tpad=stop_mode=clone:stop_duration=0.8" \
      -an -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p -g 48 -movflags +faststart \
      "assets/video/chapter-$chapter-$profile.mp4"
  done
done
ffmpeg -hide_banner -loglevel error -y -i frames/frame-062.webp -vf crop=540:720 -c:v libwebp -quality 90 assets/video/chapter-2-start-mobile.webp
ffmpeg -hide_banner -loglevel error -y -i frames/frame-122.webp -vf crop=540:720 -c:v libwebp -quality 90 assets/video/chapter-2-end-mobile.webp
