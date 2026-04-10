#!/usr/bin/env bash
# Build BrowseQueue into a distributable zip.
# Usage: ./build.sh
set -euo pipefail

OUT=build
ZIP="BrowseQueue-$(git describe --tags 2>/dev/null || echo 'dev').zip"

rm -rf "$OUT"
mkdir -p "$OUT/images" "$OUT/_locales"

cp manifest.json bg.js popup.html popup.js options.html options.js options.css license.txt "$OUT/"
cp images/disp_ico_16.png images/disp_ico_48.png images/disp_ico_128.png \
   images/icon-enabled.svg images/icon-disabled.svg "$OUT/images/"
cp -R _locales/ "$OUT/_locales/"

cd "$OUT"
zip -r -9 "../$ZIP" .
cd ..

echo "Built: $ZIP"
