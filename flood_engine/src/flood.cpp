#include "flood_engine/flood.hpp"

namespace ccd::flood {

// STUB for CCD-398 (tests first). The real implementation comes in CCD-397.
// It returns AllocationFailed on purpose: that is the only error code no test asks for
// (it cannot be triggered reliably in a unit test), so every test fails against this stub.
FloodOutcome compute_flood([[maybe_unused]] const FloodInput& input,
                           [[maybe_unused]] double sea_level_m) {
    return FloodError{FloodErrorCode::AllocationFailed,
                      "compute_flood is not implemented yet (CCD-397)"};
}

}  // namespace ccd::flood
