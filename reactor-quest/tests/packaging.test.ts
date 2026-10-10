// @vitest-environment node
// The pieces `--with-node` uses to put Node.js inside the app packages,
// checked offline against archives and executables built here.
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { fromTarGz, universal } from '../tools/node-runtime.mjs';

/** A minimal ustar archive, the way release tarballs are laid out. */
function tar(entries: { name: string; body?: string; type?: string; prefix?: string }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const { name, body = '', type = '0', prefix = '' } of entries) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write('0000644\0', 100);
    header.write(`${Buffer.byteLength(body).toString(8).padStart(11, '0')}\0`, 124);
    header.write(type, 156);
    header.write('ustar\0', 257);
    header.write(prefix, 345, 155);
    const data = Buffer.alloc(Math.ceil(Buffer.byteLength(body) / 512) * 512);
    data.write(body);
    blocks.push(header, data);
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

describe('reading a release tarball', () => {
  test('finds a file by the end of its path, skipping everything before it', () => {
    const archive = tar([
      { name: 'node-v22.0.0-linux-x64/', type: '5' },
      { name: 'node-v22.0.0-linux-x64/README.md', body: 'x'.repeat(700) },
      { name: 'node-v22.0.0-linux-x64/bin/node', body: 'NODE' },
      { name: 'node-v22.0.0-linux-x64/LICENSE', body: 'MIT' },
    ]);
    expect(fromTarGz(archive, '/bin/node').toString()).toBe('NODE');
    expect(fromTarGz(archive, '-linux-x64/LICENSE').toString()).toBe('MIT');
  });

  test('understands long names (GNU and pax) and the ustar prefix', () => {
    const long = `${'deep/'.repeat(30)}bin/node`;
    expect(fromTarGz(tar([{ name: '././@LongLink', type: 'L', body: long }, { name: 'truncated', body: 'GNU' }]), '/bin/node').toString()).toBe('GNU');
    expect(fromTarGz(tar([{ name: 'PaxHeader', type: 'x', body: `${long.length + 9} path=${long}\n` }, { name: 'truncated', body: 'PAX' }]), '/bin/node').toString()).toBe('PAX');
    expect(fromTarGz(tar([{ name: 'bin/node', prefix: 'node-v22.0.0-darwin-arm64', body: 'PREFIX' }]), 'arm64/bin/node').toString()).toBe('PREFIX');
  });

  test('says so when the file is missing', () => {
    expect(() => fromTarGz(tar([{ name: 'a/README.md', body: 'x' }]), '/bin/node')).toThrow(/No \/bin\/node/);
  });
});

describe('a universal macOS executable', () => {
  /** A stand-in 64-bit Mach-O: magic, cputype, cpusubtype, then a body. */
  const machO = (cputype: number, subtype: number, size: number) => {
    const b = Buffer.alloc(size, 0xab);
    b.writeUInt32LE(0xfeedfacf, 0);
    b.writeUInt32LE(cputype, 4);
    b.writeUInt32LE(subtype, 8);
    return b;
  };

  test('is a fat header followed by each slice, 16 KiB aligned, as lipo writes it', () => {
    const arm = machO(0x0100000c, 0, 50_000);
    const intel = machO(0x01000007, 3, 30_000);
    const fat = universal([arm, intel]);
    expect(fat.readUInt32BE(0)).toBe(0xcafebabe);
    expect(fat.readUInt32BE(4)).toBe(2);
    const slices = [0, 1].map((i) => ({
      cputype: fat.readUInt32BE(8 + 20 * i),
      subtype: fat.readUInt32BE(12 + 20 * i),
      offset: fat.readUInt32BE(16 + 20 * i),
      size: fat.readUInt32BE(20 + 20 * i),
      align: fat.readUInt32BE(24 + 20 * i),
    }));
    expect(slices.map((s) => [s.cputype, s.subtype, s.align])).toEqual([[0x0100000c, 0, 14], [0x01000007, 3, 14]]);
    for (const [i, slice] of [arm, intel].entries()) {
      expect(slices[i].offset % 16384).toBe(0);
      expect(slices[i].size).toBe(slice.length);
      expect(fat.subarray(slices[i].offset, slices[i].offset + slices[i].size).equals(slice)).toBe(true);
    }
    expect(slices[1].offset).toBeGreaterThanOrEqual(slices[0].offset + arm.length);
  });

  test('refuses anything that is not a 64-bit Mach-O', () => {
    expect(() => universal([Buffer.from('MZ not a mac binary')])).toThrow(/Mach-O/);
  });
});
