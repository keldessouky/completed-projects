// GLSL sources. Written in the common subset of GLSL ES 3.00 and GLSL 3.30 core; the prelude
// (gpu.cpp) supplies the #version line and precision qualifiers per platform.
#include "gfx/shaders.hpp"

namespace q::shaders {

const char* frame_block = R"(
layout(std140) uniform Frame {
    mat4 uViewProj;
    mat4 uView;
    vec4 uCamPos;       // xyz, w = time
    vec4 uSunDir;       // towards the light
    vec4 uSunColor;
    vec4 uSky;          // hemisphere ambient, from above
    vec4 uGround;       // hemisphere ambient, from below
    vec4 uFogColor;
    vec4 uFogParams;    // start, end, max, height falloff
    vec4 uTileInfo;     // tilesX, tilesY, tile px w, tile px h
    vec4 uLightPos[64]; // xyz, w = radius
    vec4 uLightCol[64]; // rgb * intensity
};
)";

const char* mesh_vs = R"(
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
layout(location=3) in vec4 aMat;
layout(location=4) in uvec4 aBones;
layout(location=5) in vec4 aWeights;
layout(location=8) in vec4 iM0;
layout(location=9) in vec4 iM1;
layout(location=10) in vec4 iM2;
layout(location=11) in vec4 iM3;
layout(location=12) in vec4 iTint;
layout(location=13) in vec4 iExtra;   // x palette texel offset (-1 = rigid), y emissive boost, z hit flash, w dissolve
layout(location=14) in vec4 iRim;
uniform sampler2D uBones;
uniform int uSkinned;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vColor;
out vec4 vMat;
out vec4 vTint;
out vec4 vExtra;
out vec4 vRim;
mat4 boneMat(int idx) {
    int w = 1024;
    int t = int(iExtra.x) + idx * 3;
    vec4 r0 = texelFetch(uBones, ivec2(t % w, t / w), 0);
    vec4 r1 = texelFetch(uBones, ivec2((t + 1) % w, (t + 1) / w), 0);
    vec4 r2 = texelFetch(uBones, ivec2((t + 2) % w, (t + 2) / w), 0);
    return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
void main() {
    mat4 model = mat4(iM0, iM1, iM2, iM3);
    vec4 p = vec4(aPos, 1.0);
    vec3 n = aNormal;
    if (uSkinned == 1 && iExtra.x >= 0.0) {
        mat4 s = boneMat(int(aBones.x)) * aWeights.x + boneMat(int(aBones.y)) * aWeights.y
               + boneMat(int(aBones.z)) * aWeights.z + boneMat(int(aBones.w)) * aWeights.w;
        p = s * p;
        n = mat3(s) * n;
    }
    vec4 w = model * p;
    vWorld = w.xyz;
    vNormal = mat3(model) * n;
    vColor = aColor;
    vMat = aMat;
    vTint = iTint;
    vExtra = iExtra;
    vRim = iRim;
    gl_Position = uViewProj * w;
}
)";

