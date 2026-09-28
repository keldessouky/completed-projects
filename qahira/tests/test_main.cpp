#include "tests/check.hpp"
int main() {
    int before = 0;
    for (auto& c : qt::registry()) {
        before = qt::failures();
        c.fn();
        std::printf("%s %s\n", qt::failures() == before ? "ok  " : "FAIL", c.name);
    }
    std::printf("%zu tests, %d failed checks\n", qt::registry().size(), qt::failures());
    return qt::failures() ? 1 : 0;
}
