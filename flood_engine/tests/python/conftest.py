"""Finds the built flood_engine_py module for the binding tests (CCD-399).

Set FLOOD_ENGINE_PY_DIR to the directory that contains flood_engine_py*.so
(the CMake build directory's python/ folder). Without it the tests are skipped.
"""

import importlib
import os
import sys

import pytest

PY_DIR = os.environ.get("FLOOD_ENGINE_PY_DIR")

if PY_DIR:
    sys.path.insert(0, PY_DIR)


@pytest.fixture(scope="session")
def engine():
    """The flood_engine_py module. Skips if FLOOD_ENGINE_PY_DIR is unset."""
    if not PY_DIR:
        pytest.skip(
            "FLOOD_ENGINE_PY_DIR is not set: build with -DFLOOD_ENGINE_BUILD_PYTHON=ON "
            "and set it to the directory containing flood_engine_py*.so"
        )
    # Not skipped if the import fails: with the variable set, a missing module is an error.
    return importlib.import_module("flood_engine_py")
