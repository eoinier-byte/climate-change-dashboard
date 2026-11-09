// Flood engine implementation (CCD-397). Rules and format: docs/flood-engine.md.
#include "flood_engine/flood.hpp"

#include <array>
#include <cmath>
#include <limits>
#include <new>
#include <optional>
#include <sstream>
#include <string>
#include <utility>

namespace ccd::flood {
namespace {

// Formats a number for an error message: 2.5 -> "2.5", NaN -> "nan".
std::string to_text(double value) {
    std::ostringstream os;
    os << value;
    return os.str();
}

// Checks every input rule, in the order of docs/flood-engine.md §6.
// Returns the first error found, or std::nullopt if the input is valid.
// Nothing is computed here, so a failure can never leave a partial result.
std::optional<FloodError> validate(const FloodInput& in, double sea_level_m) {
    if (in.width == 0 || in.height == 0) {
        return FloodError{FloodErrorCode::EmptyGrid,
                          "grid is empty: width = " + std::to_string(in.width) +
                              ", height = " + std::to_string(in.height)};
    }

    // width * height would overflow exactly when width > SIZE_MAX / height.
    // height is not 0 here (checked above), so the division is safe.
    if (in.width > std::numeric_limits<std::size_t>::max() / in.height) {
        return FloodError{FloodErrorCode::SizeOverflow,
                          "width * height does not fit in std::size_t: width = " +
                              std::to_string(in.width) + ", height = " + std::to_string(in.height)};
    }
    const std::size_t cell_count = in.width * in.height;  // cannot overflow now

    if (in.elevation_m.size() != cell_count) {
        return FloodError{FloodErrorCode::ElevationSizeMismatch,
                          "elevation_m has " + std::to_string(in.elevation_m.size()) +
                              " values, expected width * height = " + std::to_string(cell_count)};
    }

    if (in.is_sea.size() != cell_count) {
        return FloodError{FloodErrorCode::SeaMaskSizeMismatch,
                          "is_sea has " + std::to_string(in.is_sea.size()) +
                              " values, expected width * height = " + std::to_string(cell_count)};
    }

    if (!std::isfinite(in.cell_size_m) || in.cell_size_m <= 0.0) {
        return FloodError{FloodErrorCode::InvalidCellSize,
                          "cell_size_m = " + to_text(in.cell_size_m) + " must be finite and > 0"};
    }

    if (!std::isfinite(sea_level_m) || sea_level_m < 0.0 || sea_level_m > kMaxSeaLevelM) {
        return FloodError{FloodErrorCode::InvalidSeaLevel,
                          "sea_level_m = " + to_text(sea_level_m) + " is outside [0.0, " +
                              to_text(kMaxSeaLevelM) + "]"};
    }

    // Only land cells are checked: the elevation of a sea cell is ignored (docs §3).
    for (std::size_t i = 0; i < cell_count; ++i) {
        const float elevation = in.elevation_m[i];
        if (in.is_sea[i] == 0 && elevation != in.nodata && !std::isfinite(elevation)) {
            return FloodError{FloodErrorCode::NonFiniteElevation,
                              "elevation_m at row " + std::to_string(i / in.width) + ", col " +
                                  std::to_string(i % in.width) + " is " + to_text(elevation) +
                                  " (not finite and not equal to nodata)"};
        }
    }

    return std::nullopt;
}

// Writes the indices of the 4-neighbours (up, down, left, right) of cell `i` into `out`
// and returns how many there are (2 in a corner, 3 on an edge, 4 inside).
// The bounds are checked on row and column, so no index can wrap around or leave the grid.
std::size_t neighbours(std::size_t i, std::size_t width, std::size_t height,
                       std::array<std::size_t, 4>& out) {
    const std::size_t row = i / width;
    const std::size_t col = i % width;
    std::size_t count = 0;
    if (row > 0) out[count++] = i - width;           // up
    if (row + 1 < height) out[count++] = i + width;  // down
    if (col > 0) out[count++] = i - 1;               // left
    if (col + 1 < width) out[count++] = i + 1;       // right
    return count;
}

// Breadth-first search from the sea. Assumes `in` and `sea_level_m` are valid.
FloodResult run_flood(const FloodInput& in, double sea_level_m) {
    const std::size_t width = in.width;
    const std::size_t height = in.height;
    const std::size_t cell_count = width * height;

    // Compare in float, the precision of the elevation data. Otherwise a cell stored as
    // 1.2f (= 1.2000000477) would stay dry at the sea level 1.2 (docs §5).
    const float level = static_cast<float>(sea_level_m);

    FloodResult result;
    result.flooded.assign(cell_count, 0);  // also the "visited" set for land cells

    // FIFO queue of cell indices: read from position `head`, append at the back.
    std::vector<std::size_t> queue;
    std::array<std::size_t, 4> nb{};

    // Start points: sea cells with at least one land neighbour. A sea cell surrounded only by
    // sea cannot flood land directly, so leaving it out gives the same result with a smaller queue.
    for (std::size_t i = 0; i < cell_count; ++i) {
        if (in.is_sea[i] == 0) {
            continue;
        }
        const std::size_t n = neighbours(i, width, height, nb);
        for (std::size_t k = 0; k < n; ++k) {
            if (in.is_sea[nb[k]] == 0) {
                queue.push_back(i);
                break;
            }
        }
    }

    std::size_t flooded_cells = 0;
    for (std::size_t head = 0; head < queue.size(); ++head) {
        const std::size_t cell = queue[head];  // copy: push_back below may reallocate `queue`
        const std::size_t n = neighbours(cell, width, height, nb);
        for (std::size_t k = 0; k < n; ++k) {
            const std::size_t next = nb[k];
            const bool can_flood = in.is_sea[next] == 0           // land
                                   && result.flooded[next] == 0   // not visited yet
                                   && in.elevation_m[next] != in.nodata  // no-data = dry wall
                                   && in.elevation_m[next] <= level;
            if (can_flood) {
                result.flooded[next] = 1;
                ++flooded_cells;
                queue.push_back(next);
            }
        }
    }

    result.flooded_cells = flooded_cells;
    result.flooded_area_km2 =
        static_cast<double>(flooded_cells) * in.cell_size_m * in.cell_size_m / 1e6;
    return result;
}

}  // namespace

FloodOutcome compute_flood(const FloodInput& input, double sea_level_m) {
    // Everything that allocates (error messages, the result, the queue) is inside the try,
    // so std::bad_alloc becomes an error value and never leaves this function.
    try {
        if (std::optional<FloodError> error = validate(input, sea_level_m)) {
            return std::move(*error);
        }
        return run_flood(input, sea_level_m);
    } catch (const std::bad_alloc&) {
        // Short fixed message: fits in std::string's small-string buffer on GCC, Clang and MSVC,
        // so building it does not need to allocate memory again.
        return FloodError{FloodErrorCode::AllocationFailed, "out of memory"};
    }
}

}  // namespace ccd::flood
