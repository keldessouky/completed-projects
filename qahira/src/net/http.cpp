#include "net/http.hpp"
#include "core/log.hpp"
#include <cctype>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>
#include <dirent.h>
#include <fcntl.h>
#include <netdb.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#include "mbedtls/base64.h"
#include "mbedtls/ctr_drbg.h"
#include "mbedtls/entropy.h"
#include "mbedtls/error.h"
#include "mbedtls/ssl.h"
#include "mbedtls/x509_crt.h"
#include "psa/crypto.h"

#ifndef MSG_NOSIGNAL
#define MSG_NOSIGNAL 0   // macOS: SO_NOSIGPIPE is set on the socket instead
#endif

namespace q::net {

void Cancel::abort() {
    stop = true;
    const int f = fd.load();
    if (f >= 0) ::shutdown(f, SHUT_RDWR);
}

namespace {

constexpr int kConnectMs = 15000;
constexpr int kIoSeconds = 30;

struct Url {
    std::string scheme, host, path;
    int port = 0;
    bool parse(const std::string& u) {
        const size_t s = u.find("://");
        if (s == std::string::npos) return false;
        scheme = u.substr(0, s);
        for (char& c : scheme) c = char(std::tolower((unsigned char)c));
        size_t h = s + 3;
        const size_t slash = u.find('/', h);
        std::string auth = u.substr(h, slash == std::string::npos ? std::string::npos : slash - h);
        path = slash == std::string::npos ? "/" : u.substr(slash);
        if (const size_t at = auth.rfind('@'); at != std::string::npos) auth = auth.substr(at + 1);
        port = scheme == "https" ? 443 : 80;
        if (const size_t c = auth.rfind(':'); c != std::string::npos && auth.find(']') == std::string::npos) {
            port = atoi(auth.c_str() + c + 1);
            auth.resize(c);
        }
        host = auth;
        return !host.empty() && (scheme == "http" || scheme == "https");
    }
};

// the certificate authorities: the system's (Android keeps one PEM file per authority), or $SSL_CERT_FILE
struct Trust {
    mbedtls_x509_crt chain;
    int count = 0;
    Trust() {
        mbedtls_x509_crt_init(&chain);
        auto add_pem = [&](const std::string& text) {
            size_t p = 0;
            for (;;) {
                const size_t b = text.find("-----BEGIN CERTIFICATE-----", p);
                if (b == std::string::npos) break;
                const size_t e = text.find("-----END CERTIFICATE-----", b);
                if (e == std::string::npos) break;
                const size_t end = e + strlen("-----END CERTIFICATE-----");
                const std::string one = text.substr(b, end - b) + "\n";
                if (mbedtls_x509_crt_parse(&chain, (const unsigned char*)one.c_str(), one.size() + 1) == 0) count++;
                p = end;
            }
        };
        auto read = [](const std::string& path, std::string& out) {
            FILE* f = fopen(path.c_str(), "rb");
            if (!f) return false;
            char buf[8192];
            for (size_t n; (n = fread(buf, 1, sizeof buf, f)) > 0;) out.append(buf, n);
            fclose(f);
            return true;
        };
        std::vector<std::string> files;
        if (const char* e = getenv("SSL_CERT_FILE")) files.push_back(e);
        for (const char* f : {"/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt",
                              "/etc/ssl/cert.pem", "/etc/ssl/ca-bundle.pem"})
            files.push_back(f);
        for (const std::string& f : files) {
            std::string t;
            if (read(f, t)) { add_pem(t); if (count) break; }
        }
        if (!count)
            for (const char* d : {"/apex/com.android.conscrypt/cacerts", "/system/etc/security/cacerts"}) {
                DIR* dir = opendir(d);
                if (!dir) continue;
                while (dirent* e = readdir(dir)) {
                    if (e->d_name[0] == '.') continue;
                    std::string t;
                    if (read(std::string(d) + "/" + e->d_name, t)) add_pem(t);
                }
                closedir(dir);
                if (count) break;
            }
        QLOG("net: %d certificate authorities", count);
    }
};

Trust& trust() {
    static Trust* t = nullptr;
    static std::once_flag once;
    std::call_once(once, [] {
        psa_crypto_init();
        t = new Trust();
    });
    return *t;
}

// one connection: a socket, and TLS over it for https
struct Conn {
    int fd = -1;
    bool tls = false;
    Cancel* cancel = nullptr;
    mbedtls_ssl_context ssl;
    mbedtls_ssl_config conf;
    mbedtls_ctr_drbg_context drbg;
    mbedtls_entropy_context entropy;
    std::string rbuf;   // read but not yet taken
    size_t rpos = 0;

