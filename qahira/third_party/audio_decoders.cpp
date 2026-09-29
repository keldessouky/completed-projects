// The radio's decoders: minimp3 (CC0) for MP3 and stb_vorbis (public domain) for Ogg Vorbis.
#if defined(__GNUC__)
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-variable"
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wsign-compare"
#pragma GCC diagnostic ignored "-Wmisleading-indentation"
#pragma GCC diagnostic ignored "-Wmaybe-uninitialized"
#pragma GCC diagnostic ignored "-Wimplicit-fallthrough"
#endif
#define MINIMP3_IMPLEMENTATION
#include "minimp3_ex.h"
#include "stb_vorbis.c"
