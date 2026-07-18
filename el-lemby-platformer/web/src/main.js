// Boot: decode sprites, build the canvas, run the fixed-step loop, and
// route scenes. `?demo=1` jumps straight into the attract-mode bot demo
// (also used for headless screenshot verification in CI/dev).

import { CFG } from "./config.js";
import { loadSprites } from "./render.js";
import { GameAudio } from "./audio.js";
import { GameState, TitleScene, GameScene } from "./scenes.js";
import { setupInput } from "./input.js";

const STEP = 1 / 60;

async function boot() {
  await loadSprites();

  const stageEl = document.getElementById("ellemby") ?? document.body;
  const canvas = document.createElement("canvas");
  canvas.width = CFG.sceneW;
  canvas.height = CFG.sceneH;
  canvas.id = "game";
  stageEl.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const host = {
    audio: new GameAudio(),
    state: new GameState(),
    scene: null,
    now: 0,
    switch(scene) {
      host.scene = scene;
    },
    inputState: new Set(),
  };

  const params = new URLSearchParams(location.search);
  host.scene = params.get("demo")
    ? new GameScene(host, Number(params.get("stage") || 1), { demo: true })
    : new TitleScene(host);

  setupInput(host, () => {
    host.audio.ensure();
    host.audio.startMusic();
  });

  // Fit the canvas to the window, preferring crisp integer scales.
  const fit = () => {
    const availW = stageEl.clientWidth || window.innerWidth;
    const availH = window.innerHeight;
    let scale = Math.min(availW / CFG.sceneW, availH / CFG.sceneH);
    if (scale >= 1) {
      scale = Math.max(1, Math.floor(scale * 2) / 2); // whole and half steps
    }
    canvas.style.width = `${Math.floor(CFG.sceneW * scale)}px`;
    canvas.style.height = `${Math.floor(CFG.sceneH * scale)}px`;
  };
  window.addEventListener("resize", fit);
  fit();

  let last = performance.now() / 1000;
  let acc = 0;
  const frame = () => {
    const t = performance.now() / 1000;
    acc += Math.min(t - last, 0.1);
    last = t;
    while (acc >= STEP) {
      acc -= STEP;
      host.now += STEP;
      host.scene.update(STEP, host.now);
    }
    host.scene.draw(ctx, host.now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  const msg = document.createElement("pre");
  msg.textContent = "تعذّر تشغيل اللعبة:\n" + (err?.stack ?? String(err));
  msg.style.color = "#f3ece0";
  document.body.appendChild(msg);
});
