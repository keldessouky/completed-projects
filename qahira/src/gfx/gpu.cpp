#include "gfx/gpu.hpp"
#include "core/log.hpp"

namespace q {

std::string shader_prelude() {
#if QGL_ES
    return "#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\nprecision highp usampler2D;\n";
#else
    return "#version 330 core\n";
#endif
}

static GLuint compile(GLenum type, const std::string& src, const char* name) {
    GLuint s = glCreateShader(type);
    const char* c = src.c_str();
    glShaderSource(s, 1, &c, nullptr);
    glCompileShader(s);
    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetShaderInfoLog(s, sizeof log, nullptr, log);
        QERR("shader %s (%s) failed:\n%s", name, type == GL_VERTEX_SHADER ? "vs" : "fs", log);
        glDeleteShader(s);
        return 0;
    }
    return s;
}

bool Shader::build(const char* name, const std::string& vs, const std::string& fs) {
    std::string pre = shader_prelude();
    GLuint v = compile(GL_VERTEX_SHADER, pre + vs, name);
    GLuint f = compile(GL_FRAGMENT_SHADER, pre + fs, name);
    if (!v || !f) return false;
    prog = glCreateProgram();
    glAttachShader(prog, v);
    glAttachShader(prog, f);
    glLinkProgram(prog);
    glDeleteShader(v);
    glDeleteShader(f);
    GLint ok = 0;
    glGetProgramiv(prog, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetProgramInfoLog(prog, sizeof log, nullptr, log);
        QERR("link %s failed:\n%s", name, log);
        return false;
    }
    return true;
}

GLint Shader::loc(const char* n) {
    auto it = locs.find(n);
    if (it != locs.end()) return it->second;
    GLint l = glGetUniformLocation(prog, n);
    locs[n] = l;
    return l;
}

void Shader::bind_block(const char* block, GLuint binding) {
    GLuint idx = glGetUniformBlockIndex(prog, block);
    if (idx != GL_INVALID_INDEX) glUniformBlockBinding(prog, idx, binding);
}

void Shader::destroy() { if (prog) glDeleteProgram(prog); prog = 0; locs.clear(); }

void Texture::create(int w_, int h_, GLenum ifmt_, GLenum fmt, GLenum type, const void* data, bool linear, bool clamp) {
    w = w_; h = h_; ifmt = ifmt_;
    if (!id) glGenTextures(1, &id);
    glBindTexture(GL_TEXTURE_2D, id);
    glTexImage2D(GL_TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    GLenum filt = linear ? GL_LINEAR : GL_NEAREST;
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filt);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filt);
    GLenum wrap = clamp ? GL_CLAMP_TO_EDGE : GL_REPEAT;
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrap);
}

void Texture::destroy() { if (id) glDeleteTextures(1, &id); id = 0; }

bool RenderTarget::create(int w_, int h_, GLenum ifmt, bool with_depth) {
    w = w_; h = h_;
    GLenum fmt = GL_RGBA, type = GL_UNSIGNED_BYTE;
    if (ifmt == GL_RGBA16F) type = GL_HALF_FLOAT;
    color.create(w, h, ifmt, fmt, type, nullptr, true);
    glGenFramebuffers(1, &fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, color.id, 0);
    if (with_depth) {
        glGenRenderbuffers(1, &depth);
        glBindRenderbuffer(GL_RENDERBUFFER, depth);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, w, h);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, depth);
    }
    GLenum st = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    if (st != GL_FRAMEBUFFER_COMPLETE) { QERR("framebuffer incomplete 0x%x (%dx%d)", st, w, h); return false; }
    return true;
}

void RenderTarget::destroy() {
    color.destroy();
    if (depth) glDeleteRenderbuffers(1, &depth);
    if (fbo) glDeleteFramebuffers(1, &fbo);
    depth = fbo = 0;
}

void gl_check(const char* where) {
    GLenum e = glGetError();
    if (e != GL_NO_ERROR) QERR("GL error 0x%x at %s", e, where);
}

}  // namespace q
