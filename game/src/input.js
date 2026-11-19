// Keyboard + mouse input. Tracks held keys and per-frame "just pressed"
// edges so menus, car entry and the handbrake feel responsive.

export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR', 'KeyC', 'KeyT', 'KeyQ',
    'KeyM', 'Escape', 'Enter',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      keys.add(e.code);
      pressed.add(e.code);
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    pressed.add('Mouse0');
  }
  function onMouseUp() {
    dragging = false;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onBlur() {
    keys.clear();
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', onBlur);

  return {
    get keys() {
      return keys;
    },
    isDown(code) {
      return keys.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    // WASD / arrows as a -1..1 pair, already camera-relative at the caller.
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    get mouseDX() {
      return mouseDX;
    },
    get mouseDY() {
      return mouseDY;
    },
    get dragging() {
      return dragging;
    },
    anyKey() {
      return pressed.size > 0;
    },
    endFrame() {
      pressed.clear();
      mouseDX = 0;
      mouseDY = 0;
    },
  };
}
