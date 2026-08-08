import './assets/fonts'; // side-effect: registers the OFL @font-face rules
import { Game } from './core/game';
import { SceneManager } from './scenes/scene';
import { BootScene } from './scenes/boot';
import { ResultsScene, ShopScene, TitleScene } from './scenes/menus';
import { RunScene } from './scenes/run';
import { DevOverlay } from './ui/devoverlay';

async function boot(): Promise<void> {
  const game = await Game.create();
  const scenes = new SceneManager(game);
  scenes.register('boot', (ctx) => new BootScene(ctx));
  scenes.register('title', (ctx) => new TitleScene(ctx));
  scenes.register('run', (ctx) => new RunScene(ctx));
  scenes.register('results', (ctx) => new ResultsScene(ctx));
  scenes.register('shop', (ctx) => new ShopScene(ctx));
  new DevOverlay(game);

  scenes.goto('boot');
  requestAnimationFrame(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 300);
    }
  });
}

boot().catch((err) => {
  console.error('fatal boot error', err);
  const splash = document.getElementById('splash');
  if (splash) {
    splash.innerHTML =
      '<div style="max-width:300px;text-align:center;line-height:1.5">'
      + 'The realm would not load — this browser could not start the game.<br>'
      + '<small style="opacity:0.7">WebGL is required. Tap to try again.</small></div>';
    splash.style.pointerEvents = 'auto';
    splash.addEventListener('pointerdown', () => location.reload());
  }
});