    Conn() {
        mbedtls_ssl_init(&ssl);
        mbedtls_ssl_config_init(&conf);
        mbedtls_ctr_drbg_init(&drbg);
        mbedtls_entropy_init(&entropy);
    }
    ~Conn() {
        if (tls) mbedtls_ssl_close_notify(&ssl);
        mbedtls_ssl_free(&ssl);
        mbedtls_ssl_config_free(&conf);
        mbedtls_ctr_drbg_free(&drbg);
        mbedtls_entropy_free(&entropy);
        if (cancel) cancel->fd = -1;
        if (fd >= 0) ::close(fd);
    }

    bool open(const std::string& host, int port, std::string& err) {
        addrinfo hints{}, *res = nullptr;
        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        const std::string ps = std::to_string(port);
        if (getaddrinfo(host.c_str(), ps.c_str(), &hints, &res) != 0 || !res) { err = "cannot find " + host; return false; }
        for (addrinfo* a = res; a && fd < 0; a = a->ai_next) {
            int s = ::socket(a->ai_family, a->ai_socktype, a->ai_protocol);
            if (s < 0) continue;
            if (cancel) cancel->fd = s;
            if (cancel && cancel->stop) { ::close(s); break; }
            // connect with a deadline, then block with timeouts on every read and write
            fcntl(s, F_SETFL, fcntl(s, F_GETFL) | O_NONBLOCK);
            int r = ::connect(s, a->ai_addr, a->ai_addrlen);
            if (r < 0 && errno == EINPROGRESS) {
                pollfd p{s, POLLOUT, 0};
                int soerr = 0;
                socklen_t sl = sizeof soerr;
                r = (::poll(&p, 1, kConnectMs) == 1 && getsockopt(s, SOL_SOCKET, SO_ERROR, &soerr, &sl) == 0 && !soerr) ? 0 : -1;
            }
            if (r != 0) { ::close(s); if (cancel) cancel->fd = -1; continue; }
            fcntl(s, F_SETFL, fcntl(s, F_GETFL) & ~O_NONBLOCK);
            timeval tv{kIoSeconds, 0};
            setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
            setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);
#ifdef SO_NOSIGPIPE
            int one = 1;
            setsockopt(s, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);
#endif
            fd = s;
        }
        freeaddrinfo(res);
        if (fd < 0) err = "cannot connect to " + host;
        return fd >= 0;
    }

    static int bio_send(void* c, const unsigned char* b, size_t n) {
        const ssize_t r = ::send(static_cast<Conn*>(c)->fd, b, n, MSG_NOSIGNAL);
        return r >= 0 ? int(r) : MBEDTLS_ERR_SSL_INTERNAL_ERROR;
    }
    static int bio_recv(void* c, unsigned char* b, size_t n) {
        const ssize_t r = ::recv(static_cast<Conn*>(c)->fd, b, n, 0);
        return r >= 0 ? int(r) : MBEDTLS_ERR_SSL_INTERNAL_ERROR;
    }