const char* mesh_fs = R"(
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
in vec4 vMat;
in vec4 vTint;
in vec4 vExtra;
in vec4 vRim;
uniform highp usampler2D uTiles;
out vec4 oColor;
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 shade(vec3 L, vec3 radiance, vec3 N, vec3 V, vec3 albedo, float rough, float metal) {
    float nl = max(dot(N, L), 0.0);
    if (nl <= 0.0) return vec3(0.0);
    vec3 H = normalize(L + V);
    float a = max(rough * rough, 0.02);
    float a2 = a * a;
    float nh = max(dot(N, H), 0.0);
    float d = nh * nh * (a2 - 1.0) + 1.0;
    float D = a2 / (3.14159 * d * d);
    vec3 F0 = mix(vec3(0.04), albedo, metal);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    float k = a * 0.5;
    float G = 1.0 / ((nl * (1.0 - k) + k) * (max(dot(N, V), 0.0) * (1.0 - k) + k));
    vec3 spec = D * F * G * 0.25;
    vec3 diff = albedo * (1.0 - metal) / 3.14159;
    return (diff + spec) * radiance * nl;
}
void main() {
    if (vExtra.w > 0.0) {
        float n = vnoise(vWorld * 18.0);
        if (n < vExtra.w) discard;
    }
    vec3 albedo = toLinear(vColor.rgb) * vTint.rgb;
    float ao = vColor.a;
    float rough = clamp(vMat.r, 0.05, 1.0);
    float metal = vMat.g;
    // gentle material breakup so large surfaces don't read as plastic
    float grain = vnoise(vWorld * 7.0) * 0.5 + vnoise(vWorld * 23.0) * 0.5;
    albedo *= 0.88 + 0.24 * grain;
    rough = clamp(rough + (grain - 0.5) * 0.15, 0.05, 1.0);
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCamPos.xyz - vWorld);
    vec3 col = vec3(0.0);
    // hemisphere ambient, with a metal-friendly sky reflection term
    vec3 amb = mix(uGround.rgb, uSky.rgb, N.z * 0.5 + 0.5);
    col += amb * albedo * (1.0 - metal * 0.7) * ao;
    col += amb * mix(vec3(0.04), albedo, metal) * metal * 1.2 * ao;
    col += shade(normalize(uSunDir.xyz), uSunColor.rgb, N, V, albedo, rough, metal) * mix(0.6, 1.0, ao);
    // point lights from this pixel's screen tile
    ivec2 tile = ivec2(gl_FragCoord.xy / uTileInfo.zw);
    tile = clamp(tile, ivec2(0), ivec2(uTileInfo.xy) - 1);
    int ti = tile.y * int(uTileInfo.x) + tile.x;
    int count = int(texelFetch(uTiles, ivec2(0, ti), 0).r);
    for (int i = 0; i < count; i++) {
        int li = int(texelFetch(uTiles, ivec2(i + 1, ti), 0).r);
        vec3 d = uLightPos[li].xyz - vWorld;
        float dist = length(d);
        float r = uLightPos[li].w;
        if (dist >= r) continue;
        float att = pow(clamp(1.0 - dist / r, 0.0, 1.0), 2.0) / (1.0 + dist * dist * 0.35);
        col += shade(d / max(dist, 1e-4), uLightCol[li].rgb * att, N, V, albedo, rough, metal) * mix(0.75, 1.0, ao);
    }
    // rim light: amber on the player, magenta on enemies
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vRim.rgb * rim * vRim.a;
    // emissive and hit flash
    col += albedo * vMat.b * 18.0 * (1.0 + vExtra.y);
    col += vec3(1.0, 0.9, 0.8) * vExtra.z;
    // fog
    float dist = length(uCamPos.xyz - vWorld);
    float f = clamp((dist - uFogParams.x) / (uFogParams.y - uFogParams.x), 0.0, 1.0) * uFogParams.z;
    col = mix(col, uFogColor.rgb, f);
    oColor = vec4(col, vTint.a);
}
)";

// ---- post
const char* fullscreen_vs = R"(
out vec2 vUV;
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUV = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
)";

