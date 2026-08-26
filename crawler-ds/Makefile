#---------------------------------------------------------------------------------
# Dungeon Crawler Carl: Book One — Nintendo DS build
#
#   make sdk        build the toolchain into sdk/ (once; needs network)
#   make            build dist/crawler-ds.nds
#   make gen        regenerate art/audio/floor data in src/gen
#   make bot        build the headless libretro test harness
#   make test       run the harness over the ROM (boot, screens, playthrough)
#   make shots      regenerate the screenshots in docs/
#   make host       build the host-side core simulation
#   make hosttest   host-side checks: touch layout, recall codes, full playthroughs
#---------------------------------------------------------------------------------
SDK        ?= $(CURDIR)/sdk
TARGET     := crawler-ds
BUILD      := build
DIST       := dist

CC         := arm-none-eabi-gcc
OBJCOPY    := arm-none-eabi-objcopy
NDSTOOL    := $(SDK)/bin/ndstool

ARCH9      := -mthumb -mthumb-interwork -march=armv5te -mtune=arm946e-s
ARCH7      := -mthumb -mthumb-interwork -mcpu=arm7tdmi -mtune=arm7tdmi
WARN       := -Wall -Wextra -Wno-unused-parameter
CFLAGS9    := -g -O2 $(WARN) $(ARCH9) -DARM9 -D__NDS__ -DDS_BUILD \
              -ffunction-sections -fdata-sections -fomit-frame-pointer \
              -I$(SDK)/include -Isrc -Isrc/core -Isrc/render -Isrc/gen
CFLAGS7    := -g -Os $(WARN) $(ARCH7) -DARM7 -D__NDS__ \
              -ffunction-sections -fdata-sections -fomit-frame-pointer -I$(SDK)/include
LDFLAGS9   := -specs=$(SDK)/lib/ds_arm9.specs $(ARCH9) -B$(SDK)/lib -L$(SDK)/lib
LDFLAGS7   := -specs=$(SDK)/lib/ds_arm7.specs $(ARCH7) -B$(SDK)/lib -L$(SDK)/lib

SRC9       := $(wildcard src/core/*.c) $(wildcard src/render/*.c) \
              $(wildcard src/gen/*.c) $(wildcard src/ds/*.c)
OBJ9       := $(patsubst %.c,$(BUILD)/%.o,$(SRC9))
SRC7       := $(wildcard src/ds/arm7/*.c)
OBJ7       := $(patsubst %.c,$(BUILD)/%.o,$(SRC7))

GAME_TITLE := Dungeon Crawler Carl
GAME_SUB1  := Book One
GAME_SUB2  := unofficial fan game

.PHONY: all sdk gen clean bot test shots host hosttest run

all: $(DIST)/$(TARGET).nds

$(DIST)/$(TARGET).nds: $(BUILD)/arm9.elf $(BUILD)/arm7.elf assets/icon.bmp | $(DIST)
	$(NDSTOOL) -c $@ -h 0x200 -9 $(BUILD)/arm9.elf -7 $(BUILD)/arm7.elf \
	           -b assets/icon.bmp "$(GAME_TITLE);$(GAME_SUB1);$(GAME_SUB2)" \
	           -g CRWL 01 "CRAWLERDS" > /dev/null
#  ndstool can stamp unit code 02 (DS+DSi). This game uses nothing a DSi has,
#  and a DSi-aware loader that reads 02 goes looking for a DSi extended header,
#  does not find one, and refuses the ROM. 00 is "plain Nintendo DS", which is
#  what this is. The CRC has to be refixed after editing the header.
	@python3 -c "import sys; p=sys.argv[1]; d=bytearray(open(p,'rb').read()); d[0x12]=0; open(p,'wb').write(d)" $@
	@$(NDSTOOL) -f $@ > /dev/null
	@python3 tools/romcheck.py $@
	@ls -l $@ | awk '{printf "  built %s (%d bytes)\n", $$9, $$5}'

$(BUILD)/arm9.elf: $(OBJ9)
	@mkdir -p $(dir $@)
	$(CC) $(LDFLAGS9) $(OBJ9) -lnds9 -o $@ -Wl,-Map,$(BUILD)/arm9.map

$(BUILD)/arm7.elf: $(OBJ7)
	@mkdir -p $(dir $@)
	$(CC) $(LDFLAGS7) $(OBJ7) -lnds7 -o $@ -Wl,-Map,$(BUILD)/arm7.map

$(BUILD)/src/ds/arm7/%.o: src/ds/arm7/%.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS7) -MMD -MP -c $< -o $@

$(BUILD)/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS9) -MMD -MP -c $< -o $@

$(DIST):
	@mkdir -p $(DIST)

sdk:
	tools/setup-sdk.sh

gen:
	python3 tools/forge.py

bot:
	$(MAKE) -C tools/ndsbot

test: all bot
	tools/ndsbot/ndsbot --rom $(DIST)/$(TARGET).nds --script tools/ndsbot/playthrough.txt --shots docs/rom

shots: host
	tools/hostsim/hostsim --shots docs/shots
	python3 tools/forge.py --preview

host:
	$(MAKE) -C tools/hostsim

hosttest: host
	tools/hostsim/hostsim --touch
	tools/hostsim/hostsim --codes
	tools/hostsim/hostsim --mapsweep 4000
	tools/hostsim/hostsim --bot --runs 5

clean:
	rm -rf $(BUILD) $(DIST)
	$(MAKE) -C tools/ndsbot clean 2>/dev/null || true
	$(MAKE) -C tools/hostsim clean 2>/dev/null || true

-include $(OBJ9:.o=.d) $(OBJ7:.o=.d)
