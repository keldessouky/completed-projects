/*  ndsbot — a headless player for the ROM.
 *
 *  It loads DeSmuME's libretro core, boots dist/crawler-ds.nds, presses buttons
 *  and touches the screen from a script, writes PNGs of both screens, and reads
 *  the game's own telemetry block straight out of emulated main RAM so a script
 *  can assert on what actually happened ("we are on floor 2", "Carl is level 3")
 *  instead of on pixels.
 *
 *  Usage: ndsbot --rom FILE --script FILE [--shots DIR] [--core PATH] [--quiet]
 *
 *  Script commands (one per line, # starts a comment):
 *      frames N                 run N frames
 *      press BTN [N]            tap a button for N frames (default 8)
 *      mash BTN [N]             tap a button N times (default 8)
 *      until BTN FIELD OP VALUE tap a button until the telemetry agrees
 *      autoplay N               N rounds of walk-and-swing
 *      hold BTN N               hold a button for N frames
 *      touch X Y [N]            hold the stylus at X,Y for N frames (default 4)
 *      shot NAME                write NAME.png into the shots directory
 *      expect FIELD OP VALUE    assert on telemetry (OP: = != < <= > >=)
 *      wait FIELD OP VALUE N    run up to N frames until the assertion holds
 *      print                    dump the telemetry block
 *      echo TEXT                progress note
 *  Buttons: up down left right a b x y l r start select
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>
#include <string.h>
#include <sys/stat.h>
#include <zlib.h>

#include "libretro.h"
#include "telemetry.h"

#define DEFAULT_CORE "/usr/lib/x86_64-linux-gnu/libretro/desmume_libretro.so"

/* ------------------------------------------------------------------ core ---- */

static struct { char *key, *val; } g_opts[128];
static int g_n_opts;

static const void *g_frame;
static unsigned g_fw, g_fh, g_fpitch;
static bool g_quiet;

/*  Where the core is allowed to litter. DeSmuME writes a .dsv save file next to
 *  whatever it is told is the save directory, and a test harness has no
 *  business dropping that into the repository. */
static char g_scratch_dir[512];

static void scratch_dir_init(void) {
    const char *tmp = getenv("TMPDIR");
    snprintf(g_scratch_dir, sizeof g_scratch_dir, "%s/ndsbot", tmp && *tmp ? tmp : "/tmp");
    mkdir(g_scratch_dir, 0755);
}

static uint32_t g_joypad;      /* RETRO_DEVICE_ID_JOYPAD_* bitmap */
static bool g_touching;
static int g_touch_x, g_touch_y;

static void core_log(enum retro_log_level lvl, const char *fmt, ...) {
    if (g_quiet) return;
    va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap);
}

static bool env_cb(unsigned cmd, void *data) {
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: return *(const enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_RGB565;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char **)data = g_scratch_dir; return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool *)data = true; return true;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE: ((struct retro_log_callback *)data)->log = core_log; return true;
    case RETRO_ENVIRONMENT_SET_VARIABLES: {
        const struct retro_variable *v = data;
        for (; v && v->key && g_n_opts < 128; v++) {
            const char *semi = strchr(v->value, ';');
            const char *first = semi ? semi + 1 : v->value;
            while (*first == ' ') first++;
            const char *bar = strchr(first, '|');
            size_t len = bar ? (size_t)(bar - first) : strlen(first);
            g_opts[g_n_opts].key = strdup(v->key);
            g_opts[g_n_opts].val = strndup(first, len);
            g_n_opts++;
        }
        return true; }
    case RETRO_ENVIRONMENT_GET_VARIABLE: {
        struct retro_variable *v = data;
        /* DeSmuME 0.9.11's ARM7 recompiler mistranslates the self-modifying
           copy-and-run in devkitARM's crt0, so the emulator is driven in
           interpreter mode. Real hardware and current emulators are unaffected. */
        if (!strcmp(v->key, "desmume_cpu_mode")) { v->value = "interpreter"; return true; }
        /* Absolute stylus coordinates rather than relative mouse motion, so a
           script can tap an exact button. */
        if (!strcmp(v->key, "desmume_pointer_type")) { v->value = "touch"; return true; }
        for (int i = 0; i < g_n_opts; i++)
            if (!strcmp(g_opts[i].key, v->key)) { v->value = g_opts[i].val; return true; }
        v->value = NULL;
        return false; }
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE: *(bool *)data = false; return true;
    default: return false;
    }
}

