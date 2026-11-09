// Catch2 tests for the flood engine (CCD-398).
// Hand-calculated expected values: CCD-395 agent instructions §5 and docs/flood-engine.md.
#include "flood_engine/flood.hpp"

#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <ostream>
#include <random>
#include <variant>
#include <vector>

using namespace ccd::flood;
using Catch::Matchers::WithinAbs;

// Lets Catch print error codes by name ("EmptyGrid") instead of as a number.
// Must be in namespace ccd::flood so Catch finds it (argument-dependent lookup).
namespace ccd::flood {
std::ostream& operator<<(std::ostream& os, FloodErrorCode code) {
    switch (code) {
        case FloodErrorCode::EmptyGrid: return os << "EmptyGrid";
        case FloodErrorCode::SizeOverflow: return os << "SizeOverflow";
        case FloodErrorCode::ElevationSizeMismatch: return os << "ElevationSizeMismatch";
        case FloodErrorCode::SeaMaskSizeMismatch: return os << "SeaMaskSizeMismatch";
        case FloodErrorCode::InvalidCellSize: return os << "InvalidCellSize";
        case FloodErrorCode::InvalidSeaLevel: return os << "InvalidSeaLevel";
        case FloodErrorCode::NonFiniteElevation: return os << "NonFiniteElevation";
        case FloodErrorCode::AllocationFailed: return os << "AllocationFailed";
    }
    return os << "unknown FloodErrorCode";
}
}  // namespace ccd::flood

