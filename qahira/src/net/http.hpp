// A small HTTP client, for the radio's episodes: GET over http:// or https:// (Mbed TLS, verified against the system's
// certificate authorities), following redirects, with chunked bodies and resuming from a byte offset. It blocks, so it
// runs on a thread of its own; another thread can abort it. Also reads file:// (the tests' stations).
#pragma once
#include <atomic>
#include <cstdint>
#include <functional>
#include <string>

namespace q::net {

// lets another thread stop a request: its socket is shut, and whatever it was waiting on returns
struct Cancel {
    std::atomic<bool> stop{false};
    std::atomic<int> fd{-1};
    void abort();
};

struct Result {
    int status = 0;          // the last response's HTTP status (200 for a file); 0 when none came
    bool resumed = false;    // the body starts at the offset asked for (206), not at the start
    int64_t length = -1;     // the body's length, when the server says
    uint64_t received = 0;   // body bytes handed on
    bool complete = false;   // the whole body came (as long as it said, or to its end)
    std::string error;       // why not, when it failed
    bool ok() const { return complete && (status == 200 || status == 206); }
};

// GET url; the body comes to on_data in pieces (false stops it). from > 0 asks for the body from that byte on;
// on_start hears the answer (status, resumed or not, length) before the first piece.
Result get(const std::string& url, const std::function<bool(const char*, size_t)>& on_data, uint64_t from = 0,
           Cancel* cancel = nullptr, const std::function<void(const Result&)>& on_start = nullptr);
// the whole body as text (up to max bytes)
bool get_text(const std::string& url, std::string& out, Cancel* cancel = nullptr, std::string* err = nullptr,
              size_t max = size_t(32) << 20);
// percent-encodes what a URL's path may not hold as it is (spaces, Arabic, ?, #, %)
std::string encode_path(const std::string& s);

}  // namespace q::net
