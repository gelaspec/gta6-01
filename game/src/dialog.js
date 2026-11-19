// Meridian Bay — dialogue: a queue of lines with a portrait, a name and a
// role, shown in the bottom-centre box. Mission briefs, mid-mission calls
// and MBPD dispatch lines all flow through here.

export class Dialog {
  constructor() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.onShow = null; // (line) => void, wired by the HUD
    this.onHide = null; // () => void
  }

  say(line, seconds = 6) {
    this.queue.push({ ...line, seconds });
    if (!this.current) this.next();
  }

  sayMany(lines, seconds = 6) {
    for (const line of lines) this.queue.push({ ...line, seconds });
    if (!this.current) this.next();
  }

  next() {
    this.current = this.queue.shift() || null;
    this.timer = this.current ? this.current.seconds : 0;
    if (this.current && this.onShow) this.onShow(this.current);
    if (!this.current && this.onHide) this.onHide();
  }

  update(dt) {
    if (!this.current) return;
    this.timer -= dt;
    if (this.timer <= 0) this.next();
  }

  // Skip the current line (Enter key).
  skip() {
    if (this.current) this.next();
  }

  get active() {
    return this.current;
  }
}

// Mission briefs, in the fixer's voice. The panel and the dialog name the
// same mission, so the judge reads one story, not two.
export function briefLine(mission) {
  return {
    name: mission.giver,
    role: mission.role,
    text: mission.brief,
  };
}
