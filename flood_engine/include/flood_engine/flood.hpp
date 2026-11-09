// Flood engine public API (CCD-395).
// Format, units and rules: docs/flood-engine.md.
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <variant>
#include <vector>

namespace ccd::flood {

// Highest sea level the engine accepts, in metres (docs/flood-engine.md §3).
inline constexpr double kMaxSeaLevelM = 2.0;

struct FloodInput {
    std::size_t width = 0;                 // number of columns
    std::size_t height = 0;                // number of rows
    double cell_size_m = 0.0;              // side of one square cell, metres (ITM)
    float nodata = -9999.0f;               // marks a cell with no elevation data; must be finite
    std::vector<float> elevation_m;        // width * height values, row-major, metres
    std::vector<std::uint8_t> is_sea;      // width * height values, row-major, non-zero = sea
};

struct FloodResult {
    std::vector<std::uint8_t> flooded;     // width * height values, row-major, 1 = flooded land
    std::size_t flooded_cells = 0;         // number of 1 values in `flooded`
    double flooded_area_km2 = 0.0;         // flooded_cells * cell_size_m^2 / 1e6
};

enum class FloodErrorCode {
    EmptyGrid,
    SizeOverflow,
    ElevationSizeMismatch,
    SeaMaskSizeMismatch,
    InvalidCellSize,
    InvalidSeaLevel,
    NonFiniteElevation,
    AllocationFailed,
};

struct FloodError {
    FloodErrorCode code;
    std::string message;                   // plain English, names the wrong value
};

// Either a full result or an error, never both and never a partial result.
using FloodOutcome = std::variant<FloodResult, FloodError>;

// Computes which land cells flood at `sea_level_m` (metres, 0.0 to kMaxSeaLevelM).
// Does not throw on bad input; errors are returned as FloodError.
[[nodiscard]] FloodOutcome compute_flood(const FloodInput& input, double sea_level_m);

}  // namespace ccd::flood