namespace {

constexpr float kNaN = std::numeric_limits<float>::quiet_NaN();
constexpr float kInf = std::numeric_limits<float>::infinity();

// The 21 sea levels the precompute script uses: k / 10.0 for k = 0..20 (docs §3).
constexpr int kLevelSteps = 20;
double level(int k) { return k / 10.0; }

// A (row, col) position. operator<< lets Catch print lists of cells when a check fails.
struct Cell {
    std::size_t row;
    std::size_t col;
    bool operator==(const Cell&) const = default;
};

std::ostream& operator<<(std::ostream& os, const Cell& cell) {
    return os << '(' << cell.row << ',' << cell.col << ')';
}

// The hand-calculated 5x5 grid. Column 0 is sea. 1 cell = 1 km x 1 km = 1 km2.
//         c0   c1   c2   c3   c4
//   r0   SEA  0.5  1.5  3.0  3.0
//   r1   SEA  0.8  1.2  3.0  0.3   <- (1,4) inland hollow, walled by 3.0 m
//   r2   SEA  1.0  2.5  3.0  3.0
//   r3   SEA  0.4  0.9  3.0  3.0
//   r4   SEA  1.8  1.1  3.0  3.0
FloodInput make_table_grid() {
    FloodInput in;
    in.width = 5;
    in.height = 5;
    in.cell_size_m = 1000.0;
    in.elevation_m = {
        0.0f, 0.5f, 1.5f, 3.0f, 3.0f,
        0.0f, 0.8f, 1.2f, 3.0f, 0.3f,
        0.0f, 1.0f, 2.5f, 3.0f, 3.0f,
        0.0f, 0.4f, 0.9f, 3.0f, 3.0f,
        0.0f, 1.8f, 1.1f, 3.0f, 3.0f,
    };
    in.is_sea = {
        1, 0, 0, 0, 0,
        1, 0, 0, 0, 0,
        1, 0, 0, 0, 0,
        1, 0, 0, 0, 0,
        1, 0, 0, 0, 0,
    };
    return in;
}

// 50x50 grid from a fixed seed. std::mt19937 gives the same numbers on every platform.
// (std::uniform_real_distribution is not used: its output differs between standard libraries.)
// Column 0 and the bottom row are sea; about 1 in 20 land cells is no-data;
// other land cells are -0.5 m to 3.0 m in 1 mm steps.
FloodInput make_random_grid() {
    constexpr std::size_t n = 50;
    std::mt19937 gen(42);
    FloodInput in;
    in.width = n;
    in.height = n;
    in.cell_size_m = 90.0;
    in.elevation_m.resize(n * n);
    in.is_sea.resize(n * n);
    for (std::size_t r = 0; r < n; ++r) {
        for (std::size_t c = 0; c < n; ++c) {
            const std::size_t i = r * n + c;
            const auto draw = static_cast<std::uint32_t>(gen());
            if (c == 0 || r == n - 1) {
                in.is_sea[i] = 1;
                in.elevation_m[i] = 0.0f;
            } else if (draw % 20u == 0u) {
                in.elevation_m[i] = in.nodata;
            } else {
                in.elevation_m[i] = static_cast<float>((draw / 20u) % 3501u) / 1000.0f - 0.5f;
            }
        }
    }
    return in;
}

// Returns the result, or fails the test (with the error message) if an error came back.
const FloodResult& require_result(const FloodOutcome& outcome) {
    if (const auto* err = std::get_if<FloodError>(&outcome)) {
        FAIL("expected a result, got error " << err->code << ": " << err->message);
    }
    return std::get<FloodResult>(outcome);
}

// Checks that an error with `expected` code came back, and no result.
void require_error(const FloodOutcome& outcome, FloodErrorCode expected) {
    REQUIRE(std::holds_alternative<FloodError>(outcome));
    CHECK_FALSE(std::holds_alternative<FloodResult>(outcome));
    const FloodError& err = std::get<FloodError>(outcome);
    INFO("message: " << err.message);
    CHECK(err.code == expected);
    CHECK_FALSE(err.message.empty());
}

// Flooded cells of a result, in row-major order.
std::vector<Cell> flooded_list(const FloodResult& result, std::size_t width) {
    std::vector<Cell> cells;
    for (std::size_t i = 0; i < result.flooded.size(); ++i) {
        if (result.flooded[i] != 0) {
            cells.push_back(Cell{i / width, i % width});
        }
    }
    return cells;
}

// Runs the engine and checks the exact flooded cells, the count and the area.
// `expected` must be in row-major order.
void check_flood(const FloodInput& in, double sea_level_m, const std::vector<Cell>& expected) {
    INFO("sea level = " << sea_level_m << " m");
    const FloodOutcome outcome = compute_flood(in, sea_level_m);
    const FloodResult& result = require_result(outcome);

    REQUIRE(result.flooded.size() == in.width * in.height);
    for (const std::uint8_t value : result.flooded) {
        REQUIRE(value <= 1);  // only 0 or 1 allowed
    }
    CHECK(flooded_list(result, in.width) == expected);
    CHECK(result.flooded_cells == expected.size());

    const double cell_area_km2 = in.cell_size_m * in.cell_size_m / 1e6;
    const double expected_km2 = static_cast<double>(expected.size()) * cell_area_km2;
    CHECK_THAT(result.flooded_area_km2, WithinAbs(expected_km2, 1e-9));
}

// True if every cell flooded in `lower` is also flooded in `higher`.
bool is_subset(const FloodResult& lower, const FloodResult& higher) {
    if (lower.flooded.size() != higher.flooded.size()) {
        return false;
    }
    for (std::size_t i = 0; i < lower.flooded.size(); ++i) {
        if (lower.flooded[i] != 0 && higher.flooded[i] == 0) {
            return false;
        }
    }
    return true;
}

// Computes all 21 levels and checks flooded(h1) is a subset of flooded(h2) for every h1 < h2.
std::vector<FloodResult> check_monotonic(const FloodInput& in) {
    std::vector<FloodResult> results;
    for (int k = 0; k <= kLevelSteps; ++k) {
        INFO("sea level = " << level(k) << " m");
        const FloodOutcome outcome = compute_flood(in, level(k));
        results.push_back(require_result(outcome));
    }
    for (int lo = 0; lo <= kLevelSteps; ++lo) {
        for (int hi = lo + 1; hi <= kLevelSteps; ++hi) {
            INFO("h1 = " << level(lo) << " m, h2 = " << level(hi) << " m");
            CHECK(is_subset(results[static_cast<std::size_t>(lo)],
                            results[static_cast<std::size_t>(hi)]));
        }
    }
    return results;
}

// Rule checks that need no hand calculation (used on the random grid):
//  - no sea cell and no no-data cell is flooded, and every flooded cell is <= the sea level;
//  - every flooded cell has a 4-neighbour that is sea or flooded (local connectivity);
//  - every land cell <= the sea level that has a sea or flooded 4-neighbour is flooded (nothing missed);
//  - the count and the area match the mask.
void check_rules(const FloodInput& in, double sea_level_m, const FloodResult& result) {
    INFO("sea level = " << sea_level_m << " m");
    REQUIRE(result.flooded.size() == in.width * in.height);
    const float level_f = static_cast<float>(sea_level_m);

    auto wet = [&](std::size_t r, std::size_t c) {
        const std::size_t i = r * in.width + c;
        return in.is_sea[i] != 0 || result.flooded[i] != 0;
    };
    auto has_wet_neighbour = [&](std::size_t r, std::size_t c) {
        return (r > 0 && wet(r - 1, c)) || (r + 1 < in.height && wet(r + 1, c)) ||
               (c > 0 && wet(r, c - 1)) || (c + 1 < in.width && wet(r, c + 1));
    };

    std::size_t count = 0;
    std::size_t bad_flooded = 0;  // flooded but breaks a rule
    std::size_t missed = 0;       // should be flooded but is not
    for (std::size_t r = 0; r < in.height; ++r) {
        for (std::size_t c = 0; c < in.width; ++c) {
            const std::size_t i = r * in.width + c;
            const bool sea = in.is_sea[i] != 0;
            const bool nodata = in.elevation_m[i] == in.nodata;
            const bool low = !sea && !nodata && in.elevation_m[i] <= level_f;
            if (result.flooded[i] != 0) {
                ++count;
                if (!low || !has_wet_neighbour(r, c)) {
                    ++bad_flooded;
                }
            } else if (low && has_wet_neighbour(r, c)) {
                ++missed;
            }
        }
    }
    CHECK(bad_flooded == 0);
    CHECK(missed == 0);
    CHECK(result.flooded_cells == count);
    const double cell_area_km2 = in.cell_size_m * in.cell_size_m / 1e6;
    CHECK_THAT(result.flooded_area_km2,
               WithinAbs(static_cast<double>(count) * cell_area_km2, 1e-9));
}

}  // namespace

