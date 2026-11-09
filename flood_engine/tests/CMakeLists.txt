include(FetchContent)

FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG        v3.8.1
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(Catch2)

add_executable(flood_engine_tests test_flood.cpp)
target_link_libraries(flood_engine_tests PRIVATE
    flood_engine
    flood_engine_options
    Catch2::Catch2WithMain)

# catch_discover_tests registers every TEST_CASE as its own ctest test.
list(APPEND CMAKE_MODULE_PATH ${catch2_SOURCE_DIR}/extras)
include(Catch)
catch_discover_tests(flood_engine_tests)
