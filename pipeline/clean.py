"""Find and remove null, fill and out-of-range values (CCD-275).

Rules (docs/cleaning-rules.md):
- Values are never filled in or changed.
- Nulls, fill values and out-of-range values are removed before county
  averages are calculated, and every removal is counted in a report.
- Grid cells over the sea are null in every file. They are counted
  separately as "null" and are expected.
"""

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd

from config import FILL_VALUES, PLAUSIBLE_RANGES


@dataclass
class CleaningReport:
    source: str
    variable: str
    rows_in: int
    null: int
    fill_value: int
    out_of_range: int
    rows_out: int

    @property
    def flagged(self):
        return self.null + self.fill_value + self.out_of_range

    def as_dict(self):
        return {**asdict(self), "flagged": self.flagged}


def range_for(variable, season):
    """The plausible (low, high) range for a variable and season."""
    kind = "annual" if season == "Annual" else "seasonal"
    key = (variable, kind)
    if key not in PLAUSIBLE_RANGES:
        raise KeyError(f"No plausible range set in config.py for {key}")
    return PLAUSIBLE_RANGES[key]


def flag_values(values, variable, season):
    """Label each value as 'ok', 'null', 'fill_value' or 'out_of_range'."""
    values = pd.to_numeric(pd.Series(values), errors="coerce")
    low, high = range_for(variable, season)

    is_null = values.isna()
    is_fill = values.isin(FILL_VALUES) | (values.abs() >= 1e20)
    is_out = ~is_null & ~is_fill & ((values < low) | (values > high))

    labels = np.select(
        [is_null, is_fill, is_out],
        ["null", "fill_value", "out_of_range"],
        default="ok",
    )
    return pd.Series(labels, index=values.index)


def clean(df, value_column, variable, season, source=""):
    """Return (rows that passed, CleaningReport). The input is not changed."""
    flags = flag_values(df[value_column], variable, season)
    kept = df[flags == "ok"].copy()
    report = CleaningReport(
        source=source,
        variable=variable,
        rows_in=len(df),
        null=int((flags == "null").sum()),
        fill_value=int((flags == "fill_value").sum()),
        out_of_range=int((flags == "out_of_range").sum()),
        rows_out=len(kept),
    )
    return kept, report
