// Keyboard + mouse input. Keys are tracked by code so layouts do not
// matter; mouse drag orbits the camera, click shoots when armed.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDown: false,
    mouseClicked: false,
    dragX: 0,
    dragY: 0,
    dragging: false,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.dragging = false;
  });

  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.mouseClicked = true;
    input.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.dragX += e.clientX - lastX;
    input.dragY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function isDown(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}

export function endFrame(input) {
  input.pressed.clear();
  input.mouseClicked = false;
  input.dragX = 0;
  input.dragY = 0;
}
