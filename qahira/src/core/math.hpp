// Minimal linear algebra for the engine. Z is up, the ground is XY, the camera looks down.
#pragma once
#include <cmath>
#include <cstdint>
#include <algorithm>

namespace q {

constexpr float kPi = 3.14159265358979f;
constexpr float kTau = 6.28318530717959f;
inline float radians(float d) { return d * (kPi / 180.f); }
inline float clampf(float v, float a, float b) { return v < a ? a : (v > b ? b : v); }
inline float saturate(float v) { return clampf(v, 0.f, 1.f); }
inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
inline float smoothstep(float a, float b, float x) { float t = saturate((x - a) / (b - a)); return t * t * (3 - 2 * t); }
inline float sign(float v) { return v < 0 ? -1.f : 1.f; }
// frame-rate independent exponential approach
inline float damp(float cur, float target, float rate, float dt) { return lerpf(cur, target, 1.f - std::exp(-rate * dt)); }

struct vec2 {
    float x = 0, y = 0;
    vec2() = default;
    constexpr vec2(float x_, float y_) : x(x_), y(y_) {}
    vec2 operator+(vec2 b) const { return {x + b.x, y + b.y}; }
    vec2 operator-(vec2 b) const { return {x - b.x, y - b.y}; }
    vec2 operator*(float s) const { return {x * s, y * s}; }
    vec2 operator/(float s) const { return {x / s, y / s}; }
    vec2 operator-() const { return {-x, -y}; }
    vec2& operator+=(vec2 b) { x += b.x; y += b.y; return *this; }
    vec2& operator-=(vec2 b) { x -= b.x; y -= b.y; return *this; }
    vec2& operator*=(float s) { x *= s; y *= s; return *this; }
};
inline float dot(vec2 a, vec2 b) { return a.x * b.x + a.y * b.y; }
inline float cross(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
inline float length(vec2 a) { return std::sqrt(dot(a, a)); }
inline float length2(vec2 a) { return dot(a, a); }
inline vec2 normalize(vec2 a) { float l = length(a); return l > 1e-8f ? a / l : vec2{0, 0}; }
inline vec2 perp(vec2 a) { return {-a.y, a.x}; }
inline vec2 rotate(vec2 a, float ang) { float c = std::cos(ang), s = std::sin(ang); return {a.x * c - a.y * s, a.x * s + a.y * c}; }
inline vec2 lerp(vec2 a, vec2 b, float t) { return a + (b - a) * t; }
inline float angle_of(vec2 a) { return std::atan2(a.y, a.x); }
inline vec2 from_angle(float a) { return {std::cos(a), std::sin(a)}; }
inline float wrap_angle(float a) { while (a > kPi) a -= kTau; while (a < -kPi) a += kTau; return a; }

struct vec3 {
    float x = 0, y = 0, z = 0;
    vec3() = default;
    constexpr vec3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}
    constexpr vec3(vec2 v, float z_) : x(v.x), y(v.y), z(z_) {}
    vec3 operator+(vec3 b) const { return {x + b.x, y + b.y, z + b.z}; }
    vec3 operator-(vec3 b) const { return {x - b.x, y - b.y, z - b.z}; }
    vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
    vec3 operator*(vec3 b) const { return {x * b.x, y * b.y, z * b.z}; }
    vec3 operator/(float s) const { return {x / s, y / s, z / s}; }
    vec3 operator-() const { return {-x, -y, -z}; }
    vec3& operator+=(vec3 b) { x += b.x; y += b.y; z += b.z; return *this; }
    vec3& operator-=(vec3 b) { x -= b.x; y -= b.y; z -= b.z; return *this; }
    vec3& operator*=(float s) { x *= s; y *= s; z *= s; return *this; }
    vec2 xy() const { return {x, y}; }
    float operator[](int i) const { return (&x)[i]; }
    float& operator[](int i) { return (&x)[i]; }
};
inline float dot(vec3 a, vec3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline vec3 cross(vec3 a, vec3 b) { return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x}; }
inline float length(vec3 a) { return std::sqrt(dot(a, a)); }
inline vec3 normalize(vec3 a) { float l = length(a); return l > 1e-8f ? a / l : vec3{0, 0, 0}; }
inline vec3 lerp(vec3 a, vec3 b, float t) { return a + (b - a) * t; }
inline vec3 minv(vec3 a, vec3 b) { return {std::min(a.x, b.x), std::min(a.y, b.y), std::min(a.z, b.z)}; }
inline vec3 maxv(vec3 a, vec3 b) { return {std::max(a.x, b.x), std::max(a.y, b.y), std::max(a.z, b.z)}; }

struct vec4 {
    float x = 0, y = 0, z = 0, w = 0;
    vec4() = default;
    constexpr vec4(float x_, float y_, float z_, float w_) : x(x_), y(y_), z(z_), w(w_) {}
    constexpr vec4(vec3 v, float w_) : x(v.x), y(v.y), z(v.z), w(w_) {}
    vec3 xyz() const { return {x, y, z}; }
    vec4 operator*(float s) const { return {x * s, y * s, z * s, w * s}; }
    vec4 operator+(vec4 b) const { return {x + b.x, y + b.y, z + b.z, w + b.w}; }
};

// colour helpers (linear space)
inline vec3 srgb_to_linear(vec3 c) {
    auto f = [](float x) { return x <= 0.04045f ? x / 12.92f : std::pow((x + 0.055f) / 1.055f, 2.4f); };
    return {f(c.x), f(c.y), f(c.z)};
}
inline vec3 hex_rgb(uint32_t hex) { return {((hex >> 16) & 255) / 255.f, ((hex >> 8) & 255) / 255.f, (hex & 255) / 255.f}; }
inline vec3 hex_lin(uint32_t hex) { return srgb_to_linear(hex_rgb(hex)); }

struct quat {
    float x = 0, y = 0, z = 0, w = 1;
    quat() = default;
    constexpr quat(float x_, float y_, float z_, float w_) : x(x_), y(y_), z(z_), w(w_) {}
    static quat axis_angle(vec3 axis, float ang) {
        vec3 a = normalize(axis);
        float s = std::sin(ang * .5f);
        return {a.x * s, a.y * s, a.z * s, std::cos(ang * .5f)};
    }
    quat operator*(quat b) const {
        return {w * b.x + x * b.w + y * b.z - z * b.y, w * b.y - x * b.z + y * b.w + z * b.x,
                w * b.z + x * b.y - y * b.x + z * b.w, w * b.w - x * b.x - y * b.y - z * b.z};
    }
    vec3 rotate(vec3 v) const {
        vec3 u{x, y, z};
        vec3 t = cross(u, v) * 2.f;
        return v + t * w + cross(u, t);
    }
    quat conj() const { return {-x, -y, -z, w}; }
};
inline float dot(quat a, quat b) { return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w; }
inline quat normalize(quat q) {
    float l = std::sqrt(dot(q, q));
    return l > 1e-8f ? quat{q.x / l, q.y / l, q.z / l, q.w / l} : quat{};
}
inline quat nlerp(quat a, quat b, float t) {
    if (dot(a, b) < 0) b = {-b.x, -b.y, -b.z, -b.w};
    return normalize(quat{lerpf(a.x, b.x, t), lerpf(a.y, b.y, t), lerpf(a.z, b.z, t), lerpf(a.w, b.w, t)});
}

// Column-major 4x4, m[col*4+row], matching GL uniform layout.
struct mat4 {
    float m[16];
    mat4() { for (int i = 0; i < 16; i++) m[i] = (i % 5 == 0) ? 1.f : 0.f; }
    float& operator()(int r, int c) { return m[c * 4 + r]; }
    float operator()(int r, int c) const { return m[c * 4 + r]; }
    mat4 operator*(const mat4& b) const {
        mat4 o;
        for (int c = 0; c < 4; c++)
            for (int r = 0; r < 4; r++) {
                float s = 0;
                for (int k = 0; k < 4; k++) s += (*this)(r, k) * b(k, c);
                o(r, c) = s;
            }
        return o;
    }
    vec4 operator*(vec4 v) const {
        return {m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12] * v.w, m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13] * v.w,
                m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14] * v.w, m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15] * v.w};
    }
    vec3 point(vec3 p) const { return (*this * vec4(p, 1)).xyz(); }
    vec3 dir(vec3 d) const { return (*this * vec4(d, 0)).xyz(); }
    vec3 translation() const { return {m[12], m[13], m[14]}; }

    static mat4 translate(vec3 t) { mat4 o; o.m[12] = t.x; o.m[13] = t.y; o.m[14] = t.z; return o; }
    static mat4 scale(vec3 s) { mat4 o; o.m[0] = s.x; o.m[5] = s.y; o.m[10] = s.z; return o; }
    static mat4 rotate(quat q) {
        mat4 o;
        float xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z, xy = q.x * q.y, xz = q.x * q.z, yz = q.y * q.z;
        float wx = q.w * q.x, wy = q.w * q.y, wz = q.w * q.z;
        o(0, 0) = 1 - 2 * (yy + zz); o(0, 1) = 2 * (xy - wz); o(0, 2) = 2 * (xz + wy);
        o(1, 0) = 2 * (xy + wz); o(1, 1) = 1 - 2 * (xx + zz); o(1, 2) = 2 * (yz - wx);
        o(2, 0) = 2 * (xz - wy); o(2, 1) = 2 * (yz + wx); o(2, 2) = 1 - 2 * (xx + yy);
        return o;
    }
    static mat4 trs(vec3 t, quat r, vec3 s) {
        mat4 o = rotate(r);
        for (int c = 0; c < 3; c++) for (int rr = 0; rr < 3; rr++) o(rr, c) *= (&s.x)[c];
        o.m[12] = t.x; o.m[13] = t.y; o.m[14] = t.z;
        return o;
    }
    static mat4 rot_z(float a) { return rotate(quat::axis_angle({0, 0, 1}, a)); }
    static mat4 perspective(float fovy, float aspect, float n, float f) {
        mat4 o;
        float t = 1.f / std::tan(fovy * .5f);
        for (float& v : o.m) v = 0;
        o(0, 0) = t / aspect; o(1, 1) = t; o(2, 2) = (f + n) / (n - f); o(2, 3) = 2 * f * n / (n - f); o(3, 2) = -1;
        return o;
    }
    static mat4 ortho(float l, float r, float b, float t, float n, float f) {
        mat4 o;
        o(0, 0) = 2 / (r - l); o(1, 1) = 2 / (t - b); o(2, 2) = -2 / (f - n);
        o(0, 3) = -(r + l) / (r - l); o(1, 3) = -(t + b) / (t - b); o(2, 3) = -(f + n) / (f - n);
        return o;
    }
    static mat4 look_at(vec3 eye, vec3 target, vec3 up) {
        vec3 f = normalize(target - eye), s = normalize(cross(f, up)), u = cross(s, f);
        mat4 o;
        o(0, 0) = s.x; o(0, 1) = s.y; o(0, 2) = s.z;
        o(1, 0) = u.x; o(1, 1) = u.y; o(1, 2) = u.z;
        o(2, 0) = -f.x; o(2, 1) = -f.y; o(2, 2) = -f.z;
        o(0, 3) = -dot(s, eye); o(1, 3) = -dot(u, eye); o(2, 3) = dot(f, eye);
        return o;
    }
};

