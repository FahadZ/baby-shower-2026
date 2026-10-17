#!/bin/sh
# Stamp a new build version into the pages and version.txt.
# Run before every deploy so phones never mix old and new files.
set -e
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M%S)
for f in index.html raffle/index.html raffle/draw.html; do
  sed -i.bak "s|?v=[0-9]*|?v=$V|g; s|<meta name=\"build\" content=\"[0-9]*\">|<meta name=\"build\" content=\"$V\">|" "$f"
  rm -f "$f.bak"
done
printf '%s\n' "$V" > version.txt
echo "Build $V"
