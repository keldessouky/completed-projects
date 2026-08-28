"""Header checks a real loader would make, and DeSmuME does not.

DeSmuME loads almost anything, which is exactly why the emulator harness was
happy with a ROM that melonDS refused outright. These are the rules the
stricter loaders actually apply, so a build that would be rejected on the
hardware fails here instead of on the device.
"""

import sys

SECURE_LO, SECURE_HI = 0x4000, 0x8000


def u32(d, o):
    return int.from_bytes(d[o:o + 4], 'little')


def check(path):
    d = open(path, 'rb').read()
    bad = []

    if len(d) < 0x200:
        return ["file is too short to hold a header"]

    #  The retail secure area lives at 0x4000-0x7FFF. A cartridge with its ARM9
    #  binary in that window is a retail cart as far as melonDS is concerned, so
    #  it tests the region for Key1 encryption, fails to find the decrypted
    #  marker in a homebrew build, and asks for BIOS files nobody has.
    arm9 = u32(d, 0x20)
    if SECURE_LO <= arm9 < SECURE_HI:
        bad.append("ARM9 binary is at %#x, inside the retail secure area "
                   "(%#x-%#x): melonDS will call this an encrypted ROM and "
                   "demand native BIOS" % (arm9, SECURE_LO, SECURE_HI - 1))

    #  02 means "DS and DSi"; a DSi-aware loader then goes looking for a DSi
    #  extended header this ROM does not have.
    if d[0x12] != 0x00:
        bad.append("unit code is %#x, should be 0x00 for a plain DS title" % d[0x12])

    #  The ARM9 has to land above the region a card's own secure area occupies
    #  in main RAM, or a direct-booted homebrew never starts.
    if u32(d, 0x28) < 0x02004000:
        bad.append("ARM9 loads to %#x, below 0x02004000" % u32(d, 0x28))

    for name, off in (("ARM9", 0x20), ("ARM7", 0x30)):
        start, size = u32(d, off), u32(d, off + 0xC)
        if start + size > len(d):
            bad.append("%s binary runs past the end of the file" % name)

    #  Sizes a strict loader trusts. A direct-booting emulator copies both
    #  binaries into RAM from offsets and lengths in this header and then
    #  jumps; every one of these being right is the difference between a game
    #  and a black screen, and none of them are checked by anything else.
    if u32(d, 0x80) != len(d):
        bad.append("header says the ROM is %d bytes, the file is %d"
                   % (u32(d, 0x80), len(d)))
    if u32(d, 0x84) != 0x200:
        bad.append("header size is %#x, should be 0x200" % u32(d, 0x84))
    capacity_kb = 128 << d[0x14]
    if capacity_kb < len(d) // 1024:
        bad.append("device capacity is %d KB, too small for a %d KB image"
                   % (capacity_kb, len(d) // 1024))
    arm9_off, arm9_ram, arm9_entry = u32(d, 0x20), u32(d, 0x28), u32(d, 0x24)
    if not arm9_ram <= arm9_entry < arm9_ram + u32(d, 0x2C):
        bad.append("the ARM9 entry point %#010x is outside the ARM9 binary"
                   % arm9_entry)

    #  The banner is the label: a front end reads the icon and the three lines
    #  of title straight out of it, and it is the only thing most people see
    #  before deciding whether to open the ROM. A zero offset, a truncated
    #  block or an empty title all produce a listing with a blank square and
    #  the filename next to it, which is exactly what shipping a homebrew ROM
    #  looks like when nobody checked.
    banner = u32(d, 0x68)
    if banner == 0:
        bad.append("no banner: the ROM will list with no icon and no title")
    elif banner + 0x840 > len(d):
        bad.append("banner at %#x runs past the end of the file" % banner)
    else:
        icon = d[banner + 0x20:banner + 0x220]
        if not any(icon):
            bad.append("the banner icon is blank")
        title = d[banner + 0x340:banner + 0x440].decode('utf-16-le', 'replace')
        title = title.split('\0')[0].strip()
        if not title:
            bad.append("the banner carries no English title")
        #  ndstool computes this over the icon and every language's title.
        crc = 0xFFFF
        for byte in d[banner + 0x20:banner + 0x840]:
            crc ^= byte
            for _ in range(8):
                crc = (crc >> 1) ^ (0xA001 if crc & 1 else 0)
        if crc != int.from_bytes(d[banner + 2:banner + 4], 'little'):
            bad.append("banner CRC is stale: the icon or title was edited "
                       "without refixing")

    #  ndstool writes this; if it is wrong the ROM was edited and not refixed.
    crc = 0xFFFF
    for byte in d[0:0x15E]:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ (0xA001 if crc & 1 else 0)
    if crc != int.from_bytes(d[0x15E:0x160], 'little'):
        bad.append("header CRC is stale: run ndstool -f")

    return bad


if __name__ == '__main__':
    problems = check(sys.argv[1])
    for p in problems:
        print("  romcheck: %s" % p, file=sys.stderr)
    if problems:
        sys.exit(1)
    print("  romcheck: header and banner are ones a real loader will take")
