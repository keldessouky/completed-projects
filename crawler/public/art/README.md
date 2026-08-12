# public/art/

Drop custom character sheets here to replace the game's own painted art.

This folder is empty on purpose. With no `manifest.json` in it the game uses
the sprites it draws in code, which is why it ships as one file with no assets.

Full walkthrough: [Replacing the character art](../../README.md#replacing-the-character-art)

Quick version:

```bash
npm run build && npm run art:export   # → art-template/, correctly sized sheets
cp art-template/hero.png art-template/manifest.json public/art/
# repaint public/art/hero.png, keeping its exact pixel size
npm run art:check                     # verifies every sheet before you reload
npm run dev
```
