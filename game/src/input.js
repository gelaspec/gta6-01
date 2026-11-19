// Meridian Bay — keyboard + mouse input (edge detection for single-press keys).
export function createInput() {
  const keys = {};
  const pressed = {}; // keys pressed this frame (cleared by endFrame)
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let clicked = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (dragging && performance.now() - downAt < 250
      && Math.hypot(e.clientX - downX, e.clientY - downY) < 6
      && !e.target.closest('button')) {
      clicked = true;
    }
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  return {
    down(code) { return !!keys[code]; },
    hit(code) { return !!pressed[code]; },
    axis() {
      // returns {x: strafe -1..1, y: forward -1..1} from WASD + arrows
      let x = 0;
      let y = 0;
      if (keys.KeyW || keys.ArrowUp) y += 1;
      if (keys.KeyS || keys.ArrowDown) y -= 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      return { x, y };
    },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    // true once per quick click (mouse down + up, barely moved)
    takeClick() {
      const c = clicked;
      clicked = false;
      return c;
    },
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
    },
  };
}