const char* bloom_down_fs = R"(
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;   // > 0 only for the first pass
out vec4 oColor;
void main() {
    vec2 t = uTexel;
    vec3 a = texture(uSrc, vUV + t * vec2(-2, -2)).rgb, b = texture(uSrc, vUV + t * vec2(0, -2)).rgb, c = texture(uSrc, vUV + t * vec2(2, -2)).rgb;
    vec3 d = texture(uSrc, vUV + t * vec2(-2, 0)).rgb, e = texture(uSrc, vUV).rgb, f = texture(uSrc, vUV + t * vec2(2, 0)).rgb;
    vec3 g = texture(uSrc, vUV + t * vec2(-2, 2)).rgb, h = texture(uSrc, vUV + t * vec2(0, 2)).rgb, i = texture(uSrc, vUV + t * vec2(2, 2)).rgb;
    vec3 j = texture(uSrc, vUV + t * vec2(-1, -1)).rgb, k = texture(uSrc, vUV + t * vec2(1, -1)).rgb;
    vec3 l = texture(uSrc, vUV + t * vec2(-1, 1)).rgb, m = texture(uSrc, vUV + t * vec2(1, 1)).rgb;
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    if (uThreshold > 0.0) {
        float br = max(col.r, max(col.g, col.b));
        float soft = clamp(br - uThreshold * 0.5, 0.0, uThreshold);
        soft = soft * soft / (4.0 * uThreshold + 1e-4);
        float w = max(soft, br - uThreshold) / max(br, 1e-4);
        col *= w;
        col = min(col, vec3(64.0));
    }
    oColor = vec4(col, 1.0);
}
)";

const char* bloom_up_fs = R"(
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 oColor;
void main() {
    vec2 t = uTexel;
    vec3 c = texture(uSrc, vUV + t * vec2(-1, -1)).rgb + texture(uSrc, vUV + t * vec2(0, -1)).rgb * 2.0 + texture(uSrc, vUV + t * vec2(1, -1)).rgb
           + texture(uSrc, vUV + t * vec2(-1, 0)).rgb * 2.0 + texture(uSrc, vUV).rgb * 4.0 + texture(uSrc, vUV + t * vec2(1, 0)).rgb * 2.0
           + texture(uSrc, vUV + t * vec2(-1, 1)).rgb + texture(uSrc, vUV + t * vec2(0, 1)).rgb * 2.0 + texture(uSrc, vUV + t * vec2(1, 1)).rgb;
    oColor = vec4(c / 16.0, 1.0);
}
)";

const char* composite_fs = R"(
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uVignette;
uniform float uFlipY;
out vec4 oColor;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
    vec2 uv = vec2(vUV.x, mix(vUV.y, 1.0 - vUV.y, uFlipY));
    vec3 c = texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomStrength;
    c *= uExposure;
    c = aces(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSaturation);
    c = c * uGain + uLift * (1.0 - c);
    vec2 d = uv - 0.5;
    c *= 1.0 - uVignette * dot(d, d) * 1.6;
    c = pow(max(c, 0.0), vec3(1.0 / 2.2));
    c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
    oColor = vec4(c, 1.0);
}
)";

// ---- decals / sprites / particles in the world (unlit or additive)
const char* sprite_vs = R"(
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aColor;
layout(location=3) in vec4 aParams;
out vec2 vUV;
out vec4 vColor;
out vec4 vParams;
out vec3 vWorld;
void main() {
    vUV = aUV;
    vColor = aColor;
    vParams = aParams;
    vWorld = aPos;
    gl_Position = uViewProj * vec4(aPos, 1.0);
}
)";

