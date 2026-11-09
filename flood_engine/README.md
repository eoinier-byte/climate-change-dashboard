# flood_engine

C++20 flood engine (CCD-395). Input/output format: [docs/flood-engine.md](../docs/flood-engine.md).

Requires CMake 3.20+ and a C++20 compiler. Catch2 is downloaded by CMake on the first configure.

Run from the repository root:

```bash
cmake -S flood_engine -B flood_engine/build -DCMAKE_BUILD_TYPE=Debug
cmake --build flood_engine/build -j
ctest --test-dir flood_engine/build --output-on-failure
```

With AddressSanitizer and UndefinedBehaviorSanitizer (GCC/Clang, Debug only):

```bash
cmake -S flood_engine -B flood_engine/build/asan -DCMAKE_BUILD_TYPE=Debug -DFLOOD_ENGINE_SANITIZE=ON
cmake --build flood_engine/build/asan -j
ctest --test-dir flood_engine/build/asan --output-on-failure
```
