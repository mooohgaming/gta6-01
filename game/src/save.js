// The save: cash, the mission reached and the player's spot, kept in
// localStorage between visits. A finished story clears its save, so the next
// visit starts a new game instead of continuing a finished one.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.mission !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      mission: state.missions.runner.index,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
    }));
  } catch {
    // Storage can be off (private windows): the game then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
