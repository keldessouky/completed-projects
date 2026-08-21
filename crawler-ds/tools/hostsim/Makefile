CFLAGS ?= -O1 -g -Wall -Wextra -Wno-unused-parameter -I../../src -I../../src/core -I../../src/render -I../../src/gen
SRC = hostsim.c $(wildcard ../../src/core/*.c) $(wildcard ../../src/render/*.c) $(wildcard ../../src/gen/*.c)
hostsim: $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o hostsim -lz
clean:
	rm -f hostsim
.PHONY: clean
