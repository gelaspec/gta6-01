// Save: money, mission progress, packages and REP in localStorage.
// Loading a save never blocks the game — a bad or missing save just
// starts a fresh story.

const KEY = 'meridian-bay-save-v3';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function makeSaveApi(G) {
  return {
    save() {
      try {
        const data = {
          money: Math.round(G.money),
          rep: G.rep,
          missionIndex: G.missions.currentIndex,
          packagesFound: G.missions.packagesFound,
          packagesTaken: G.missions.packages.map((p) => p.taken),
          heat: G.missions.heat,
          clockMinutes: Math.round(G.clockMinutes),
          savedAt: Date.now(),
        };
        window.localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        // Storage may be unavailable in some contexts; the game goes on.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        // Ignore.
      }
    },
  };
}
