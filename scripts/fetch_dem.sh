#!/usr/bin/env bash
# Download Copernicus GLO-90 DEM tiles covering Ireland from the public AWS bucket.
# Usage: scripts/fetch_dem.sh [output_dir]   (default: data/dem/glo90)
# All-sea tiles do not exist in the bucket; they are reported as "none".
set -euo pipefail

out_dir="${1:-data/dem/glo90}"
base_url="https://copernicus-dem-90m.s3.amazonaws.com"
mkdir -p "$out_dir"

for lat in 51 52 53 54 55; do
  for lon in 011 010 009 008 007 006; do
    tile="Copernicus_DSM_COG_30_N${lat}_00_W${lon}_00_DEM"
    dest="$out_dir/$tile.tif"
    part="$dest.part"
    if curl -sf -o "$part" "$base_url/$tile/$tile.tif" && [ -s "$part" ]; then
      mv "$part" "$dest"
      echo "OK $tile"
    else
      rm -f "$part"
      echo "none $tile"
    fi
  done
done
