"""Download UKCP18 sea level projections for the Irish coast.

Run from the pipeline/ folder:
    python scripts/download_ukcp18.py

Saves every coastal cell around Ireland (all percentiles, all decades) to
data/raw/sea_level/ukcp18_sea_level_ireland.csv. The 5th and 95th
percentiles are kept in the raw file; process.py uses the 50th only.

Source: Met Office UKCP18 Time-mean Sea Level Projections to 2100,
Open Government Licence v3.0. See DATA_SOURCES.md.
"""

import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))   # so `import config` works

from config import SEA_LEVEL_RAW_FILE, UKCP18_IRELAND_BBOX, UKCP18_QUERY_URL  # noqa: E402

PAGE_SIZE = 1000
YEARS = range(2010, 2101, 10)
FIELDS = ["X", "Y", "rcp_percentile"] + [f"seaLevelAnom_{y}" for y in YEARS]


def fetch_page(offset):
    params = {
        "where": "1=1",
        "geometry": ",".join(str(v) for v in UKCP18_IRELAND_BBOX),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": ",".join(FIELDS),
        "returnGeometry": "false",
        "orderByFields": "OBJECTID",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
        "f": "json",
    }
    url = UKCP18_QUERY_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(f"UKCP18 service error: {payload['error']}")
    return payload


def main():
    rows = []
    offset = 0
    while True:
        payload = fetch_page(offset)
        features = payload.get("features", [])
        rows.extend(feature["attributes"] for feature in features)
        print(f"  fetched {len(rows)} rows")
        if not payload.get("exceededTransferLimit") or not features:
            break
        offset += len(features)

    if not rows:
        sys.exit("No rows returned - check the service URL in config.py")

    SEA_LEVEL_RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SEA_LEVEL_RAW_FILE, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in FIELDS})

    cells = {(row["X"], row["Y"]) for row in rows}
    print(f"\nSaved {len(rows)} rows ({len(cells)} coastal cells) to {SEA_LEVEL_RAW_FILE}")
    print(f"Downloaded {date.today().isoformat()}. Add this to data/raw/MANIFEST.md:")
    print("  python scripts/make_manifest.py")


if __name__ == "__main__":
    main()
