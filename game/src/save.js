// Save and continue, in localStorage: cash, missions done, where the
// player stands, and the story's place. A save the browser refuses (a
// private window) simply does not last between visits.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash,
      missionsDone: state.player.missionsDone,
      missionIndex: state.missions.manager.index,
      storyDone: state.missions.manager.done,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionsDone !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
