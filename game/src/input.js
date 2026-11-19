// input.js — keyboard state, one-shot key events, mouse drag orbit + wheel
// selection, and pointer position for the weapon wheel.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // one-shot, consumed by main each frame
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseX = innerWidth / 2; this.mouseY = innerHeight / 2;
    this.mouseDown = false; this.clicked = false;
    addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => { this.mouseDown = true; this.clicked = true; this._lx = e.clientX; this._ly = e.clientY; });
    addEventListener('mouseup', () => { this.mouseDown = false; });
    addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      if (this.mouseDown) { this.mouseDX += e.clientX - (this._lx ?? e.clientX); this.mouseDY += e.clientY - (this._ly ?? e.clientY); }
      this._lx = e.clientX; this._ly = e.clientY;
    });
  }
  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  take(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  takeClick() { const c = this.clicked; this.clicked = false; return c; }
  consumeDrag() { const d = { x: this.mouseDX, y: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return d; }
  moveVector() {
    let x = 0, z = 0;
    if (this.down('KeyW', 'ArrowUp')) z -= 1;
    if (this.down('KeyS', 'ArrowDown')) z += 1;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    return { x, z };
  }
}