    bool start_tls(const std::string& host, std::string& err) {
        Trust& t = trust();
        if (!t.count) { err = "no certificate authorities on this system"; return false; }
        const char* pers = "qahira-radio";
        if (mbedtls_ctr_drbg_seed(&drbg, mbedtls_entropy_func, &entropy, (const unsigned char*)pers, strlen(pers)) ||
            mbedtls_ssl_config_defaults(&conf, MBEDTLS_SSL_IS_CLIENT, MBEDTLS_SSL_TRANSPORT_STREAM, MBEDTLS_SSL_PRESET_DEFAULT)) {
            err = "TLS setup failed";
            return false;
        }
        mbedtls_ssl_conf_authmode(&conf, MBEDTLS_SSL_VERIFY_REQUIRED);
        mbedtls_ssl_conf_ca_chain(&conf, &t.chain, nullptr);
        mbedtls_ssl_conf_rng(&conf, mbedtls_ctr_drbg_random, &drbg);
        if (mbedtls_ssl_setup(&ssl, &conf) || mbedtls_ssl_set_hostname(&ssl, host.c_str())) { err = "TLS setup failed"; return false; }
        mbedtls_ssl_set_bio(&ssl, this, bio_send, bio_recv, nullptr);
        tls = true;
        for (int r; (r = mbedtls_ssl_handshake(&ssl)) != 0;) {
            if (r == MBEDTLS_ERR_SSL_WANT_READ || r == MBEDTLS_ERR_SSL_WANT_WRITE) continue;
            char e[160];
            mbedtls_strerror(r, e, sizeof e);
            err = "TLS with " + host + ": " + e;
            if (const uint32_t v = mbedtls_ssl_get_verify_result(&ssl); v && v != uint32_t(-1)) err += " (certificate not trusted)";
            tls = false;
            return false;
        }
        return true;
    }

    bool write_all(const std::string& s) {
        size_t off = 0;
        while (off < s.size()) {
            int r = tls ? mbedtls_ssl_write(&ssl, (const unsigned char*)s.data() + off, s.size() - off)
                        : int(::send(fd, s.data() + off, s.size() - off, MSG_NOSIGNAL));
            if (tls && (r == MBEDTLS_ERR_SSL_WANT_READ || r == MBEDTLS_ERR_SSL_WANT_WRITE)) continue;
            if (r <= 0) return false;
            off += size_t(r);
        }
        return true;
    }