static void video_cb(const void *data, unsigned w, unsigned h, size_t pitch) {
    if (data) { g_frame = data; g_fw = w; g_fh = h; g_fpitch = (unsigned)pitch; }
}
static void audio_cb(int16_t l, int16_t r) { (void)l; (void)r; }
static size_t audio_batch_cb(const int16_t *d, size_t frames) { (void)d; return frames; }
static void input_poll_cb(void) {}
static int16_t input_state_cb(unsigned port, unsigned device, unsigned index, unsigned id) {
    if (getenv("NDSBOT_TRACE_INPUT")) fprintf(stderr, "[in] port=%u dev=%u idx=%u id=%u touching=%d\n", port, device, index, id, g_touching);
    if (port != 0) return 0;
    if (device == RETRO_DEVICE_JOYPAD) return (g_joypad >> id) & 1;
    if (device == RETRO_DEVICE_POINTER) {
        if (!g_touching) return 0;
        switch (id) {
        /* The core wants pointer coordinates spanning the whole 256x384 output,
           where the touch screen is the lower half. */
        /* The core maps the pointer across the whole stacked output and then
           subtracts the top screen, so the bottom screen starts at y = 192. */
        case RETRO_DEVICE_ID_POINTER_X: return (int16_t)((g_touch_x * 0x10000 / 256) - 0x8000);
        case RETRO_DEVICE_ID_POINTER_Y: return (int16_t)(((g_touch_y + 192) * 0x10000 / 384) - 0x8000);
        case RETRO_DEVICE_ID_POINTER_PRESSED: return 1;
        default: return 0;
        }
    }
    return 0;
}

static struct {
    void *handle;
    void (*init)(void);
    void (*deinit)(void);
    bool (*load_game)(const struct retro_game_info *);
    void (*run)(void);
    void (*get_av_info)(struct retro_system_av_info *);
    void (*set_controller_port_device)(unsigned, unsigned);
    size_t (*serialize_size)(void);
    bool (*serialize)(void *, size_t);
} core;

static void die(const char *fmt, ...) {
    va_list ap; va_start(ap, fmt);
    fprintf(stderr, "ndsbot: "); vfprintf(stderr, fmt, ap); fprintf(stderr, "\n");
    va_end(ap);
    exit(2);
}

static void core_load(const char *path) {
    core.handle = dlopen(path, RTLD_NOW);
    if (!core.handle) die("cannot load core %s: %s", path, dlerror());
    #define SYM(field, name) \
        *(void **)&core.field = dlsym(core.handle, name); \
        if (!core.field) die("core is missing %s", name);
    SYM(init, "retro_init") SYM(deinit, "retro_deinit") SYM(load_game, "retro_load_game")
    SYM(run, "retro_run") SYM(get_av_info, "retro_get_system_av_info")
    SYM(set_controller_port_device, "retro_set_controller_port_device")
    SYM(serialize_size, "retro_serialize_size") SYM(serialize, "retro_serialize")
    #undef SYM
    void (*set_env)(retro_environment_t) = dlsym(core.handle, "retro_set_environment");
    void (*set_video)(retro_video_refresh_t) = dlsym(core.handle, "retro_set_video_refresh");
    void (*set_audio)(retro_audio_sample_t) = dlsym(core.handle, "retro_set_audio_sample");
    void (*set_audio_batch)(retro_audio_sample_batch_t) = dlsym(core.handle, "retro_set_audio_sample_batch");
    void (*set_poll)(retro_input_poll_t) = dlsym(core.handle, "retro_set_input_poll");
    void (*set_state)(retro_input_state_t) = dlsym(core.handle, "retro_set_input_state");
    set_env(env_cb); set_video(video_cb); set_audio(audio_cb);
    set_audio_batch(audio_batch_cb); set_poll(input_poll_cb); set_state(input_state_cb);
}

/* ------------------------------------------------------------- telemetry ---- */

static void *g_state;
static size_t g_state_size;
static size_t g_tel_offset = (size_t)-1;

static const Telemetry *telemetry(void) {
    if (!g_state) {
        g_state_size = core.serialize_size();
        g_state = malloc(g_state_size);
    }
    if (!core.serialize(g_state, g_state_size)) return NULL;
    uint32_t magic[2] = { TELEMETRY_MAGIC0, TELEMETRY_MAGIC1 };
    if (g_tel_offset != (size_t)-1 &&
        !memcmp((char *)g_state + g_tel_offset, magic, sizeof magic))
        return (const Telemetry *)((char *)g_state + g_tel_offset);
    for (size_t i = 0; i + sizeof(Telemetry) < g_state_size; i += 4)
        if (!memcmp((char *)g_state + i, magic, sizeof magic)) {
            g_tel_offset = i;
            return (const Telemetry *)((char *)g_state + i);
        }
    return NULL;
}

