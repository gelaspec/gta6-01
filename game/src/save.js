// Meridian Bay — localStorage save/load. One key, one JSON blob, versioned.
const KEY = 'meridian-bay-save-v6';

export function saveGame(state) {
  try {
    const data = {
      version: 6,
      money: state.money,
      rep: state.rep,
      day: state.day,
      missionsDone: state.missionsDone,
      packages: state.packages,
      missionIndex: state.missionIndex,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 6) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