// ---------------------------------------------------------------------------------------------
// Valid input: the hand-calculated 5x5 table
// ---------------------------------------------------------------------------------------------

TEST_CASE("5x5 grid, sea level 0.0 m: nothing floods", "[valid][table]") {
    check_flood(make_table_grid(), 0.0, {});
}

TEST_CASE("5x5 grid, sea level 0.5 m: 2 cells flood", "[valid][table]") {
    check_flood(make_table_grid(), 0.5, {{0, 1}, {3, 1}});
}

TEST_CASE("5x5 grid, sea level 1.0 m: 5 cells flood", "[valid][table]") {
    check_flood(make_table_grid(), 1.0, {{0, 1}, {1, 1}, {2, 1}, {3, 1}, {3, 2}});
}

TEST_CASE("5x5 grid, sea level 1.2 m: 7 cells flood", "[valid][table]") {
    check_flood(make_table_grid(), 1.2,
                {{0, 1}, {1, 1}, {1, 2}, {2, 1}, {3, 1}, {3, 2}, {4, 2}});
}

TEST_CASE("5x5 grid, sea level 2.0 m: 9 cells flood", "[valid][table]") {
    check_flood(make_table_grid(), 2.0,
                {{0, 1}, {0, 2}, {1, 1}, {1, 2}, {2, 1}, {3, 1}, {3, 2}, {4, 1}, {4, 2}});
}

TEST_CASE("5x5 grid: inland hollow at (1,4) stays dry at every level", "[valid][table]") {
    // (1,4) is 0.3 m, so from 0.3 m it is below the sea level, but it is not connected to the sea.
    const FloodInput in = make_table_grid();
    for (int k = 0; k <= kLevelSteps; ++k) {
        INFO("sea level = " << level(k) << " m");
        const FloodOutcome outcome = compute_flood(in, level(k));
        const FloodResult& result = require_result(outcome);
        REQUIRE(result.flooded.size() == in.width * in.height);
        CHECK(result.flooded[1 * in.width + 4] == 0);
    }
}

// ---------------------------------------------------------------------------------------------
// Valid input: special cases
// ---------------------------------------------------------------------------------------------

TEST_CASE("everything floods when all land is below the sea level", "[valid]") {
    // 4 wide x 3 high, column 0 is sea. 90 m cells: 1 cell = 8100 m2 = 0.0081 km2.
    FloodInput in;
    in.width = 4;
    in.height = 3;
    in.cell_size_m = 90.0;
    in.elevation_m = {
        0.0f, 0.2f, 0.5f, 1.0f,
        0.0f, 0.9f, 0.1f, 0.7f,
        0.0f, 1.0f, 0.3f, 0.6f,
    };
    in.is_sea = {
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0,
    };
    check_flood(in, 2.0,
                {{0, 1}, {0, 2}, {0, 3}, {1, 1}, {1, 2}, {1, 3}, {2, 1}, {2, 2}, {2, 3}});
}

