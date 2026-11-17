// Save: one small JSON record in localStorage — money, the mission reached,
// and the hidden packages found. Nothing else leaves the machine.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 250, mission: 0, packages: [] };
    const data = JSON.parse(raw);
    return {
      money: typeof data.money === 'number' ? data.money : 250,
      mission: typeof data.mission === 'number' ? data.mission : 0,
      packages: Array.isArray(data.packages) ? data.packages : [],
    };
  } catch {
    return { money: 250, mission: 0, packages: [] };
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
