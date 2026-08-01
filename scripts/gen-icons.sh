#!/usr/bin/env bash
# Generates PWA icons from public/icon.svg.
# Requires: rsvg-convert (brew install librsvg) or Inkscape.
set -e

SVG="public/icon.svg"

if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 192 -h 192 "$SVG" -o public/icon-192.png
  rsvg-convert -w 512 -h 512 "$SVG" -o public/icon-512.png
  echo "Icons generated with rsvg-convert."
elif command -v inkscape &>/dev/null; then
  inkscape "$SVG" -w 192 -h 192 -o public/icon-192.png
  inkscape "$SVG" -w 512 -h 512 -o public/icon-512.png
  echo "Icons generated with Inkscape."
else
  echo "Install librsvg (brew install librsvg) then re-run this script."
  exit 1
fi