static const struct { const char *name; size_t off; } tel_fields[] = {
    #define F(n) { #n, offsetof(Telemetry, n) }
    F(frame), F(scene), F(floor), F(px), F(py), F(facing), F(steps), F(explored),
    F(carl_hp), F(carl_hp_max), F(carl_level), F(carl_xp),
    F(donut_hp), F(donut_hp_max), F(donut_level),
    F(gold), F(boxes), F(achievements), F(battles_won), F(story_beat), F(flags), F(collapse), F(touch), F(touch_raw),
    #undef F
};

static bool tel_read(const char *field, uint32_t *out) {
    const Telemetry *t = telemetry();
    if (!t) return false;
    for (unsigned i = 0; i < sizeof tel_fields / sizeof tel_fields[0]; i++)
        if (!strcmp(tel_fields[i].name, field)) {
            *out = *(const uint32_t *)((const char *)t + tel_fields[i].off);
            return true;
        }
    die("unknown telemetry field '%s'", field);
    return false;
}

/* ------------------------------------------------------------------- png ---- */

static void put32(unsigned char *p, uint32_t v) {
    p[0] = v >> 24; p[1] = v >> 16; p[2] = v >> 8; p[3] = v;
}

static void png_chunk(FILE *f, const char *type, const unsigned char *data, size_t len) {
    unsigned char hdr[8];
    put32(hdr, (uint32_t)len);
    memcpy(hdr + 4, type, 4);
    fwrite(hdr, 1, 8, f);
    fwrite(data, 1, len, f);
    uLong crc = crc32(0, (const Bytef *)type, 4);
    if (len) crc = crc32(crc, data, (uInt)len);
    unsigned char c[4]; put32(c, (uint32_t)crc);
    fwrite(c, 1, 4, f);
}

/* Writes the emulator's RGB565 output as an 8-bit RGB PNG. */
static void write_png(const char *path, const uint16_t *px, unsigned w, unsigned h, unsigned stride) {
    size_t raw_len = (size_t)h * (1 + (size_t)w * 3);
    unsigned char *raw = malloc(raw_len);
    unsigned char *o = raw;
    for (unsigned y = 0; y < h; y++) {
        *o++ = 0;                            /* filter: none */
        for (unsigned x = 0; x < w; x++) {
            uint16_t c = px[y * stride + x];
            unsigned r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
            *o++ = (unsigned char)((r * 255 + 15) / 31);
            *o++ = (unsigned char)((g * 255 + 31) / 63);
            *o++ = (unsigned char)((b * 255 + 15) / 31);
        }
    }
    uLongf zlen = compressBound((uLong)raw_len);
    unsigned char *z = malloc(zlen);
    if (compress2(z, &zlen, raw, (uLong)raw_len, 9) != Z_OK) die("zlib failed");

    FILE *f = fopen(path, "wb");
    if (!f) die("cannot write %s", path);
    static const unsigned char sig[8] = { 137, 'P', 'N', 'G', 13, 10, 26, 10 };
    fwrite(sig, 1, 8, f);
    unsigned char ihdr[13];
    put32(ihdr, w); put32(ihdr + 4, h);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    png_chunk(f, "IHDR", ihdr, sizeof ihdr);
    png_chunk(f, "IDAT", z, zlen);
    png_chunk(f, "IEND", NULL, 0);
    fclose(f);
    free(z); free(raw);
}

/* ---------------------------------------------------------------- script ---- */

static const struct { const char *name; unsigned id; } buttons[] = {
    { "up", RETRO_DEVICE_ID_JOYPAD_UP }, { "down", RETRO_DEVICE_ID_JOYPAD_DOWN },
    { "left", RETRO_DEVICE_ID_JOYPAD_LEFT }, { "right", RETRO_DEVICE_ID_JOYPAD_RIGHT },
    { "a", RETRO_DEVICE_ID_JOYPAD_A }, { "b", RETRO_DEVICE_ID_JOYPAD_B },
    { "x", RETRO_DEVICE_ID_JOYPAD_X }, { "y", RETRO_DEVICE_ID_JOYPAD_Y },
    { "l", RETRO_DEVICE_ID_JOYPAD_L }, { "r", RETRO_DEVICE_ID_JOYPAD_R },
    { "start", RETRO_DEVICE_ID_JOYPAD_START }, { "select", RETRO_DEVICE_ID_JOYPAD_SELECT },
};