TEST_CASE("a low cell that touches the sea only diagonally stays dry", "[valid]") {
    //   SEA  3.0
    //   3.0  0.2   <- (1,1) touches the sea only at a corner
    FloodInput in;
    in.width = 2;
    in.height = 2;
    in.cell_size_m = 1000.0;
    in.elevation_m = {0.0f, 3.0f, 3.0f, 0.2f};
    in.is_sea = {1, 0, 0, 0};

    SECTION("corner contact only: dry") {
        check_flood(in, 1.0, {});
    }
    SECTION("control: with an edge path through (0,1) it floods") {
        in.elevation_m[1] = 0.5f;
        check_flood(in, 1.0, {{0, 1}, {1, 1}});
    }
}

TEST_CASE("a no-data cell is never flooded and blocks spreading", "[valid]") {
    // One row: SEA | no-data | 0.2 | 0.2. The no-data value -9999 is below the sea level as a
    // number, so an engine that forgot to check for no-data would flood everything.
    FloodInput in;
    in.width = 4;
    in.height = 1;
    in.cell_size_m = 1000.0;
    in.elevation_m = {0.0f, in.nodata, 0.2f, 0.2f};
    in.is_sea = {1, 0, 0, 0};
    check_flood(in, 1.0, {});
}

TEST_CASE("a grid with no sea cells is valid and nothing floods", "[valid]") {
    FloodInput in;
    in.width = 3;
    in.height = 3;
    in.cell_size_m = 1000.0;
    in.elevation_m.assign(9, 0.1f);
    in.is_sea.assign(9, 0);
    check_flood(in, 2.0, {});
}

TEST_CASE("any non-zero is_sea value counts as sea", "[valid]") {
    FloodInput in = make_table_grid();
    const std::uint8_t sea_values[] = {255, 2, 7, 1, 128};
    for (std::size_t r = 0; r < in.height; ++r) {
        in.is_sea[r * in.width] = sea_values[r];
    }
    check_flood(in, 1.0, {{0, 1}, {1, 1}, {2, 1}, {3, 1}, {3, 2}});
}

TEST_CASE("the elevation of a sea cell is ignored, even NaN or infinite", "[valid]") {
    // docs §3: for sea cells the elevation value is ignored (pending Artur's confirmation).
    FloodInput in = make_table_grid();
    in.elevation_m[0 * in.width] = kNaN;   // sea cell (0,0)
    in.elevation_m[2 * in.width] = kInf;   // sea cell (2,0)
    in.elevation_m[4 * in.width] = -kInf;  // sea cell (4,0)
    check_flood(in, 1.0, {{0, 1}, {1, 1}, {2, 1}, {3, 1}, {3, 2}});
}

