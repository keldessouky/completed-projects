// Thin wrappers over GL objects.
#pragma once
#include "gfx/gl.hpp"
#include "core/math.hpp"
#include <string>
#include <unordered_map>
#include <vector>

namespace q {

struct Shader {
    GLuint prog = 0;
    std::unordered_map<std::string, GLint> locs;
    bool build(const char* name, const std::string& vs, const std::string& fs);
    GLint loc(const char* n);
    void use() const { glUseProgram(prog); }
    void set(const char* n, float v) { glUniform1f(loc(n), v); }
    void set(const char* n, int v) { glUniform1i(loc(n), v); }
    void set(const char* n, vec2 v) { glUniform2f(loc(n), v.x, v.y); }
    void set(const char* n, vec3 v) { glUniform3f(loc(n), v.x, v.y, v.z); }
    void set(const char* n, vec4 v) { glUniform4f(loc(n), v.x, v.y, v.z, v.w); }
    void set(const char* n, const mat4& m) { glUniformMatrix4fv(loc(n), 1, GL_FALSE, m.m); }
    void bind_block(const char* block, GLuint binding);
    void destroy();
};

struct Texture {
    GLuint id = 0;
    int w = 0, h = 0;
    GLenum ifmt = 0;
    void create(int w, int h, GLenum ifmt, GLenum fmt, GLenum type, const void* data, bool linear, bool clamp = true);
    void destroy();
};

struct RenderTarget {
    GLuint fbo = 0;
    Texture color;
    GLuint depth = 0;
    int w = 0, h = 0;
    bool create(int w, int h, GLenum ifmt, bool with_depth);
    void destroy();
};

std::string shader_prelude();  // "#version ..." + precision, per platform
void gl_check(const char* where);

}  // namespace q
