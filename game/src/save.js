// Meridian Bay — save: one localStorage slot for money, mission progress,
// packages and reputation. Everything is guarded: a missing or blocked
// store simply means a fresh run.

const KEY = 'meridian-bay-save-v7';

export class Save {
  static load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return {
        money: Number(data.money) || 0,
        mission: Number(data.mission) || 0,
        packages: Number(data.packages) || 0,
        rep: Number(data.rep) || 0,
        best: Number(data.best) || 0,
      };
    } catch {
      return null;
    }
  }

  static store(state) {
    try {
      const data = {
        money: Math.round(state.money),
        mission: state.mission,
        packages: state.packages,
        rep: Math.round(state.rep),
        best: Math.round(state.best),
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  static clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch { /* no store, nothing to clear */ }
  }
}