    // > 0 bytes read, 0 the end, < 0 an error
    int read_raw(char* b, size_t n) {
        if (cancel && cancel->stop) return -1;
        if (!tls) {
            const ssize_t r = ::recv(fd, b, n, 0);
            return r < 0 ? -1 : int(r);
        }
        for (;;) {
            const int r = mbedtls_ssl_read(&ssl, (unsigned char*)b, n);
            if (r == MBEDTLS_ERR_SSL_WANT_READ || r == MBEDTLS_ERR_SSL_WANT_WRITE) continue;
#ifdef MBEDTLS_ERR_SSL_RECEIVED_NEW_SESSION_TICKET
            if (r == MBEDTLS_ERR_SSL_RECEIVED_NEW_SESSION_TICKET) continue;
#endif
            if (r == MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY) return 0;
            return r < 0 ? -1 : r;
        }
    }
    int read(char* b, size_t n) {
        if (rpos < rbuf.size()) {
            const size_t k = std::min(n, rbuf.size() - rpos);
            memcpy(b, rbuf.data() + rpos, k);
            rpos += k;
            return int(k);
        }
        return read_raw(b, n);
    }
    // a line without its CRLF; false at the end
    bool line(std::string& out) {
        out.clear();
        for (;;) {
            if (rpos >= rbuf.size()) {
                char b[4096];
                const int r = read_raw(b, sizeof b);
                if (r <= 0) return false;
                rbuf.assign(b, size_t(r));
                rpos = 0;
            }
            const char c = rbuf[rpos++];
            if (c == '\n') {
                if (!out.empty() && out.back() == '\r') out.pop_back();
                return true;
            }
            out += c;
            if (out.size() > 16384) return false;
        }
    }
};

// the proxy in the environment, if any, for this host (desktops; the RP6 has none)
bool proxy_for(const Url& u, Url& proxy, std::string& auth) {
    const char* names[] = {u.scheme == "https" ? "HTTPS_PROXY" : "HTTP_PROXY", u.scheme == "https" ? "https_proxy" : "http_proxy"};
    const char* p = nullptr;
    for (const char* n : names) if ((p = getenv(n)) && *p) break;
    if (!p || !*p) return false;
    for (const char* n : {"NO_PROXY", "no_proxy"}) {
        const char* np = getenv(n);
        if (!np) continue;
        std::string list = np;
        size_t a = 0;
        while (a <= list.size()) {
            size_t b = list.find(',', a);
            if (b == std::string::npos) b = list.size();
            std::string e = list.substr(a, b - a);
            while (!e.empty() && e.front() == ' ') e.erase(0, 1);
            while (!e.empty() && e.back() == ' ') e.pop_back();
            if (!e.empty() && e[0] == '*' && e.size() > 1) e.erase(0, 1);
            if (e == "*" || e == u.host ||
                (!e.empty() && u.host.size() > e.size() && u.host.compare(u.host.size() - e.size(), e.size(), e) == 0 &&
                 (e[0] == '.' || u.host[u.host.size() - e.size() - 1] == '.')))
                return false;
            a = b + 1;
        }
    }
    std::string ps = p;
    if (ps.find("://") == std::string::npos) ps = "http://" + ps;
    const size_t s = ps.find("://") + 3, at = ps.find('@', s), slash = ps.find('/', s);
    if (at != std::string::npos && (slash == std::string::npos || at < slash)) {
        const std::string cred = ps.substr(s, at - s);
        unsigned char out[512];
        size_t n = 0;
        if (mbedtls_base64_encode(out, sizeof out, &n, (const unsigned char*)cred.data(), cred.size()) == 0)
            auth = "Proxy-Authorization: Basic " + std::string((const char*)out, n) + "\r\n";
    }
    if (!proxy.parse("http" + ps.substr(ps.find("://")))) return false;
    proxy.scheme = "http";
    return true;
}

std::string lower(std::string s) {
    for (char& c : s) c = char(std::tolower((unsigned char)c));
    return s;
}

std::string resolve(const Url& base, const std::string& loc) {
    if (loc.find("://") != std::string::npos) return loc;
    const std::string origin = base.scheme + "://" + base.host +
                               ((base.scheme == "https" && base.port == 443) || (base.scheme == "http" && base.port == 80)
                                    ? std::string() : ":" + std::to_string(base.port));
    if (loc.rfind("//", 0) == 0) return base.scheme + ":" + loc;
    if (!loc.empty() && loc[0] == '/') return origin + loc;
    const std::string dir = base.path.substr(0, base.path.find_last_of('/') + 1);
    return origin + dir + loc;
}

Result get_file(const std::string& path, const std::function<bool(const char*, size_t)>& on_data, uint64_t from,
                const std::function<void(const Result&)>& on_start) {
    Result res;
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) { res.status = 404; res.error = "no such file: " + path; return res; }
    fseek(f, 0, SEEK_END);
    const long size = ftell(f);
    res.status = from ? 206 : 200;
    res.resumed = from > 0;
    res.length = int64_t(size) - int64_t(from);
    if (from > uint64_t(size)) { fclose(f); res.status = 416; res.error = "past the end"; return res; }
    fseek(f, long(from), SEEK_SET);
    if (on_start) on_start(res);
    char buf[16384];
    for (size_t n; (n = fread(buf, 1, sizeof buf, f)) > 0;) {
        res.received += n;
        if (!on_data(buf, n)) { fclose(f); res.error = "stopped"; return res; }
    }
    fclose(f);
    res.complete = true;
    return res;
}

}  // namespace

std::string encode_path(const std::string& s) {
    static const char* hex = "0123456789ABCDEF";
    std::string out;
    for (unsigned char c : s) {
        if (std::isalnum(c) || strchr("-._~/!$&'()*+,;=:@", c)) out += char(c);
        else { out += '%'; out += hex[c >> 4]; out += hex[c & 15]; }
    }
    return out;
}

