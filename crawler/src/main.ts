import './assets/fonts'; // side-effect: registers the OFL @font-face rules
import { Game } from './core/game';
import { SceneManager } from './scenes/scene';
import { BootScene } from './scenes/boot';
import { TitleScene } from './scenes/title';
import { WorldScene } from './scenes/world/world';
import { DeathScene } from './scenes/death';
import { DevOverlay } from './ui/devoverlay';

async function boot(): Promise<void> {
  const game = await Game.create();
  const scenes = new SceneManager(game);
  scenes.register('boot', (ctx) => new BootScene(ctx));
  scenes.register('title', (ctx) => new TitleScene(ctx));
  scenes.register('world', (ctx) => new WorldScene(ctx));
  scenes.register('death', (ctx) => new DeathScene(ctx));
  new DevOverlay(game);

  scenes.goto('boot');
  // the DOM splash dissolves once the engine has painted its first frame
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
      '<div style="max-width:280px;text-align:center;letter-spacing:0.05em;line-height:1.5">' +
      'The floor did not open — this browser could not start the game.<br>' +
      '<small style="opacity:0.7">WebGL is required. Tap to try again.</small></div>';
    splash.style.pointerEvents = 'auto';
    splash.addEventListener('pointerdown', () => location.reload());
  }
});
