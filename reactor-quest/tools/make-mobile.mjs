// `npm run app:ios` / `npm run app:android`: the game as a native phone app.
//
// Capacitor (capacitor.config.json) wraps the built game in a native shell: an
// Xcode project (ios/) and an Android Studio project (android/). This script
// creates them the first time, copies in the latest build, and gives them the
// game's own icon, launch screen and status bar. Then:
//
//   ios --open       opens the project in Xcode: pick your iPhone and press Run
//   android --apk    builds an installable APK (needs the Android SDK and JDK 21)
//   android --open   opens the project in Android Studio
//
// --skip-build reuses dist/ as it is.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawIcon, drawSplash, pngSize } from './icon.mjs';
import { ensureBuild, root } from './packaging.mjs';

const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: node tools/make-mobile.mjs ios|android [--open] [--apk] [--skip-build]');
  process.exit(1);
}
const flag = (f) => process.argv.includes(f);
const win = process.platform === 'win32';
const sh = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const cap = (...args) => sh(win ? 'npx.cmd' : 'npx', ['cap', ...args]);

ensureBuild();
if (!existsSync(join(root, platform))) cap('add', platform);
cap('sync', platform);

/** Every PNG under `dir` (recursively) whose name matches `test`. */
function pngs(dir, test) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pngs(path, test);
    return name.endsWith('.png') && test(name, path) ? [path] : [];
  });
}

// Launch screens: the reactor on the station's colours, at each image's own size.
const splashCache = new Map();
function splash(path) {
  const [w, h] = pngSize(readFileSync(path));
  const key = `${w}x${h}`;
  if (!splashCache.has(key)) splashCache.set(key, drawSplash(w, h));
  writeFileSync(path, splashCache.get(key));
}

/** Add or replace a key in an Info.plist. */
function plistSet(plist, key, valueXml) {
  const re = new RegExp(`<key>${key}</key>\\s*<[^>]+>[^<]*(</[^>]+>)?`);
  const entry = `<key>${key}</key>\n\t${valueXml}`;
  return re.test(plist) ? plist.replace(re, entry) : plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t${entry}\n</dict>\n</plist>\n`);
}

if (platform === 'ios') {
  const app = join(root, 'ios', 'App', 'App');
  // iOS rounds the corners itself and wants no transparency.
  for (const icon of pngs(join(app, 'Assets.xcassets', 'AppIcon.appiconset'), () => true)) {
    writeFileSync(icon, drawIcon(pngSize(readFileSync(icon))[0], { tile: 'square', opaque: true, ss: 2 }));
  }
  for (const img of pngs(join(app, 'Assets.xcassets', 'Splash.imageset'), () => true)) splash(img);
  const plistPath = join(app, 'Info.plist');
  let plist = readFileSync(plistPath, 'utf8');
  plist = plistSet(plist, 'CFBundleDisplayName', '<string>Reactor Quest</string>');
  // White status-bar text on the game's dark top bar (light profiles paint a dark strip behind it).
  plist = plistSet(plist, 'UIStatusBarStyle', '<string>UIStatusBarStyleLightContent</string>');
  plist = plistSet(plist, 'UIViewControllerBasedStatusBarAppearance', '<false/>');
  plist = plistSet(plist, 'ITSAppUsesNonExemptEncryption', '<false/>');
  writeFileSync(plistPath, plist);
  console.log('\nThe Xcode project is ready: ios/App/App.xcodeproj');
  if (flag('--open')) cap('open', 'ios');
  else console.log('Open it with: npx cap open ios');
} else {
  const res = join(root, 'android', 'app', 'src', 'main', 'res');
  for (const icon of pngs(res, (name) => /^ic_launcher(_round)?\.png$/.test(name))) {
    // Older Androids show these as they are.
    writeFileSync(icon, drawIcon(pngSize(readFileSync(icon))[0], { tile: 'rounded', ss: 2 }));
  }
  for (const icon of pngs(res, (name) => name === 'ic_launcher_foreground.png')) {
    // Adaptive icons (Android 8+): the reactor on its own, inside the safe zone; the tile colour is the background layer.
    writeFileSync(icon, drawIcon(pngSize(readFileSync(icon))[0], { tile: 'none', scale: 0.6, ss: 2 }));
  }
  const bg = join(res, 'values', 'ic_launcher_background.xml');
  if (existsSync(bg)) writeFileSync(bg, readFileSync(bg, 'utf8').replace(/>#[0-9A-Fa-f]{6,8}</, '>#0B1120<'));
  for (const img of pngs(res, (name) => name === 'splash.png')) splash(img);
  // The window behind the status and navigation bars: the station's dark, not
  // Android's default white (which would hide the white status-bar icons).
  writeFileSync(join(res, 'values', 'reactor_colors.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="reactor_bg">#070B16</color>\n</resources>\n');
  const styles = join(res, 'values', 'styles.xml');
  let xml = readFileSync(styles, 'utf8');
  if (!xml.includes('reactor_bg')) {
    xml = xml.replace(
      /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
      `$1
        <item name="android:windowBackground">@color/reactor_bg</item>
        <item name="android:statusBarColor">@color/reactor_bg</item>
        <item name="android:navigationBarColor">@color/reactor_bg</item>
        <item name="android:windowLightStatusBar">false</item>`,
    );
    writeFileSync(styles, xml);
  }
  console.log('\nThe Android Studio project is ready: android/');

  if (flag('--apk')) {
    if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT && !existsSync(join(root, 'android', 'local.properties'))) {
      console.error('\nBuilding the APK needs the Android SDK: install Android Studio (https://developer.android.com/studio), open it once, then run this again.');
      console.error('Or open the project in Android Studio and press Run: npx cap open android');
      process.exit(1);
    }
    sh(win ? 'gradlew.bat' : './gradlew', ['assembleDebug', '--no-daemon', '-q'], join(root, 'android'));
    const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    copyFileSync(apk, join(root, 'Reactor-Quest.apk'));
    console.log('\nBuilt Reactor-Quest.apk: copy it to your Android phone and open it to install.');
  }
  if (flag('--open')) cap('open', 'android');
}