const char* sprite_fs = R"(
in vec2 vUV;
in vec4 vColor;
in vec4 vParams;   // x = shape (0 soft disc, 1 ring, 2 hard disc, 3 square glow, 4 sector), y/z shape params, w = intensity
in vec3 vWorld;
out vec4 oColor;
void main() {
    vec2 p = vUV * 2.0 - 1.0;
    float r = length(p);
    float a = 0.0;
    int shape = int(vParams.x + 0.5);
    if (shape == 0) a = pow(clamp(1.0 - r, 0.0, 1.0), max(vParams.y, 0.01));
    else if (shape == 1) { float w = max(vParams.y, 0.01); a = clamp(1.0 - abs(r - (1.0 - w)) / w, 0.0, 1.0); a *= a; }
    else if (shape == 2) a = smoothstep(1.0, 1.0 - max(vParams.y, 0.02), r);
    else if (shape == 3) { vec2 q = abs(p); a = pow(clamp(1.0 - max(q.x, q.y), 0.0, 1.0), max(vParams.y, 0.01)); }
    else if (shape == 4) {
        float ang = atan(p.x, -p.y);
        float half_ = vParams.y;
        float edge = smoothstep(half_, half_ - 0.05, abs(ang));
        a = edge * smoothstep(1.0, 0.96, r) * (0.35 + 0.65 * smoothstep(0.0, 1.0, r));
    } else if (shape == 5) {
        // radial cracks: jagged rays from the centre, seeded by params.y
        float ang = atan(p.y, p.x);
        float best = 1.0;
        for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float ra = fract(sin(fi * 12.9898 + vParams.y * 78.233) * 43758.5453) * 6.2831;
            float wob = sin(r * 17.0 + fi * 3.1 + vParams.y) * 0.18 * r;
            float d = abs(mod(ang - ra - wob + 3.14159, 6.28318) - 3.14159) * r;
            float len = 0.55 + 0.45 * fract(sin(fi * 4.1 + vParams.y) * 9123.1);
            d += smoothstep(len - 0.1, len, r);
            best = min(best, d);
        }
        a = smoothstep(0.06, 0.0, best) * smoothstep(1.0, 0.85, r);
        a = max(a, smoothstep(0.35, 0.0, r) * 0.6);
    } else if (shape == 6) {
        // vertical loot beam: bright core fading upward
        a = pow(clamp(1.0 - abs(vUV.x * 2.0 - 1.0), 0.0, 1.0), 3.0) * pow(1.0 - vUV.y, 1.5);
    }
    oColor = vec4(vColor.rgb * vParams.w, vColor.a * a);
}
)";

// ---- UI (output resolution, sRGB space)
const char* ui_vs = R"(
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aColor;
layout(location=3) in vec4 aParams;
uniform vec2 uScreen;
uniform float uFlipY;
out vec2 vUV;
out vec4 vColor;
out vec4 vParams;
out vec2 vPos;
void main() {
    vUV = aUV;
    vColor = aColor;
    vParams = aParams;
    vPos = aPos;
    vec2 ndc = aPos / uScreen * 2.0 - 1.0;
    ndc.y = -ndc.y;
    ndc.y = mix(ndc.y, -ndc.y, uFlipY);
    gl_Position = vec4(ndc, 0.0, 1.0);
}
)";

const char* ui_fs = R"(
in vec2 vUV;
in vec4 vColor;
in vec4 vParams;   // x = mode: 0 textured/solid, 1 SDF text, 2 rounded rect (uv = local px, y/z half size, w radius), 3 ring
in vec2 vPos;
uniform sampler2D uTex;
uniform float uPxRange;
out vec4 oColor;
void main() {
    int mode = int(vParams.x + 0.5);
    vec4 c = vColor;
    if (mode == 0) {
        c.a *= texture(uTex, vUV).r;
    } else if (mode == 1) {
        float d = texture(uTex, vUV).r;
        float w = fwidth(d) * 0.75;
        float edge = vParams.y;              // 0.5 regular, lower = bolder
        float a = smoothstep(edge - w, edge + w, d);
        float outline = vParams.z;           // outline width in sdf units
        if (outline > 0.0) {
            float ao = smoothstep(edge - outline - w, edge - outline + w, d);
            c = vec4(mix(vec3(0.02, 0.015, 0.03), c.rgb, a), c.a * ao);
        } else {
            c.a *= a;
        }
    } else if (mode == 2) {
        vec2 hs = vParams.yz;
        float r = vParams.w;
        vec2 q = abs(vUV) - hs + r;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        c.a *= clamp(0.5 - d, 0.0, 1.0);
    } else if (mode == 3) {
        float r = length(vUV);
        float outer = vParams.y, inner = vParams.z;
        c.a *= clamp(outer - r + 0.5, 0.0, 1.0) * clamp(r - inner + 0.5, 0.0, 1.0);
    }
    oColor = c;
}
)";

}  // namespace q::shaders
