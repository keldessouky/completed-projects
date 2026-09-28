#pragma once
#include <cstdarg>

namespace q {
enum class LogLevel { Debug, Info, Warn, Error };
using LogSink = void (*)(LogLevel, const char* msg);
void set_log_sink(LogSink sink);
void logf(LogLevel lvl, const char* fmt, ...);
}  // namespace q

#define QLOG(...) ::q::logf(::q::LogLevel::Info, __VA_ARGS__)
#define QWARN(...) ::q::logf(::q::LogLevel::Warn, __VA_ARGS__)
#define QERR(...) ::q::logf(::q::LogLevel::Error, __VA_ARGS__)
