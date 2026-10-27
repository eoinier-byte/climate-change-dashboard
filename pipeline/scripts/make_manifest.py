"""Write data/raw/MANIFEST.md: every raw file, its source URL and date (CCD-96).

Run from the pipeline/ folder after downloading data:
    python scripts/make_manifest.py

The date column is the file's last-modified date on your computer, which
is the download date unless the file was copied or edited since.
"""

import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (  # noqa: E402
    CLIMATE_IRELAND_BASE_URL,
    CLIMATE_RAW_DIRS,
    MANIFEST_FILE,
    RAW_DIR,
    SEA_LEVEL_RAW_FILE,
    UKCP18_QUERY_URL,
)
from filenames import find_climate_files  # noqa: E402


def climate_ireland_url(nc_name):
    """The .zip on climateservices.ie that contains this .nc file."""
    return CLIMATE_IRELAND_BASE_URL + nc_name.replace("ensmean", "ensmid").replace(".nc", ".zip")


def file_date(path):
    return datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()


def main():
    files, skipped = find_climate_files(CLIMATE_RAW_DIRS.values())

    lines = [
        "# Raw data manifest",
        "",
        f"Generated {date.today().isoformat()} by `scripts/make_manifest.py`. "
        "Raw files are not committed to git; this manifest is.",
        "",
        "| File | Folder | Size (KB) | File date | Source |",
        "|---|---|---|---|---|",
    ]
    for f in files:
        folder = f.path.parent.relative_to(RAW_DIR).as_posix()
        size_kb = round(f.path.stat().st_size / 1024)
        lines.append(
            f"| `{f.path.name}` | `{folder}` | {size_kb} | {file_date(f.path)} | "
            f"{climate_ireland_url(f.path.name)} |"
        )

    if SEA_LEVEL_RAW_FILE.exists():
        folder = SEA_LEVEL_RAW_FILE.parent.relative_to(RAW_DIR).as_posix()
        size_kb = round(SEA_LEVEL_RAW_FILE.stat().st_size / 1024)
        lines.append(
            f"| `{SEA_LEVEL_RAW_FILE.name}` | `{folder}` | {size_kb} | "
            f"{file_date(SEA_LEVEL_RAW_FILE)} | {UKCP18_QUERY_URL} |"
        )

    by_variable = {}
    for f in files:
        by_variable[f.variable] = by_variable.get(f.variable, 0) + 1
    lines += [
        "",
        "## Totals",
        "",
        *(f"- {variable}: {count} files" for variable, count in sorted(by_variable.items())),
        f"- sea level: {'downloaded' if SEA_LEVEL_RAW_FILE.exists() else 'NOT downloaded'}",
    ]
    if skipped:
        lines += ["", "## Not recognised (not used)", ""]
        lines += [f"- `{p.relative_to(RAW_DIR).as_posix()}`" for p in skipped]

    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {MANIFEST_FILE} ({len(files)} climate files)")


if __name__ == "__main__":
    main()
