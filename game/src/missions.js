// The six-mission story arc. The full playthrough pays exactly $1,980 on top
// of the $120 the player starts with: 120 + 180 + 300 + 320 + 460 + 600.
// Each mission has a name, a short objective line, and stages that advance on
// reaching a place, stealing a car, losing the law, winning a fight, or
// cracking the casino vault.

import { LANDMARKS, MISSION_PAYOUTS } from './config.js';

export const MISSION_DEFS = [
  {
    name: 'Cafe Job',
    text: 'Meet Rosa at the cafe, then collect the package at the mall.',
    stages: [
      { target: LANDMARKS.cafe, radius: 80 },
      { target: LANDMARKS.mall, radius: 80 },
    ],
  },
  {
    name: 'Pizza Run',
    text: 'Deliver three pizzas across town — fast, they are getting cold.',
    stages: [
      { target: { x: 600, y: 860 }, radius: 80 },
      { target: { x: 1400, y: 520 }, radius: 80 },
      { target: { x: 2200, y: 1540 }, radius: 80 },
    ],
  },
  {
    name: 'Grand Theft Comet',
    text: 'Steal the red Comet GT and park it at the casino garage.',
    stages: [
      { target: { x: 2200, y: 1330 }, radius: 80, needComet: true },
      { target: LANDMARKS.casino, radius: 90, needComet: true },
    ],
  },
  {
    name: 'Lose the Tail',
    text: 'Three stars on you. Outrun the law until the heat dies.',
    stages: [{ loseHeat: true }],
  },
  {
    name: 'Turf War',
    text: 'Eight Vultures hold the mall. Take it back.',
    stages: [{ clearVultures: true }],
  },
  {
    name: 'The Golden Palm',
    text: 'Crack the casino vault, then get back to the cafe safehouse.',
    stages: [
      { target: LANDMARKS.casino, radius: 90 },
      { target: LANDMARKS.casino, radius: 90, channel: 3.5 },
      { target: LANDMARKS.cafe, radius: 90 },
    ],
  },
];

export function createMissions() {
  return { runner: { index: 0, stage: 0, channel: 0, done: false } };
}

/**
 * Advance the story. `hooks` is what the world supplies: crime(n) to raise
 * the heat, spawnVultures() for the turf war, and a payout callback.
 * Returns the mission that just completed, or null.
 */
export function updateMissions(state, hooks, dt) {
  const runner = state.missions.runner;
  if (runner.done || state.over) return null;
  const def = MISSION_DEFS[runner.index];
  const stage = def.stages[runner.stage];
  const player = state.player;

  if (stage.loseHeat) {
    if (player.wanted === 0) return completeMission(state, hooks);
    return null;
  }
  if (stage.clearVultures) {
    if (!state.people.some((p) => p.kind === 'vulture')) return completeMission(state, hooks);
    return null;
  }
  const d = Math.hypot(stage.target.x - player.x, stage.target.y - player.y);
  if (stage.needComet && (!player.inCar || player.inCar.kind !== 'comet')) return null;
  if (stage.channel !== undefined) {
    // The vault only cracks while the player sits still inside the radius.
    const speed = Math.abs(player.speed || 0);
    if (d < stage.radius && speed < 40) {
      runner.channel += dt;
      if (runner.channel >= stage.channel) {
        runner.channel = 0;
        runner.stage += 1;
        hooks.crime(4);
        return null;
      }
    } else {
      runner.channel = Math.max(0, runner.channel - dt);
    }
    return null;
  }
  if (d < stage.radius) {
    runner.stage += 1;
    if (runner.stage >= def.stages.length) return completeMission(state, hooks);
  }
  return null;
}

function completeMission(state, hooks) {
  const runner = state.missions.runner;
  const payout = MISSION_PAYOUTS[runner.index];
  state.player.cash += payout;
  const finished = { index: runner.index, name: MISSION_DEFS[runner.index].name, payout };
  runner.index += 1;
  runner.stage = 0;
  runner.channel = 0;
  if (runner.index >= MISSION_DEFS.length) {
    runner.done = true;
    state.over = 'complete';
  } else {
    startMission(state, hooks);
  }
  hooks.onMissionComplete?.(finished);
  return finished;
}

/** The per-mission setup that runs when a mission starts. */
export function startMission(state, hooks) {
  const runner = state.missions.runner;
  if (runner.index === 3) hooks.crime(3);
  if (runner.index === 4) hooks.spawnVultures();
}
