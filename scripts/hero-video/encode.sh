#!/usr/bin/env bash
# ==========================================================================
# GJS · VIDÉO DU HERO · ÉTAPE 4 : ASSEMBLAGE (ffmpeg)
# Assemble les images rendues par render.mjs (out/desktop, out/mobile) en
# boucles de 12 s à 24 i/s, sans son, et écrit dans assets/video/ :
#   gjs-metal.mp4 / .webm                1920 x 1080 (H.264 et VP9, < 4 Mo)
#   gjs-metal-mobile.mp4 / .webm         720 x 1280, portrait (téléphones)
#   gjs-metal-poster.jpg                 première image, 1920 x 1080 (< 150 Ko)
#   gjs-metal-poster-mobile.jpg          première image, 720 x 1280 (< 150 Ko)
# La boucle est parfaite : l'image 288 serait identique à l'image 0
# (caméra, lumières et fumée sont périodiques sur 12 s, voir scene.js).
#
# Usage, depuis la racine du site :  bash scripts/hero-video/encode.sh
#        (ou seulement une version :  bash scripts/hero-video/encode.sh desktop)
# Prérequis : ffmpeg avec libx264 et libvpx-vp9.
# ==========================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/../../assets/video"
FPS=24
ONLY="${1:-all}"
mkdir -p "$OUT"

# Noir et blanc : on force une chrominance neutre (aucune dérive de teinte, poids réduit)
GRAY="format=gray,format=yuv420p"

encode() { # nom dossier crf_h264 crf_vp9
  local name="$1" dir="$HERE/out/$2" crf264="$3" crfvp9="$4"
  local n; n=$(ls "$dir"/f_*.png 2>/dev/null | wc -l)
  if [ "$n" -ne 288 ]; then echo "✗ $dir : $n image(s) sur 288. Lancez d'abord render.mjs." >&2; return 1; fi
  ffmpeg -v error -y -framerate $FPS -i "$dir/f_%04d.png" -vf "$GRAY" -an \
    -c:v libx264 -preset veryslow -tune film -crf "$crf264" -profile:v high -level 4.1 -pix_fmt yuv420p \
    -g $FPS -keyint_min $FPS -movflags +faststart "$OUT/$name.mp4"
  ffmpeg -v error -y -framerate $FPS -i "$dir/f_%04d.png" -vf "$GRAY" -an \
    -c:v libvpx-vp9 -b:v 0 -crf "$crfvp9" -row-mt 1 -deadline good -cpu-used 1 -g $FPS -pix_fmt yuv420p "$OUT/$name.webm"
  # Poster : la première image exacte de la boucle
  ffmpeg -v error -y -i "$dir/f_0000.png" -vf "format=gray" -q:v 5 "$OUT/$name-poster.jpg" 2>/dev/null || true
  for f in "$OUT/$name.mp4" "$OUT/$name.webm"; do
    printf '✓ %-28s %6s Ko\n' "$(basename "$f")" "$(( $(stat -c%s "$f") / 1024 ))"
  done
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "desktop" ]; then
  encode gjs-metal desktop 22 33
fi
if [ "$ONLY" = "all" ] || [ "$ONLY" = "mobile" ]; then
  encode gjs-metal-mobile mobile 24 35
  mv -f "$OUT/gjs-metal-mobile-poster.jpg" "$OUT/gjs-metal-poster-mobile.jpg"
fi
for f in "$OUT"/gjs-metal-poster*.jpg; do printf '✓ %-28s %6s Ko\n' "$(basename "$f")" "$(( $(stat -c%s "$f") / 1024 ))"; done
