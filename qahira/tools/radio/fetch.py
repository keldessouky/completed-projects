#!/usr/bin/env python3
"""Puts the radio's stations on the air from YouTube: each station's playlists or channels, fetched as MP3s into its
own folder in the radio folder beside the pack, numbered in the order they aired, which is the order the game plays.

    python3 tools/radio/fetch.py                                   # every station in stations.json -> ./radio/<name>/
    python3 tools/radio/fetch.py --station "Radio Kafr El-Sheikh"  # just one of them
    python3 tools/radio/fetch.py "https://www.youtube.com/playlist?list=..." --station "Nile FM"   # a link, once

A station is an entry in stations.json (beside this script): its name, which is the folder's name and what the game
shows, its YouTube links (playlists, channels or videos, played in the order given), and the order of each link's
videos ("auto": a channel oldest first, a playlist as listed; or "listed", "reversed"). To add a station, add an
entry and run this again. The game finds the new folder by itself.

Run it again to fetch only the episodes that are new. The numbers already given are kept (a manifest,
.youtube.json, sits in each station's folder; the game skips files whose names start with a dot), so each station's
place in its show stays where it was.

Needs yt-dlp, ffmpeg and a JavaScript runtime for yt-dlp (deno, or node). On the RP6 all three run in Termux; see
docs/PLAY.md. Only for the owner's show, or other audio you have the right to download.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = 'Radio Kafr El-Sheikh'
MANIFEST = '.youtube.json'
CHANNEL = re.compile(r'youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+|user/[^/?#]+)/?(\w+)?/?$')


def yt_dlp():
    if shutil.which('yt-dlp'):
        cmd = ['yt-dlp']
    else:
        try:
            import yt_dlp  # noqa: F401
            cmd = [sys.executable, '-m', 'yt_dlp']
        except ImportError:
            sys.exit('yt-dlp not found: pip install -U "yt-dlp[default]"')
    # YouTube needs a JavaScript runtime; yt-dlp looks only for deno unless told of another
    if not shutil.which('deno'):
        for rt in ('node', 'bun'):
            if shutil.which(rt):
                cmd += ['--js-runtimes', rt]
                break
    return cmd


def safe_name(text, fallback):
    """A file or folder name the SD card takes (Android's and Windows' file systems refuse <>:"/\\|?*), in the
    characters the game's font has: "Episode 3: The Canal" -> "Episode 3 - The Canal"."""
    text = re.sub(r'\s*:\s*', ' - ', text)
    text = re.sub(r'[<>"/\\|?*\x00-\x1f]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip(' .-') or fallback


def channel_videos(url):
    """A channel's home page lists its tabs, not its videos: point it at the Videos tab."""
    m = CHANNEL.search(url.split('?')[0])
    if not m:
        return url, False
    return (url if m.group(2) else url.rstrip('/') + '/videos'), True


def listing(ytdlp, url, order):
    """The videos at a link as (id, title), in airing order."""
    url, is_channel = channel_videos(url)
    r = subprocess.run(ytdlp + ['--flat-playlist', '-J', '--no-warnings', url], capture_output=True, text=True)
    if r.returncode != 0:
        print(f'    cannot list {url}: {(r.stderr.strip().splitlines() or ["?"])[-1]}')
        return None
    out = []

    def walk(e):
        if e.get('entries') is not None:
            for c in e['entries']:
                if c:
                    walk(c)
        elif e.get('id') and e.get('ie_key', 'Youtube') == 'Youtube':
            out.append((e['id'], e.get('title') or e['id']))

    walk(json.loads(r.stdout))
    if order == 'reversed' or (order == 'auto' and is_channel):
        out.reverse()   # a channel lists its newest first; a show starts at its first episode
    return out


def load_manifest(out_dir):
    try:
        with open(os.path.join(out_dir, MANIFEST), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'episodes': {}}


def save_manifest(out_dir, m):
    tmp = os.path.join(out_dir, MANIFEST + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    os.replace(tmp, os.path.join(out_dir, MANIFEST))


def number(entries, manifest):
    """Episode numbers: the ones given before stay; new episodes follow on from the highest."""
    eps = manifest['episodes']
    nxt = max((e['n'] for e in eps.values()), default=0) + 1
    plan = []
    for vid, title in entries:
        if vid not in eps:
            eps[vid] = {'n': nxt, 'title': title}
            nxt += 1
        plan.append((eps[vid]['n'], vid, title))
    return plan


def fetch(ytdlp, n, vid, title, out_dir, tmp_dir, quality):
    r = subprocess.run(ytdlp + [
        '--no-playlist', '--no-progress', '--no-warnings', '--windows-filenames',
        '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', quality,
        '-P', f'home:{out_dir}', '-P', f'temp:{tmp_dir}',   # half-made files stay out of the station's folder
        '-o', f'{n} - %(title)s.%(ext)s',
        '--no-simulate', '--print', 'after_move:filepath',
        f'https://www.youtube.com/watch?v={vid}'], capture_output=True, text=True)
    path = r.stdout.strip().splitlines()[-1] if r.returncode == 0 and r.stdout.strip() else ''
    if not path or not os.path.isfile(path):
        return None, (r.stderr.strip().splitlines() or ['no file'])[-1]
    # the name the game shows, without the look-alike letters yt-dlp puts in place of : / ?: "12 - The Canal.mp3"
    name = f'{n} - {safe_name(title, vid)}.mp3'
    if os.path.basename(path) != name and not os.path.exists(os.path.join(out_dir, name)):
        os.replace(path, os.path.join(out_dir, name))
        path = os.path.join(out_dir, name)
    return os.path.basename(path), None


def station(ytdlp, st, out_root, quality, list_only):
    """Fetches one station's new episodes; returns (fetched, failed)."""
    name, links, order = st['name'], st.get('youtube') or [], st.get('order', 'auto')
    print(f'{name}')
    if not links:
        print('    no YouTube links yet: add them to its entry in stations.json')
        return 0, 0
    entries, seen = [], set()
    for link in links:
        got = listing(ytdlp, link, order)
        if got is None:
            return 0, 1
        entries += [e for e in got if e[0] not in seen and not seen.add(e[0])]
    out_dir = os.path.join(out_root, safe_name(name, 'Station'))
    manifest = load_manifest(out_dir)
    manifest['station'], manifest['youtube'] = name, links
    plan = number(entries, manifest)
    eps = manifest['episodes']
    have = lambda vid: eps[vid].get('file') and os.path.isfile(os.path.join(out_dir, eps[vid]['file']))
    todo = [p for p in plan if not have(p[1])]
    if list_only:
        for n, vid, title in plan:
            print(f'    {n:4}  {"have" if have(vid) else "new ":4}  {title}')
        return 0, 0
    print(f'    {len(plan)} episodes, {len(plan) - len(todo)} already here, {len(todo)} to fetch into {out_dir}')
    os.makedirs(out_dir, exist_ok=True)
    failed = 0
    with tempfile.TemporaryDirectory(prefix='qahira-radio-') as tmp:
        for i, (n, vid, title) in enumerate(todo, 1):
            print(f'    [{i}/{len(todo)}] {n} - {title}', flush=True)
            file, err = fetch(ytdlp, n, vid, title, out_dir, tmp, quality)
            if err:
                print(f'        skipped: {err}')   # private, members-only, a premiere yet to air...
                failed += 1
                continue
            eps[vid]['file'] = file
            save_manifest(out_dir, manifest)   # after each one, so a stopped run keeps what it fetched
    save_manifest(out_dir, manifest)
    return len(todo) - failed, failed


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0], epilog=__doc__.split('\n\n', 1)[1],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('url', nargs='?', help='a YouTube playlist, channel or video, instead of stations.json')
    ap.add_argument('--station', help=f'which station (default: all of them; with a link, {HOME})')
    ap.add_argument('--stations', default=os.path.join(HERE, 'stations.json'), help='the list of stations')
    ap.add_argument('--out', default='radio', help='the radio folder beside Qahira.qpk (default: ./radio)')
    ap.add_argument('--order', choices=['auto', 'listed', 'reversed'], default='auto', help='with a link: its order')
    ap.add_argument('--quality', default='5', help="yt-dlp's --audio-quality: 0 (best) to 10, or a bitrate like 96K")
    ap.add_argument('--list', action='store_true', help='show the episodes and their numbers, fetch nothing')
    a = ap.parse_args()

    if a.url:
        stations = [{'name': a.station or HOME, 'youtube': [a.url], 'order': a.order}]
    else:
        try:
            with open(a.stations, encoding='utf-8') as f:
                stations = json.load(f)['stations']
        except (OSError, ValueError, KeyError) as e:
            sys.exit(f'cannot read {a.stations}: {e}')
        if a.station:
            stations = [s for s in stations if s['name'].lower() == a.station.lower()]
            if not stations:
                sys.exit(f'no station named {a.station} in {a.stations}')

    ytdlp = yt_dlp()
    if not a.list and not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found: it turns the downloads into MP3s')
    fetched = failed = 0
    for st in stations:
        f, x = station(ytdlp, st, a.out, a.quality, a.list)
        fetched, failed = fetched + f, failed + x
    if not a.list:
        print(f'done: {fetched} fetched' + (f', {failed} skipped (run again to retry)' if failed else ''))
    sys.exit(1 if failed and not fetched else 0)


if __name__ == '__main__':
    main()
