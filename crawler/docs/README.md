# docs/ — the playable build

`play.html` is the whole game in one file: code, both fonts, the audio sprite
and all 23 character sheets inlined. It makes zero network requests once
loaded.

It lives here, committed, for one reason: **a local file is not openable on
iOS.** Tapping a downloaded `.html` in Files gives you a preview that will not
run it, and Safari has no way to browse to a local path. Serving the same bytes
over http sidesteps the whole problem, and `docs/` is also the folder GitHub
Pages deploys from — so enabling Pages on this repo needs no file moved.

Regenerate it after any change:

```bash
npm run build && npm run build:single
cp dist-single/crawler.html docs/play.html
```

It is a build artifact under version control, which is normally a smell. The
justification is that it is the *deliverable* — the thing a player is handed —
and hosting it is the only way to hand it to a phone.

Verify it before committing a new one:

```bash
npm run smoke:file    # opens it from file:// and checks the engine starts
```
