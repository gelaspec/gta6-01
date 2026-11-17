// Keyboard and mouse input. Held keys give a move direction; one-shot presses
// (start, pause, enter car, punch, camera) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted
// twice. Mouse movement steers the third-person camera while the pointer is
// locked; a click fires the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_CAMERA = 16;
export const ACTION_MUTE = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const CAMERA = new Set(['KeyC']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let fireQueued = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
        event.preventDefault();
      }
      return;
    }
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || RUN.has(event.code) || JUMP.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (CAMERA.has(event.code)) actions |= ACTION_CAMERA;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX;
    mouseDY += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (!locked && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be refused (headless, iframe): the game still plays.
      }
    }
    fireQueued = true;
  });

  function has(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Normalised move input: x = strafe right, z = forward. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const z = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
      const len = Math.hypot(x, z);
      if (len === 0) return { x: 0, z: 0 };
      return { x: x / len, z: z / len };
    },
    run() {
      return has(RUN);
    },
    jumpHeld() {
      return has(JUMP);
    },
    handbrake() {
      return has(JUMP);
    },
    /** Mouse look since the last call, in pixels. */
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    /** True once per click, until taken. */
    takeFire() {
      const fired = fireQueued;
      fireQueued = false;
      return fired;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() {
      return locked;
    },
  };
}
