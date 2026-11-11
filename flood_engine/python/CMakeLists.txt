# Python binding for the flood engine (CCD-399). Usage: docs/flood-engine.md §10.

find_package(Python 3 REQUIRED COMPONENTS Interpreter Development.Module)

include(FetchContent)
FetchContent_Declare(
    pybind11
    GIT_REPOSITORY https://github.com/pybind/pybind11.git
    GIT_TAG        v3.1.0
    GIT_SHALLOW    TRUE
)
# pybind11 is added as a subproject, so it marks its own include directory as SYSTEM:
# our -Wall -Wextra ... flags (flood_engine_options) report nothing inside pybind11 headers.
FetchContent_MakeAvailable(pybind11)

# The module is a shared library, so the static engine library linked into it must be
# position-independent (-fPIC).
set_target_properties(flood_engine PROPERTIES POSITION_INDEPENDENT_CODE ON)

pybind11_add_module(flood_engine_py flood_engine_py.cpp)
target_link_libraries(flood_engine_py PRIVATE flood_engine flood_engine_options)
