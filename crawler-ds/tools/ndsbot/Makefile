CFLAGS ?= -O2 -Wall -Wextra -Wno-unused-parameter
ndsbot: ndsbot.c libretro.h telemetry.h
	$(CC) $(CFLAGS) ndsbot.c -o ndsbot -ldl -lz
clean:
	rm -f ndsbot
.PHONY: clean
