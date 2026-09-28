// Minimal test harness: TEST(name) { CHECK(...); CHECK_NEAR(a, b, eps); }
#pragma once
#include <cmath>
#include <cstdio>
#include <functional>
#include <vector>

namespace qt {
struct Case { const char* name; void (*fn)(); };
inline std::vector<Case>& registry() { static std::vector<Case> r; return r; }
inline int& failures() { static int f = 0; return f; }
struct Reg { Reg(const char* n, void (*f)()) { registry().push_back({n, f}); } };
}  // namespace qt

#define TEST(name) static void test_##name(); static qt::Reg reg_##name(#name, test_##name); static void test_##name()
#define CHECK(cond) do { if (!(cond)) { std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); qt::failures()++; } } while (0)
#define CHECK_NEAR(a, b, eps) do { double _a = (a), _b = (b); if (std::fabs(_a - _b) > (eps)) { \
    std::printf("  FAIL %s:%d  %s = %g, expected %g\n", __FILE__, __LINE__, #a, _a, _b); qt::failures()++; } } while (0)
