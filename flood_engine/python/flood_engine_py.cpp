// Python binding for the flood engine (CCD-399).
// Format, units and rules: docs/flood-engine.md (binding: §10).
#include "flood_engine/flood.hpp"

#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <string>
#include <variant>
#include <vector>

namespace py = pybind11;
using namespace ccd::flood;

namespace {

// Arrays converted (copied if needed) to the engine's element type, C-contiguous (row-major).
using ElevationArray = py::array_t<float, py::array::c_style | py::array::forcecast>;
using SeaArray = py::array_t<std::uint8_t, py::array::c_style | py::array::forcecast>;

// Name of each error code, used as the prefix of the Python exception message.
// No default case: with -Wall the compiler warns if a new code is added and not listed here.
const char* code_name(FloodErrorCode code) {
    switch (code) {
        case FloodErrorCode::EmptyGrid: return "EmptyGrid";
        case FloodErrorCode::SizeOverflow: return "SizeOverflow";
        case FloodErrorCode::ElevationSizeMismatch: return "ElevationSizeMismatch";
        case FloodErrorCode::SeaMaskSizeMismatch: return "SeaMaskSizeMismatch";
        case FloodErrorCode::InvalidCellSize: return "InvalidCellSize";
        case FloodErrorCode::InvalidSeaLevel: return "InvalidSeaLevel";
        case FloodErrorCode::NonFiniteElevation: return "NonFiniteElevation";
        case FloodErrorCode::AllocationFailed: return "AllocationFailed";
    }
    return "UnknownFloodError";  // not reachable for a valid enum value
}

// Turns an engine error into a Python exception: MemoryError for AllocationFailed,
// ValueError for everything else (all other codes mean the input was bad).
// pybind11 catches the C++ exception thrown here and raises the Python one.
[[noreturn]] void raise_flood_error(const FloodError& err) {
    const std::string text = std::string(code_name(err.code)) + ": " + err.message;
    if (err.code == FloodErrorCode::AllocationFailed) {
        PyErr_SetString(PyExc_MemoryError, text.c_str());
        throw py::error_already_set();
    }
    throw py::value_error(text);
}

// `elevation` is converted by pybind11 when the function is called (TypeError if impossible).
py::dict compute_flood_py(const ElevationArray& elevation, const py::object& is_sea_obj,
                          double cell_size_m, double sea_level_m, double nodata) {
    // `is_sea != 0` first, then to uint8: a plain cast to uint8 would turn e.g. 256 into 0 (land).
    const SeaArray is_sea =
        SeaArray::ensure(py::module_::import("numpy").attr("not_equal")(is_sea_obj, 0));
    if (!is_sea) {
        throw py::type_error("is_sea could not be converted to an array");
    }

    if (elevation.ndim() != 2 || is_sea.ndim() != 2) {
        throw py::value_error("elevation_m and is_sea must be 2-D arrays, got ndim " +
                              std::to_string(elevation.ndim()) + " and " +
                              std::to_string(is_sea.ndim()));
    }
    if (elevation.shape(0) != is_sea.shape(0) || elevation.shape(1) != is_sea.shape(1)) {
        throw py::value_error("elevation_m and is_sea must have the same shape, got (" +
                              std::to_string(elevation.shape(0)) + ", " +
                              std::to_string(elevation.shape(1)) + ") and (" +
                              std::to_string(is_sea.shape(0)) + ", " +
                              std::to_string(is_sea.shape(1)) + ")");
    }

    // Shape (rows, cols): rows = height, cols = width. A C-contiguous array is row-major,
    // so element [r, c] is at index r * width + c, exactly as in docs/flood-engine.md §2.
    const auto rows = static_cast<std::size_t>(elevation.shape(0));
    const auto cols = static_cast<std::size_t>(elevation.shape(1));
    const std::size_t n = rows * cols;  // cannot overflow: numpy already holds n elements

    // Copy into FloodInput's own vectors, so the engine never points into numpy memory.
    FloodInput in;
    in.width = cols;
    in.height = rows;
    in.cell_size_m = cell_size_m;
    in.nodata = static_cast<float>(nodata);
    in.elevation_m.assign(elevation.data(), elevation.data() + n);
    in.is_sea.assign(is_sea.data(), is_sea.data() + n);

    FloodOutcome outcome;
    {
        // The engine only reads `in` (plain C++ data), so other Python threads may run meanwhile.
        py::gil_scoped_release release;
        outcome = compute_flood(in, sea_level_m);
    }  // GIL is held again from here on

    if (const auto* err = std::get_if<FloodError>(&outcome)) {
        raise_flood_error(*err);
    }
    const FloodResult& result = std::get<FloodResult>(outcome);

    py::array_t<std::uint8_t> flooded(
        std::vector<py::ssize_t>{static_cast<py::ssize_t>(rows), static_cast<py::ssize_t>(cols)});
    std::copy(result.flooded.begin(), result.flooded.end(), flooded.mutable_data());

    py::dict out;
    out["flooded"] = flooded;
    out["flooded_cells"] = result.flooded_cells;
    out["flooded_area_km2"] = result.flooded_area_km2;
    return out;
}

}  // namespace

PYBIND11_MODULE(flood_engine_py, m) {
    m.doc() =
        "Python binding for the C++ flood engine (CCD-399).\n\n"
        "Units: elevation, sea level and cell size in metres; flooded area in km^2.\n"
        "Sea level must be 0.0 to 2.0 m. Format and rules: docs/flood-engine.md.";

    m.def("compute_flood", &compute_flood_py,
          "compute_flood(elevation_m, is_sea, cell_size_m, sea_level_m, nodata=-9999.0) -> dict\n\n"
          "Computes which land cells flood at one sea level.\n\n"
          "elevation_m: 2-D array (rows, cols), metres; converted to float32.\n"
          "is_sea: 2-D array of the same shape (bool or int); non-zero = sea.\n"
          "cell_size_m: side of one square cell, metres (> 0).\n"
          "sea_level_m: sea level, metres, 0.0 to 2.0.\n"
          "nodata: elevation value that marks a cell with no data (never floods).\n\n"
          "Returns {'flooded': uint8 array (rows, cols), 1 = flooded land,\n"
          "         'flooded_cells': int, 'flooded_area_km2': float (km^2)}.\n"
          "Raises ValueError for bad input (message starts with the error code, e.g.\n"
          "'InvalidSeaLevel: ...') and MemoryError if the engine runs out of memory.",
          py::arg("elevation_m"), py::arg("is_sea"), py::arg("cell_size_m"),
          py::arg("sea_level_m"), py::arg("nodata") = -9999.0);
}
