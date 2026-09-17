#!/usr/bin/env bash
set -euo pipefail
# Keep avatar-mobile.glb as the source. Never simplify an already simplified output.
npx --yes --package=@gltf-transform/cli@4.5.0 gltf-transform optimize assets/avatar-mobile.glb assets/avatar-low.glb --compress draco --texture-compress webp --texture-size 512 --simplify-ratio 0.08 --simplify-error 0.01
npx --yes --package=@gltf-transform/cli@4.5.0 gltf-transform optimize assets/avatar-mobile.glb assets/avatar-desktop.glb --compress draco --texture-compress webp --texture-size 1024 --simplify-ratio 0.2 --simplify-error 0.005
ffmpeg -hide_banner -loglevel error -y -i assets/video/scale.mp4 -vf 'scale=540:-2' -c:v libx264 -preset medium -crf 27 -g 1 -pix_fmt yuv420p -movflags +faststart -an assets/video/scale-mobile.mp4
