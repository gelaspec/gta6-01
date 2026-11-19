// Meridian Bay — raw keyboard + mouse state. One place owns the listeners;
// the systems read held keys and edge-triggered presses each frame.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set(); // edge-triggered, cleared each frame
    this.mouseDown = false;
    this.mouseClicked = false; // edge-triggered
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.enabled = true;
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      this.mouseDown = true;
      this.dragging = true;
      if (e.button === 0) this.mouseClicked = true;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
      this.dragging = false;
    };
    this._onMouseMove = (e) => {
      if (this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this.dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  clicked() {
    return this.mouseClicked;
  }

  // WASD / arrows as a -1..1 pair, in camera space.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  // Call at the end of every frame: edges live for exactly one frame.
  endFrame() {
    this.pressedKeys.clear();
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }
}
