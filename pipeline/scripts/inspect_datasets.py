"""Inspect every raw NetCDF file and write docs/dataset-inspection.md.

Run from the pipeline/ folder:
    python scripts/inspect_datasets.py

Covers two Jira subtasks:
- CCD-98: variable names, dimensions, coordinate ranges and units for every
  file, and any file that differs from the others.
- CCD-99: evidence for whether projections are absolute values or anomalies,
  by comparing each projection's mean with its matching baseline.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import xarray as xr  # noqa: E402

from config import CLIMATE_RAW_DIRS, INSPECTION_REPORT  # noqa: E402
from filenames import find_climate_files  # noqa: E402


def describe(climate_file):
    with xr.open_dataset(climate_file.path, engine="netcdf4") as ds:
        var = ds[climate_file.nc_var]
        coords = {}
        for name in ("lat", "lon"):
            if name in ds.coords or name in ds.variables:
                values = ds[name].values
                coords[name] = (float(values.min()), float(values.max()))
        values = var.values
        return {
            "file": climate_file.path.name,
            "variable": climate_file.variable,
            "scenario": climate_file.scenario,
            "period": climate_file.period,
            "season": climate_file.season,
            "data_vars": ", ".join(sorted(ds.data_vars)),
            "dims": ", ".join(f"{d}={n}" for d, n in var.sizes.items()),
            "units": str(var.attrs.get("units", "(none)")),
            "long_name": str(var.attrs.get("long_name", "(none)")),
            "time": (str(ds["time"].values[0])[:10] if "time" in ds.coords and ds.sizes.get("time") else "(none)"),
            "lat": coords.get("lat"),
            "lon": coords.get("lon"),
            "cells": int(values.size),
            "valid": int(var.count()),       # cells with a value (land); the rest are sea
            "mean": float(var.mean(skipna=True)),
            "min": float(var.min(skipna=True)),
            "max": float(var.max(skipna=True)),
            "global_attrs": {k: str(v)[:120] for k, v in ds.attrs.items()},
        }


def fmt_range(r):
    return "-" if r is None else f"{r[0]:.3f} to {r[1]:.3f}"


def main():
    files, skipped = find_climate_files(CLIMATE_RAW_DIRS.values())
    if not files:
        sys.exit("No climate files found under data/raw/. See data/README.md.")

    info = []
    for climate_file in files:
        print(f"Inspecting {climate_file.path.name}")
        info.append(describe(climate_file))

    lines = [
        "# Dataset inspection (CCD-98, CCD-99)",
        "",
        f"Generated {date.today().isoformat()} by `pipeline/scripts/inspect_datasets.py` "
        f"over {len(info)} files.",
        "",
        "## Every file",
        "",
        "| File | NetCDF vars | Dims | Units | lat range | lon range | Valid / total cells | Mean | Min | Max |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for d in info:
        lines.append(
            f"| `{d['file']}` | {d['data_vars']} | {d['dims']} | {d['units']} | "
            f"{fmt_range(d['lat'])} | {fmt_range(d['lon'])} | {d['valid']} / {d['cells']} | "
            f"{d['mean']:.3f} | {d['min']:.3f} | {d['max']:.3f} |"
        )

    # --- Differences between files of the same variable (CCD-98 step 3) ---
    lines += ["", "## Differences between files", ""]
    differences = []
    for variable in sorted({d["variable"] for d in info}):
        group = [d for d in info if d["variable"] == variable]
        reference = group[0]
        for key in ("data_vars", "dims", "units", "lat", "lon", "cells"):
            odd = [d["file"] for d in group if d[key] != reference[key]]
            if odd:
                differences.append(
                    f"- **{variable}**: `{key}` differs from `{reference['file']}` "
                    f"({reference[key]}) in: " + ", ".join(f"`{f}`" for f in odd)
                )
        units = sorted({d["units"] for d in group})
        lines.append(f"- {variable}: {len(group)} files, units {', '.join(units)}, "
                     f"long name \"{reference['long_name']}\"")
    lines += [""] + (differences or ["No differences in variable names, dimensions, units or grid."])
    if skipped:
        lines += ["", "Files not recognised (ignored): " + ", ".join(f"`{p.name}`" for p in skipped)]

    # --- Absolute or anomaly (CCD-99) ---
    baseline = {(d["variable"], d["season"]): d for d in info if d["scenario"] == "baseline"}
    lines += [
        "",
        "## Absolute or anomaly? (CCD-99)",
        "",
        "If the projection files held anomalies (changes), their means would be close to 0 °C / 0 %. "
        "If they hold absolute values, their means would be close to the baseline mean.",
        "",
        "| Variable | Season | Scenario | Period | Baseline mean | Projection mean | Projection ÷ baseline |",
        "|---|---|---|---|---|---|---|",
    ]
    ratios = []
    for d in info:
        if d["scenario"] == "baseline":
            continue
        base = baseline.get((d["variable"], d["season"]))
        if base is None:
            continue
        ratio = d["mean"] / base["mean"] if base["mean"] else float("nan")
        ratios.append(ratio)
        lines.append(
            f"| {d['variable']} | {d['season']} | {d['scenario']} | {d['period']} | "
            f"{base['mean']:.3f} | {d['mean']:.3f} | {ratio:.2f} |"
        )
    if ratios:
        lo, hi = min(ratios), max(ratios)
        verdict = "absolute values" if lo > 0.5 else "possibly anomalies - check by hand"
        lines += [
            "",
            f"Projection ÷ baseline ranges from {lo:.2f} to {hi:.2f}. Conclusion: **{verdict}**.",
        ]

    lines += ["", "## Global attributes (first file)", ""]
    lines += [f"- `{k}`: {v}" for k, v in info[0]["global_attrs"].items()] or ["(none)"]

    INSPECTION_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nWrote {INSPECTION_REPORT}")


if __name__ == "__main__":
    main()
