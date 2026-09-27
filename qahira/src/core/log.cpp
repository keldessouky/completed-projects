#include "core/log.hpp"
#include <cstdio>

namespace q {
static LogSink g_sink = nullptr;
void set_log_sink(LogSink sink) { g_sink = sink; }
void logf(LogLevel lvl, const char* fmt, ...) {
    char buf[2048];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(buf, sizeof buf, fmt, ap);
    va_end(ap);
    if (g_sink) g_sink(lvl, buf);
    else fprintf(stderr, "[qahira] %s\n", buf);
}
}  // namespace q