TEST_CASE("a cell exactly at the sea level floods, at every level step", "[valid]") {
    // The elevation is the float nearest to k/10 (as stored in a float GeoTIFF), the sea level is
    // the double k/10. Many of these are not equal as numbers (1.2f > 1.2), so this pins down that
    // the comparison is done in float precision (docs §5, pending Artur's confirmation).
    for (int k = 0; k <= kLevelSteps; ++k) {
        FloodInput in;
        in.width = 2;
        in.height = 1;
        in.cell_size_m = 1000.0;
        in.elevation_m = {0.0f, static_cast<float>(level(k))};
        in.is_sea = {1, 0};
        check_flood(in, level(k), {{0, 1}});
        if (k > 0) {
            check_flood(in, level(k - 1), {});  // one step lower: dry
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Valid input: monotonicity (a higher sea level never un-floods a cell)
// ---------------------------------------------------------------------------------------------

TEST_CASE("monotonic: 5x5 grid, every pair of levels h1 < h2", "[valid][monotonic]") {
    check_monotonic(make_table_grid());
}

TEST_CASE("monotonic: 50x50 random grid (seed 42), every pair of levels h1 < h2",
          "[valid][monotonic]") {
    const FloodInput in = make_random_grid();
    const std::vector<FloodResult> results = check_monotonic(in);
    REQUIRE(results.size() == static_cast<std::size_t>(kLevelSteps + 1));
    // Guard: the test would pass trivially if nothing ever flooded.
    CHECK(results.back().flooded_cells > results.front().flooded_cells);
    for (int k = 0; k <= kLevelSteps; ++k) {
        check_rules(in, level(k), results[static_cast<std::size_t>(k)]);
    }
}

// ---------------------------------------------------------------------------------------------
// Invalid input: each case must return the matching error code and no result.
// Each case breaks exactly one rule of an otherwise valid input.
// AllocationFailed is not tested: out-of-memory cannot be triggered reliably in a unit test.
// ---------------------------------------------------------------------------------------------

TEST_CASE("empty grid returns EmptyGrid", "[invalid]") {
    FloodInput in;
    in.cell_size_m = 1000.0;
    SECTION("width 0") {
        in.width = 0;
        in.height = 3;
    }
    SECTION("height 0") {
        in.width = 3;
        in.height = 0;
    }
    SECTION("width and height 0") {
        in.width = 0;
        in.height = 0;
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::EmptyGrid);
}

TEST_CASE("width * height overflow returns SizeOverflow", "[invalid]") {
    // The vectors cannot have the overflowing size, so they are empty. This also pins down that
    // overflow is checked before the size-mismatch checks.
    FloodInput in;
    in.cell_size_m = 1000.0;
    SECTION("width = SIZE_MAX, height = 2") {
        in.width = std::numeric_limits<std::size_t>::max();
        in.height = 2;
    }
    SECTION("width = height = 2^(bits/2): the product wraps around to exactly 0") {
        // On 64-bit: 2^32 * 2^32 = 2^64, which wraps to 0 and would "match" the empty vectors.
        const std::size_t half = std::size_t{1} << (std::numeric_limits<std::size_t>::digits / 2);
        in.width = half;
        in.height = half;
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::SizeOverflow);
}

TEST_CASE("elevation size mismatch returns ElevationSizeMismatch", "[invalid]") {
    FloodInput in = make_table_grid();
    SECTION("one value too few") {
        in.elevation_m.pop_back();
    }
    SECTION("one value too many") {
        in.elevation_m.push_back(1.0f);
    }
    SECTION("empty") {
        in.elevation_m.clear();
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::ElevationSizeMismatch);
}

TEST_CASE("sea mask size mismatch returns SeaMaskSizeMismatch", "[invalid]") {
    FloodInput in = make_table_grid();
    SECTION("one value too few") {
        in.is_sea.pop_back();
    }
    SECTION("one value too many") {
        in.is_sea.push_back(0);
    }
    SECTION("empty") {
        in.is_sea.clear();
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::SeaMaskSizeMismatch);
}

TEST_CASE("invalid cell size returns InvalidCellSize", "[invalid]") {
    FloodInput in = make_table_grid();
    SECTION("zero") {
        in.cell_size_m = 0.0;
    }
    SECTION("negative") {
        in.cell_size_m = -1000.0;
    }
    SECTION("NaN") {
        in.cell_size_m = std::numeric_limits<double>::quiet_NaN();
    }
    SECTION("infinite") {
        in.cell_size_m = std::numeric_limits<double>::infinity();
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::InvalidCellSize);
}

TEST_CASE("invalid sea level returns InvalidSeaLevel", "[invalid]") {
    const FloodInput in = make_table_grid();
    double sea_level_m = 1.0;
    SECTION("negative") {
        sea_level_m = -0.1;
    }
    SECTION("above 2.0 m") {
        sea_level_m = 2.5;
    }
    SECTION("just above 2.0 m (next double after 2.0)") {
        sea_level_m = std::nextafter(kMaxSeaLevelM, 3.0);
    }
    SECTION("NaN") {
        sea_level_m = std::numeric_limits<double>::quiet_NaN();
    }
    SECTION("+infinity") {
        sea_level_m = std::numeric_limits<double>::infinity();
    }
    SECTION("-infinity") {
        sea_level_m = -std::numeric_limits<double>::infinity();
    }
    require_error(compute_flood(in, sea_level_m), FloodErrorCode::InvalidSeaLevel);
}

TEST_CASE("NaN or infinite land elevation returns NonFiniteElevation", "[invalid]") {
    FloodInput in = make_table_grid();
    const std::size_t land = 2 * in.width + 1;  // cell (2,1), a land cell
    SECTION("NaN") {
        in.elevation_m[land] = kNaN;
    }
    SECTION("+infinity") {
        in.elevation_m[land] = kInf;
    }
    SECTION("-infinity") {
        in.elevation_m[land] = -kInf;
    }
    require_error(compute_flood(in, 1.0), FloodErrorCode::NonFiniteElevation);
}