mat4 inverse(const mat4& a);

// Rigid transform used by the animation system.
struct Xform {
    vec3 t{0, 0, 0};
    quat r{};
    vec3 s{1, 1, 1};
    mat4 matrix() const { return mat4::trs(t, r, s); }
};
inline Xform blend(const Xform& a, const Xform& b, float w) { return {lerp(a.t, b.t, w), nlerp(a.r, b.r, w), lerp(a.s, b.s, w)}; }

// Small deterministic RNG (xoshiro128**), seeded per system so replays and save states are exact.
struct Rng {
    uint32_t s[4];
    explicit Rng(uint64_t seed = 1) { reseed(seed); }
    void reseed(uint64_t seed) {
        uint64_t z = seed + 0x9E3779B97F4A7C15ull;
        for (int i = 0; i < 4; i++) {
            z += 0x9E3779B97F4A7C15ull;
            uint64_t x = z;
            x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9ull;
            x = (x ^ (x >> 27)) * 0x94D049BB133111EBull;
            s[i] = uint32_t(x ^ (x >> 31));
        }
    }
    static uint32_t rotl(uint32_t x, int k) { return (x << k) | (x >> (32 - k)); }
    uint32_t next() {
        uint32_t r = rotl(s[1] * 5, 7) * 9, t = s[1] << 9;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
        return r;
    }
    float uniform() { return (next() >> 8) * (1.f / 16777216.f); }
    float range(float a, float b) { return a + (b - a) * uniform(); }
    int irange(int a, int b) { return a + int(next() % uint32_t(b - a + 1)); }  // inclusive
    bool chance(float p) { return uniform() < p; }
};

inline uint32_t hash32(uint32_t x) {
    x ^= x >> 16; x *= 0x7feb352d; x ^= x >> 15; x *= 0x846ca68b; x ^= x >> 16;
    return x;
}
inline uint32_t hash_str(const char* s) {
    uint32_t h = 2166136261u;
    while (*s) { h ^= uint8_t(*s++); h *= 16777619u; }
    return h;
}

}  // namespace q
