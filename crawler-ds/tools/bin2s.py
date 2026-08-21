#!/usr/bin/env python3
"""Turn a binary blob into an assembler source file, the way devkitPro's bin2s
does: `foo.bin` becomes the symbols `foo_bin`, `foo_bin_end` and `foo_bin_size`."""
import os
import sys

inp, outp = sys.argv[1], sys.argv[2]
data = open(inp, 'rb').read()
name = os.path.basename(inp).replace('.', '_').replace('-', '_')
with open(outp, 'w') as f:
    f.write("\t.section .rodata\n\t.balign 4\n")
    f.write("\t.global %s\n%s:\n" % (name, name))
    for i in range(0, len(data), 16):
        f.write("\t.byte " + ",".join(str(b) for b in data[i:i + 16]) + "\n")
    f.write("\t.global %s_end\n%s_end:\n" % (name, name))
    f.write("\t.balign 4\n\t.global %s_size\n%s_size:\n\t.int %d\n" % (name, name, len(data)))
