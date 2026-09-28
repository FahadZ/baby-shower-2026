#!/bin/sh
# Stamp a new build version into index.html and version.txt.
# Run before every deploy so phones never mix old and new files.
set -e
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M%S)
sed -i.bak "s|?v=[0-9]*|?v=$V|g; s|<meta name=\"build\" content=\"[0-9]*\">|<meta name=\"build\" content=\"$V\">|" index.html
rm -f index.html.bak
printf '%s\n' "$V" > version.txt
echo "Build $V"
