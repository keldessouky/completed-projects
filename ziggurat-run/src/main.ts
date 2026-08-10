import './assets/fonts'; // side-effect: registers the OFL @font-face rules
import { Game } from './core/game';
import { SceneManager } from './scenes/scene';
import { BootScene } from './scenes/boot';
import { TitleScene } from './scenes/title';
import { MapScene } from './scenes/map';
import { UpgradeScene } from './scenes/upgrade';
import { RunScene } from './scenes/run/runscene';
import { FailScene, ResultsScene, VictoryScene } from './scenes/endings';
import { DevOverlay } from './ui/devoverlay';

async function boot(): Promise<void> {
  const game = await Game.create();
  const scenes = new SceneManager(game);
  scenes.register('boot', (ctx) => new BootScene(ctx));
  scenes.register('title', (ctx) => new TitleScene(ctx));
  scenes.register('map', (ctx) => new MapScene(ctx));
  scenes.register('upgrade', (ctx) => new UpgradeScene(ctx));
  scenes.register('run', (ctx) => new RunScene(ctx));
  scenes.register('results', (ctx) => new ResultsScene(ctx));
  scenes.register('fail', (ctx) => new FailScene(ctx));
  scenes.register('victory', (ctx) => new VictoryScene(ctx));
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
      'The city gates stayed shut — this browser could not start the game.<br>' +
      '<small style="opacity:0.7">WebGL is required. Tap to try again.</small></div>';
    splash.style.pointerEvents = 'auto';
    splash.addEventListener('pointerdown', () => location.reload());
  }
});