static unsigned button_id(const char *name) {
    for (unsigned i = 0; i < sizeof buttons / sizeof buttons[0]; i++)
        if (!strcmp(buttons[i].name, name)) return buttons[i].id;
    die("unknown button '%s'", name);
    return 0;
}

static void run_frames(int n) { for (int i = 0; i < n; i++) core.run(); }

static bool compare(uint32_t got, const char *op, uint32_t want) {
    if (!strcmp(op, "=") || !strcmp(op, "==")) return got == want;
    if (!strcmp(op, "!=")) return got != want;
    if (!strcmp(op, "<"))  return got <  want;
    if (!strcmp(op, "<=")) return got <= want;
    if (!strcmp(op, ">"))  return got >  want;
    if (!strcmp(op, ">=")) return got >= want;
    die("unknown comparison '%s'", op);
    return false;
}

int main(int argc, char **argv) {
    const char *rom = NULL, *script = NULL, *shots = NULL, *core_path = DEFAULT_CORE;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--rom") && i + 1 < argc) rom = argv[++i];
        else if (!strcmp(argv[i], "--script") && i + 1 < argc) script = argv[++i];
        else if (!strcmp(argv[i], "--shots") && i + 1 < argc) shots = argv[++i];
        else if (!strcmp(argv[i], "--core") && i + 1 < argc) core_path = argv[++i];
        else if (!strcmp(argv[i], "--quiet")) g_quiet = true;
        else die("unexpected argument '%s'", argv[i]);
    }
    if (!rom || !script) die("usage: ndsbot --rom FILE --script FILE [--shots DIR]");
    if (shots) mkdir(shots, 0755);
    scratch_dir_init();

    core_load(core_path);
    core.init();
    struct retro_game_info info = { rom, NULL, 0, NULL };   /* the core wants a path */
    if (!core.load_game(&info)) die("core refused %s", rom);
    core.set_controller_port_device(0, RETRO_DEVICE_JOYPAD);

    FILE *f = fopen(script, "r");
    if (!f) die("cannot read %s", script);

    int failures = 0, checks = 0, line_no = 0;
    char line[512];
    while (fgets(line, sizeof line, f)) {
        line_no++;
        char *hash = strchr(line, '#'); if (hash) *hash = 0;
        char cmd[64] = "", a[128] = "", b[64] = "", c[64] = "", d[64] = "", e[64] = "";
        int n = sscanf(line, "%63s %127s %63s %63s %63s %63s", cmd, a, b, c, d, e);
        if (n < 1) continue;

        if (!strcmp(cmd, "frames")) {
            run_frames(atoi(a));
        } else if (!strcmp(cmd, "press") || !strcmp(cmd, "hold")) {
            int frames = b[0] ? atoi(b) : 8;
            unsigned id = button_id(a);
            g_joypad |= 1u << id;
            run_frames(frames);
            g_joypad &= ~(1u << id);
            run_frames(!strcmp(cmd, "press") ? 3 : 1);
        } else if (!strcmp(cmd, "mash")) {
            int times = b[0] ? atoi(b) : 8;
            unsigned id = button_id(a);
            for (int k = 0; k < times; k++) {
                g_joypad |= 1u << id;  run_frames(8);
                g_joypad &= ~(1u << id); run_frames(8);
            }
        } else if (!strcmp(cmd, "autoplay")) {
            /* Walk, swing, confirm: enough to explore a floor and win the fights
               it starts, without the script knowing anything about the map. */
            int rounds = a[0] ? atoi(a) : 20;
            uint32_t last_steps = 0, stuck = 0;
            tel_read("steps", &last_steps);
            for (int k = 0; k < rounds; k++) {
                /* Walk forward, confirm whatever the game put on screen, and
                   turn away from anything that stops being walkable. Turning is
                   on the shoulders: the d-pad is movement in all four
                   directions now, so "right" strafes rather than turns. */
                const char *button = (k % 3 == 2) ? "a" : "up";
                if (stuck >= 2) { button = "r"; stuck = 0; }
                unsigned id = button_id(button);
                g_joypad |= 1u << id;  run_frames(8);
                g_joypad &= ~(1u << id); run_frames(6);

                uint32_t steps = 0, scene = 0;
                tel_read("steps", &steps);
                tel_read("scene", &scene);
                if (scene == 2) {            /* only the corridor counts as stuck */
                    if (steps == last_steps) stuck++;
                    else stuck = 0;
                } else {
                    /*  A fight, a briefing or a chapter. All three now say one
                     *  thing at a time and wait to be read, so a single tap a
                     *  round is nowhere near enough to get through one. */
                    /*  A advances a message, confirms a menu and buys from a
                     *  shop, which means A alone can never leave a shop: it
                     *  just keeps buying. B backs out of anything A cannot
                     *  finish, so the walk always resumes. */
                    stuck = 0;
                    for (int t = 0; t < 5; t++) {
                        g_joypad |= 1u << button_id("a"); run_frames(6);
                        g_joypad &= ~(1u << button_id("a")); run_frames(4);
                    }
                    g_joypad |= 1u << button_id("b"); run_frames(6);
                    g_joypad &= ~(1u << button_id("b")); run_frames(4);
                }
                last_steps = steps;
            }
        } else if (!strcmp(cmd, "until")) {
            /* until BTN FIELD OP VALUE [MAX] - tap BTN until the telemetry says so. */
            unsigned id = button_id(a);
            uint32_t want = (uint32_t)strtoul(d[0] ? d : "0", NULL, 0);
            int max_presses = e[0] ? atoi(e) : 40;
            uint32_t got = 0;
            int ok = 0;
            for (int k = 0; k < max_presses; k++) {
                if (!tel_read(b, &got)) die("telemetry block not found (line %d)", line_no);
                if (compare(got, c, want)) { ok = 1; break; }
                g_joypad |= 1u << id;  run_frames(8);
                g_joypad &= ~(1u << id); run_frames(8);
            }
            checks++;
            if (!ok) { printf("  FAIL line %d: never reached %s %s %u (got %u)\n", line_no, b, c, want, got); failures++; }
            else if (!g_quiet) printf("  ok   %s %s %u\n", b, c, want);
        } else if (!strcmp(cmd, "touch")) {
            int frames = c[0] ? atoi(c) : 4;
            g_touch_x = atoi(a); g_touch_y = atoi(b); g_touching = true;
            run_frames(frames);
            g_touching = false;
            run_frames(3);
        } else if (!strcmp(cmd, "shot")) {
            if (!shots) continue;
            char path[512];
            snprintf(path, sizeof path, "%s/%s.png", shots, a);
            if (!g_frame) die("no frame to capture yet");
            write_png(path, g_frame, g_fw, g_fh, g_fpitch / 2);
            if (!g_quiet) printf("  shot %s\n", path);
        } else if (!strcmp(cmd, "expect") || !strcmp(cmd, "wait")) {
            uint32_t want = (uint32_t)strtoul(!strcmp(cmd, "expect") ? c : c, NULL, 0);
            uint32_t got = 0;
            int budget = !strcmp(cmd, "wait") ? (d[0] ? atoi(d) : 600) : 0;
            bool ok = false;
            do {
                if (!tel_read(a, &got)) die("telemetry block not found (line %d)", line_no);
                ok = compare(got, b, want);
                if (ok || budget <= 0) break;
                run_frames(4); budget -= 4;
            } while (budget > 0);
            checks++;
            if (!ok) {
                printf("  FAIL line %d: %s %s %u (got %u)\n", line_no, a, b, want, got);
                failures++;
            } else if (!g_quiet) {
                printf("  ok   %s %s %u\n", a, b, want);
            }
        } else if (!strcmp(cmd, "print")) {
            const Telemetry *t = telemetry();
            if (!t) die("telemetry block not found");
            printf("  telemetry:");
            for (unsigned i = 0; i < sizeof tel_fields / sizeof tel_fields[0]; i++)
                printf(" %s=%u", tel_fields[i].name,
                       *(const uint32_t *)((const char *)t + tel_fields[i].off));
            printf("\n");
        } else if (!strcmp(cmd, "echo")) {
            char *rest = strstr(line, "echo");
            printf("== %s", rest + 5);
        } else {
            die("unknown command '%s' on line %d", cmd, line_no);
        }
    }
    fclose(f);

    printf("%s: %d checks, %d failures\n", failures ? "FAILED" : "passed", checks, failures);
    return failures ? 1 : 0;
}
