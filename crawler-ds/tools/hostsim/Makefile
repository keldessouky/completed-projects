CFLAGS ?= -O1 -g -Wall -Wextra -Wno-unused-parameter -I../../src -I../../src/core -I../../src/render -I../../src/gen
SRC = hostsim.c $(wildcard ../../src/core/*.c) $(wildcard ../../src/render/*.c) $(wildcard ../../src/gen/*.c)
# Headers are prerequisites too. Without them a change to game.h leaves a
# stale binary, and the tests then pass or fail for reasons that have nothing
# to do with the code being tested.
HDR = $(wildcard ../../src/core/*.h) $(wildcard ../../src/render/*.h) \
      $(wildcard ../../src/gen/*.h) $(wildcard ../../tools/ndsbot/*.h)
hostsim: $(SRC) $(HDR)
	$(CC) $(CFLAGS) $(SRC) -o hostsim -lz
clean:
	rm -f hostsim
.PHONY: clean
