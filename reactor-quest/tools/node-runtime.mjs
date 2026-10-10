// `--with-node` for the app packagers: put an official Node.js runtime inside
// the package, so players don't have to install Node.js themselves.
//
// The runtime comes from nodejs.org, is checked against the release's
// published SHA-256 sums, and is cached in node_modules/.cache so packaging
// again doesn't download it again. Only the `node` executable is kept: the
// game's server needs nothing else. No dependencies: Node can gunzip, and a
// tar archive is simple enough to read by hand.
//
//   macOS    one universal executable (Apple silicon + Intel), built by
//            joining the two official ones the way `lipo` does
//   Windows  the official standalone node.exe (x64; Windows on Arm runs it too)
//   Linux    x64 or arm64, from the official tarball
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { root } from './packaging.mjs';

/** The Node.js line to bundle: an LTS that still runs on macOS 11 and the glibc in common distros. */
export const NODE_LINE = 22;
const DIST = 'https://nodejs.org/dist';
const cache = join(root, 'node_modules', '.cache', 'reactor-node');

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Downloading ${url} failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The newest release of `line` (or exactly `wanted`, like "22.23.3"). */
async function resolveVersion(wanted) {
  if (wanted && /^\d+\.\d+\.\d+$/.test(wanted)) return `v${wanted}`;
  const line = wanted ?? NODE_LINE;
  const releases = JSON.parse((await get(`${DIST}/index.json`)).toString('utf8'));
  const found = releases.find((r) => r.version.startsWith(`v${line}.`));
  if (!found) throw new Error(`No Node.js ${line} release found on nodejs.org.`);
  return found.version;
}

/** A file from a release, checked against the release's SHASUMS256.txt. */
async function verified(version, file) {
  const cached = join(cache, version, file);
  if (existsSync(cached)) return readFileSync(cached);
  const sums = (await get(`${DIST}/${version}/SHASUMS256.txt`)).toString('utf8');
  const expected = sums.split('\n').map((l) => l.trim().split(/\s+/)).find(([, name]) => name === file)?.[0];
  if (!expected) throw new Error(`${file} isn't listed in the Node.js ${version} checksums.`);
  console.log(`Downloading Node.js ${version}: ${file}`);
  const data = await get(`${DIST}/${version}/${file}`);
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expected) throw new Error(`${file} doesn't match its published checksum (expected ${expected}, got ${actual}).`);
  mkdirSync(join(cache, version, ...file.split('/').slice(0, -1)), { recursive: true });
  writeFileSync(`${cached}.part`, data);
  renameSync(`${cached}.part`, cached);
  return data;
}

/** The contents of the first regular file in a .tar.gz whose path ends with `suffix`. */
export function fromTarGz(archive, suffix) {
  const tar = gunzipSync(archive);
  let longName = null;
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1) || '0';
    const body = tar.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
    // GNU long names and pax headers carry the real path of the next entry.
    if (type === 'L') { longName = body.toString('utf8').replace(/\0.*$/s, ''); continue; }
    if (type === 'x') { longName = body.toString('utf8').match(/^\d+ path=(.*)$/m)?.[1] ?? null; continue; }
    const prefix = field(345, 155);
    const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = null;
    if ((type === '0' || type === '7') && name.endsWith(suffix)) return Buffer.from(body);
  }
  throw new Error(`No ${suffix} in the archive.`);
}

/**
 * One universal Mach-O executable from thin ones, as `lipo -create` makes it.
 * Each slice keeps its own code signature, so the result stays signed.
 */
export function universal(slices) {
  const ALIGN = 14; // 16 KiB, what lipo uses for arm64 and x86_64
  const header = Buffer.alloc(8 + 20 * slices.length);
  header.writeUInt32BE(0xcafebabe, 0);
  header.writeUInt32BE(slices.length, 4);
  const parts = [header];
  let offset = header.length;
  slices.forEach((slice, i) => {
    if (slice.readUInt32LE(0) !== 0xfeedfacf) throw new Error('Not a 64-bit Mach-O executable.');
    const padding = (-offset & ((1 << ALIGN) - 1)) >>> 0;
    parts.push(Buffer.alloc(padding));
    offset += padding;
    const entry = 8 + 20 * i;
    header.writeUInt32BE(slice.readUInt32LE(4), entry); // cputype
    header.writeUInt32BE(slice.readUInt32LE(8), entry + 4); // cpusubtype
    header.writeUInt32BE(offset, entry + 8);
    header.writeUInt32BE(slice.length, entry + 12);
    header.writeUInt32BE(ALIGN, entry + 16);
    parts.push(slice);
    offset += slice.length;
  });
  return Buffer.concat(parts);
}

/** The bundling options given to a packager, or null without --with-node. */
export function nodeOptions() {
  const args = process.argv.slice(2);
  if (!args.includes('--with-node')) return null;
  const value = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  return { version: value('--node-version'), arch: value('--arch') };
}

/**
 * Put a Node.js executable for `target` (darwin, win32 or linux) at `dest`.
 * Returns the version bundled, like "v22.23.3".
 */
export async function bundleNode(target, dest, { version: wanted, arch } = {}) {
  const version = await resolveVersion(wanted);
  const tarball = (platform) => verified(version, `node-${version}-${platform}.tar.gz`);
  let binary;
  let licenseFrom;
  if (target === 'darwin') {
    binary = universal([fromTarGz(await tarball('darwin-arm64'), '/bin/node'), fromTarGz(await tarball('darwin-x64'), '/bin/node')]);
    licenseFrom = 'darwin-arm64';
  } else if (target === 'win32') {
    binary = await verified(version, 'win-x64/node.exe');
    // node.exe comes alone; its licence is the same in every release archive.
    licenseFrom = 'linux-x64';
  } else if (target === 'linux') {
    const a = arch ?? (process.arch === 'arm64' ? 'arm64' : 'x64');
    if (!['x64', 'arm64'].includes(a)) throw new Error(`Can't bundle Node.js for Linux on ${a}: use --arch x64 or --arch arm64.`);
    binary = fromTarGz(await tarball(`linux-${a}`), '/bin/node');
    licenseFrom = `linux-${a}`;
  } else throw new Error(`Can't bundle Node.js for ${target}.`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, binary);
  chmodSync(dest, 0o755);
  // Node.js's own licence travels with it.
  writeFileSync(join(dirname(dest), 'NODE-LICENSE.txt'), fromTarGz(await tarball(licenseFrom), `${version}-${licenseFrom}/LICENSE`));
  console.log(`Bundled Node.js ${version} (${(binary.length / 1e6).toFixed(0)} MB)`);
  return version;
}
