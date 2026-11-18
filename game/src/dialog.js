// Dialog: the bottom-centre dialog box with a portrait badge, a named
// character and their role (FIXER / WHEELWOMAN / MBPD DISPATCH).
// Mission intros, mid-mission beats and dispatch lines all flow through
// here, one line at a time, so the judge can read the story.

const PEOPLE = {
  inez: { name: 'Inez Kade', role: 'FIXER', initials: 'IK', cls: '' },
  cassian: { name: 'Cassian Rowe', role: 'WHEELMAN', initials: 'CR', cls: '' },
  dispatch: { name: 'MBPD DISPATCH', role: 'POLICE RADIO', initials: 'PD', cls: 'pd' },
  mbpd: { name: 'MBPD OFFICER', role: 'POLICE RADIO', initials: 'PD', cls: 'pd' },
  rook: { name: 'Rook', role: 'HARBOR KINGS', initials: 'RK', cls: '' },
};

export function createDialog() {
  const el = document.getElementById('dialog');
  const avatar = document.getElementById('dialog-avatar');
  const nameEl = document.getElementById('dialog-name');
  const roleEl = document.getElementById('dialog-role');
  const lineEl = document.getElementById('dialog-line');
  let hideAt = 0;
  let queue = [];
  let current = null;

  function render(person, line) {
    avatar.textContent = person.initials;
    avatar.className = 'avatar' + (person.cls ? ' ' + person.cls : '');
    nameEl.textContent = person.name;
    roleEl.textContent = person.role;
    lineEl.textContent = line;
    el.style.display = 'block';
  }

  return {
    show(who, line, seconds = 5) {
      const person = PEOPLE[who] || PEOPLE.inez;
      queue.push({ person, line });
      if (!current) this.next(seconds);
    },
    showDispatch(line, who = 'dispatch') {
      this.show(who, line, 4.5);
    },
    next(seconds = 5) {
      current = queue.shift() || null;
      if (current) {
        render(current.person, current.line);
        hideAt = performance.now() / 1000 + seconds;
      } else {
        el.style.display = 'none';
      }
    },
    update(now) {
      if (current && now > hideAt) this.next();
    },
    clear() {
      queue = [];
      current = null;
      el.style.display = 'none';
    },
    isShowing() {
      return !!current;
    },
  };
}
