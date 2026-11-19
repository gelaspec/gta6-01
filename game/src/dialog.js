// Meridian Bay — dialog: portrait + name + line. Portraits are drawn on a
// small canvas per character (face shape, hair, signature colour), so the
// dialog reads as a real conversation, not a bare subtitle.
import { CONFIG } from './config.js';

const PORTRAITS = {
  'Inez Kade': { skin: '#d9a066', hair: '#1c1c22', hairStyle: 'bob', accent: '#ff2e88', bg: '#2a1c2e' },
  'Cassian Rowe': { skin: '#d9a066', hair: '#241a12', hairStyle: 'short', accent: '#2e6f5e', bg: '#1c2a26' },
  'MBPD Dispatch': { skin: '#e8b98a', hair: '#3a3a3a', hairStyle: 'cap', accent: '#1c4fd6', bg: '#141c2e' },
  Rook: { skin: '#8a5a34', hair: '#0d0d0d', hairStyle: 'mohawk', accent: '#d43a2e', bg: '#2e1414' },
};

function drawPortrait(name) {
  const p = PORTRAITS[name] || PORTRAITS['Cassian Rowe'];
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = p.bg;
  g.fillRect(0, 0, 96, 96);
  // shoulders
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(8, 96);
  g.quadraticCurveTo(48, 58, 88, 96);
  g.closePath();
  g.fill();
  // face
  g.fillStyle = p.skin;
  g.beginPath();
  g.ellipse(48, 52, 22, 26, 0, 0, Math.PI * 2);
  g.fill();
  // hair
  g.fillStyle = p.hair;
  if (p.hairStyle === 'bob') {
    g.beginPath();
    g.ellipse(48, 34, 24, 16, 0, Math.PI, 0);
    g.fill();
    g.fillRect(24, 34, 8, 26);
    g.fillRect(64, 34, 8, 26);
  } else if (p.hairStyle === 'cap') {
    g.beginPath();
    g.ellipse(48, 36, 23, 12, 0, Math.PI, 0);
    g.fill();
    g.fillRect(22, 34, 52, 7);
  } else if (p.hairStyle === 'mohawk') {
    g.fillRect(44, 8, 8, 26);
  } else {
    g.beginPath();
    g.ellipse(48, 34, 23, 12, 0, Math.PI, 0);
    g.fill();
  }
  // eyes
  g.fillStyle = '#1c1c22';
  g.beginPath();
  g.ellipse(40, 52, 3, 4, 0, 0, Math.PI * 2);
  g.ellipse(56, 52, 3, 4, 0, 0, Math.PI * 2);
  g.fill();
  // mouth
  g.strokeStyle = '#7a3a22';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(42, 68);
  g.quadraticCurveTo(48, 72, 54, 68);
  g.stroke();
  return c.toDataURL('image/png');
}

export function createDialog() {
  const box = document.getElementById('dialog');
  const portrait = document.getElementById('dialog-portrait');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  const cache = {};
  let queue = [];
  let current = null;
  let hideT = 0;

  function portraitFor(name) {
    if (!cache[name]) cache[name] = drawPortrait(name);
    return cache[name];
  }

  function show(name, role, text, seconds = 6) {
    queue.push({ name, role, text, seconds });
    if (!current) next();
  }
  function next() {
    current = queue.shift() || null;
    if (!current) {
      box.classList.add('hidden');
      return;
    }
    portrait.src = portraitFor(current.name);
    nameEl.textContent = `${current.name} — ${current.role}`;
    textEl.textContent = current.text;
    box.classList.remove('hidden');
    hideT = current.seconds;
  }
  function showNow(name, role, text, seconds = 6) {
    queue = [{ name, role, text, seconds }];
    current = null;
    next();
  }
  function update(dt) {
    if (!current) return;
    hideT -= dt;
    if (hideT <= 0) next();
  }
  function hide() {
    queue = [];
    current = null;
    box.classList.add('hidden');
  }
  return { show, showNow, update, hide };
}

// Short dispatch chatter lines the police radio cycles through.
export const DISPATCH_LINES = [
  'All units, suspect is heading east on Harbor Blvd.',
  'Unit 7, cut him off at the bridge. Unit 12, take the pier road.',
  'Air One is overhead. Suspect vehicle is hot pink — you cannot miss it.',
  'Roadblock set up on Marina Way. All units, Code 3.',
  'Suspect is armed. Approach with caution.',
  'Dispatch to all units: do NOT let him reach the pier.',
];
