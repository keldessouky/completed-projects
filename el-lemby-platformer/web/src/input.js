// Keyboard (physical key codes — identical on Arabic layouts) plus
// on-screen touch controls for phones and tablets.

const GAME_CODES = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space",
  "KeyA", "KeyD", "KeyW", "KeyP", "KeyM", "Escape", "Enter",
]);

export function setupInput(host, onFirstGesture) {
  const pressed = new Set();
  host.inputState = pressed;
  let gestured = false;

  const gesture = () => {
    if (!gestured) {
      gestured = true;
      onFirstGesture();
    }
  };

  window.addEventListener("keydown", (e) => {
    if (!GAME_CODES.has(e.code)) {
      return;
    }
    e.preventDefault();
    gesture();
    if (pressed.has(e.code)) {
      return; // auto-repeat
    }
    pressed.add(e.code);
    host.scene.keyPressed(e.code, host.now);
  });

  window.addEventListener("keyup", (e) => {
    if (!GAME_CODES.has(e.code)) {
      return;
    }
    pressed.delete(e.code);
    host.scene.keyReleased(e.code, host.now);
  });

  // --- touch buttons ------------------------------------------------------

  const coarse =
    typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (!coarse && !("ontouchstart" in window)) {
    return;
  }

  const pad = document.createElement("div");
  pad.id = "touchpad";
  const mkButton = (label, code, side) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = `tbtn ${side}`;
    b.setAttribute("aria-label", code);
    const down = (e) => {
      e.preventDefault();
      gesture();
      if (!pressed.has(code)) {
        pressed.add(code);
        host.scene.keyPressed(code, host.now);
      }
    };
    const up = (e) => {
      e.preventDefault();
      pressed.delete(code);
      host.scene.keyReleased(code, host.now);
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.appendChild(b);
    return b;
  };

  mkButton("→", "ArrowRight", "right2");
  mkButton("←", "ArrowLeft", "right1");
  mkButton("نط", "Space", "left1");
  document.body.appendChild(pad);
}
