// GL entry points. Android: GLES 3.2 from libGLESv3 (RetroArch owns the EGL context).
// macOS: GL 4.1 core (dev host and RetroArch for Mac). The subset we use is common to both.
#pragma once
#if defined(__ANDROID__)
#include <GLES3/gl32.h>
#define QGL_ES 1
#elif defined(__APPLE__)
#define GL_SILENCE_DEPRECATION
#include <OpenGL/gl3.h>
#define QGL_ES 0
#else
#define GL_GLEXT_PROTOTYPES
#include <GL/gl.h>
#include <GL/glext.h>
#define QGL_ES 0
#endif
