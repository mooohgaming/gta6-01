// The save: the furthest mission reached and the cash held when it was
// reached, plus the best story cash, kept in localStorage between visits.

import { BEST_KEY, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.mission !== 'number' || typeof save.cash !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function writeSave(mission, cash) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ mission, cash, at: Date.now() }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

export function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}
