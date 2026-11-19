// Save: money, missions finished, hidden packages and the best REP,
// persisted in localStorage. Every call is guarded — file:// and private
// modes can refuse storage, and the game must keep working anyway.

const KEY = 'meridian-bay-save-v1';

export function defaultSave() {
  return { money: 250, missionsDone: [], packages: [], rep: 0, day: 1, best: 0 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    return { ...defaultSave(), ...data };
  } catch {
    return defaultSave();
  }
}

export function saveSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