Result get(const std::string& url_in, const std::function<bool(const char*, size_t)>& on_data, uint64_t from, Cancel* cancel,
           const std::function<void(const Result&)>& on_start) {
    if (url_in.rfind("file://", 0) == 0) return get_file(url_in.substr(7), on_data, from, on_start);
    Result res;
    std::string url = url_in;
    for (int hop = 0; hop < 8; hop++) {
        if (cancel && cancel->stop) { res.error = "stopped"; return res; }
        Url u;
        if (!u.parse(url)) { res.error = "not a URL: " + url; return res; }
        Conn c;
        c.cancel = cancel;
        Url proxy;
        std::string proxy_auth;
        const bool via = proxy_for(u, proxy, proxy_auth);
        if (!c.open(via ? proxy.host : u.host, via ? proxy.port : u.port, res.error)) return res;
        if (via) {   // a tunnel through the proxy
            const std::string hp = u.host + ":" + std::to_string(u.port);
            std::string l;
            if (!c.write_all("CONNECT " + hp + " HTTP/1.1\r\nHost: " + hp + "\r\n" + proxy_auth + "\r\n") || !c.line(l) ||
                l.find(" 200") == std::string::npos) {
                res.error = "the proxy refused " + hp;
                return res;
            }
            while (c.line(l) && !l.empty()) {}
            c.rbuf.clear();   // the tunnel's own bytes start after the proxy's answer
            c.rpos = 0;
        }
        if (u.scheme == "https" && !c.start_tls(u.host, res.error)) return res;
        std::string req = "GET " + u.path + " HTTP/1.1\r\nHost: " + u.host + "\r\nUser-Agent: Qahira/1 (radio)\r\n"
                          "Accept: */*\r\nAccept-Encoding: identity\r\nConnection: close\r\n";
        if (from) req += "Range: bytes=" + std::to_string(from) + "-\r\n";
        req += "\r\n";
        if (!c.write_all(req)) { res.error = "cannot send to " + u.host; return res; }
        std::string l;
        if (!c.line(l) || l.size() < 12 || l.compare(0, 5, "HTTP/")) { res.error = "no answer from " + u.host; return res; }
        res.status = atoi(l.c_str() + l.find(' ') + 1);
        std::string location;
        bool chunked = false;
        res.length = -1;
        while (c.line(l) && !l.empty()) {
            const size_t colon = l.find(':');
            if (colon == std::string::npos) continue;
            const std::string k = lower(l.substr(0, colon));
            std::string v = l.substr(colon + 1);
            while (!v.empty() && v.front() == ' ') v.erase(0, 1);
            if (k == "location") location = v;
            else if (k == "content-length") res.length = atoll(v.c_str());
            else if (k == "transfer-encoding") chunked = lower(v).find("chunked") != std::string::npos;
        }
        if (res.status >= 300 && res.status < 400 && !location.empty()) {
            url = resolve(u, location);
            continue;
        }
        if (res.status != 200 && res.status != 206) {
            res.error = "HTTP " + std::to_string(res.status) + " from " + u.host;
            return res;
        }
        res.resumed = res.status == 206;
        if (on_start) on_start(res);
        char buf[16384];
        if (chunked) {
            for (;;) {
                if (!c.line(l)) { res.error = "cut off"; return res; }
                const uint64_t n = strtoull(l.c_str(), nullptr, 16);
                if (n == 0) { res.complete = true; return res; }
                for (uint64_t left = n; left > 0;) {
                    const int r = c.read(buf, size_t(std::min<uint64_t>(left, sizeof buf)));
                    if (r <= 0) { res.error = "cut off"; return res; }
                    left -= uint64_t(r);
                    res.received += uint64_t(r);
                    if (!on_data(buf, size_t(r))) { res.error = "stopped"; return res; }
                }
                c.line(l);   // the CRLF after the chunk
            }
        }
        for (;;) {
            if (res.length >= 0 && res.received >= uint64_t(res.length)) { res.complete = true; return res; }
            const int r = c.read(buf, sizeof buf);
            if (r == 0) { res.complete = res.length < 0; if (!res.complete) res.error = "cut off"; return res; }
            if (r < 0) { res.error = cancel && cancel->stop ? "stopped" : "cut off"; return res; }
            res.received += uint64_t(r);
            if (!on_data(buf, size_t(r))) { res.error = "stopped"; return res; }
        }
    }
    res.error = "too many redirects";
    return res;
}

bool get_text(const std::string& url, std::string& out, Cancel* cancel, std::string* err, size_t max) {
    out.clear();
    Result r = get(url, [&](const char* b, size_t n) {
        if (out.size() + n > max) return false;
        out.append(b, n);
        return true;
    }, 0, cancel);
    if (!r.ok() && err) *err = r.error;
    return r.ok();
}

}  // namespace q::net
