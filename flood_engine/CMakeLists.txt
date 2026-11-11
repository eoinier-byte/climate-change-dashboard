cmake_minimum_required(VERSION 3.20)

project(flood_engine VERSION 0.1.0 LANGUAGES CXX)

# Tests are on by default. The Python binding (CCD-419) can turn them off so it does not need Catch2.
option(FLOOD_ENGINE_BUILD_TESTS "Build the Catch2 tests" ON)
# Python binding (CCD-399): builds the pybind11 module flood_engine_py. Off by default.
option(FLOOD_ENGINE_BUILD_PYTHON "Build the Python module flood_engine_py (needs Python 3 headers)" OFF)
option(FLOOD_ENGINE_SANITIZE "Enable AddressSanitizer and UndefinedBehaviorSanitizer in Debug builds" OFF)

set(CMAKE_CXX_EXTENSIONS OFF)  # -std=c++20, not -std=gnu++20

# Shared compile settings (warnings, sanitizers) for our own targets only, not for Catch2.
add_library(flood_engine_options INTERFACE)

if(MSVC)
    target_compile_options(flood_engine_options INTERFACE /W4)
else()
    target_compile_options(flood_engine_options INTERFACE
        -Wall -Wextra -Wpedantic -Wconversion -Wshadow)
endif()

if(FLOOD_ENGINE_SANITIZE)
    if(MSVC)
        message(WARNING "FLOOD_ENGINE_SANITIZE is only supported with GCC and Clang; ignored.")
    else()
        # -fno-sanitize-recover makes undefined behaviour stop the program, so the test fails
        # instead of only printing a message.
        set(_flood_sanitize_flags -fsanitize=address,undefined -fno-sanitize-recover=undefined)
        target_compile_options(flood_engine_options INTERFACE
            $<$<CONFIG:Debug>:${_flood_sanitize_flags} -fno-omit-frame-pointer>)
        target_link_options(flood_engine_options INTERFACE
            $<$<CONFIG:Debug>:${_flood_sanitize_flags}>)
    endif()
endif()

add_library(flood_engine src/flood.cpp)
target_include_directories(flood_engine PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_features(flood_engine PUBLIC cxx_std_20)
target_link_libraries(flood_engine PRIVATE flood_engine_options)

if(FLOOD_ENGINE_BUILD_PYTHON)
    add_subdirectory(python)
endif()

if(FLOOD_ENGINE_BUILD_TESTS)
    enable_testing()  # must be in this top-level file so `ctest --test-dir build` finds the tests
    add_subdirectory(tests)
endif()
