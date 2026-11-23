// The six-mission story of Solmar Bay. The runner tracks which mission is live,
// which stop or stage it is on, and how far the vault channel has run. Completing
// a mission pays out at once; the sixth pays out and ends the story. The hooks
// let the world react when a mission starts (the tail, the turf war) or when the
// vault cracks (the four-star heat that follows).
import { MISSION_PAYOUTS } from './config.js';

const DEFS = [
  {
    name: 'Cafe Job',
    hint: 'Pick up the order at Mama Rosa\u2019s Cafe, then drop it at Sunset Mall.',
    stops: [
      { x: 1160, y: 1080, r: 90 },
      { x: 1600, y: 1150, r: 90 },
    ],
  },
  {
    name: 'Pizza Run',
    hint: 'Three drops, no dawdling: the mall corner, the north road, the east road.',
    stops: [
      { x: 600, y: 860, r: 90 },
      { x: 1400, y: 520, r: 90 },
      { x: 2200, y: 1540, r: 90 },
    ],
  },
  {
    name: 'Steal the Comet',
    hint: 'The red Comet GT is parked on the east road. Take it to the casino garage.',
    stops: [
      { x: 2240, y: 1330, r: 70, needComet: true },
      { x: 390, y: 460, r: 100 },
    ],
  },
  {
    name: 'Lose the Tail',
    hint: 'Three stars. Break line of sight until the heat dies down.',
  },
  {
    name: 'Turf War',
    hint: 'Eight Vultures hold the mall. Clear them out.',
  },
  {
    name: 'Golden Palm Heist',
    hint: 'Park at the casino and crack the vault, then get back to the cafe.',
    stops: [
      { x: 390, y: 460, r: 100 },
      { x: 1160, y: 1080, r: 100 },
    ],
    channelSeconds: 5,
  },
];

export function createMissions() {
  return {
    runner: { index: 0, stage: 0, channel: 0, stop: 0 },
    defs: DEFS,
  };
}

function completeMission(state, hooks) {
  const runner = state.missions.runner;
  const payout = MISSION_PAYOUTS[runner.index];
  state.player.cash += payout;
  runner.index += 1;
  runner.stage = 0;
  runner.channel = 0;
  runner.stop = 0;
  if (runner.index >= DEFS.length) {
    state.over = 'complete';
    return;
  }
  hooks.onMissionStart(runner.index);
}

function near(player, stop) {
  return Math.hypot(player.x - stop.x, player.y - stop.y) <= stop.r;
}

export function updateMissions(state, dt, hooks) {
  if (state.over) return;
  const runner = state.missions.runner;
  const def = DEFS[runner.index];
  if (!def) return;
  const player = state.player;

  if (runner.index === 0 || runner.index === 1) {
    const stop = def.stops[runner.stop];
    if (near(player, stop)) {
      runner.stop += 1;
      if (runner.stop >= def.stops.length) completeMission(state, hooks);
    }
    return;
  }

  if (runner.index === 2) {
    if (runner.stage === 0) {
      if (player.inCar && player.inCar.kind === 'comet') runner.stage = 1;
      return;
    }
    if (near(player, def.stops[1])) completeMission(state, hooks);
    return;
  }

  if (runner.index === 3) {
    if (player.wanted === 0) completeMission(state, hooks);
    return;
  }

  if (runner.index === 4) {
    if (!state.people.some((person) => person.kind === 'vulture')) completeMission(state, hooks);
    return;
  }

  // Mission 6: park at the casino, hold still to crack the vault, then run.
  if (runner.stage === 0) {
    if (player.inCar && near(player, def.stops[0])) runner.stage = 1;
    return;
  }
  if (runner.stage === 1) {
    const car = player.inCar;
    const still = car && Math.abs(car.speed) < 30;
    if (car && still && Math.hypot(player.x - def.stops[0].x, player.y - def.stops[0].y) <= 90) {
      runner.channel += dt;
      if (runner.channel >= def.channelSeconds) {
        runner.stage = 2;
        runner.channel = def.channelSeconds;
        hooks.onVaultCracked();
      }
    } else {
      runner.channel = Math.max(0, runner.channel - dt);
    }
    return;
  }
  if (near(player, def.stops[1])) completeMission(state, hooks);
}

/** The one-line objective the HUD shows. */
export function missionText(state) {
  const runner = state.missions.runner;
  if (runner.index >= DEFS.length) return 'Story complete. Solmar Bay is yours.';
  const def = DEFS[runner.index];
  if (runner.index === 2 && runner.stage === 0) return 'Steal the Comet: get in the red Comet GT.';
  if (runner.index === 5 && runner.stage === 1) {
    return `Golden Palm Heist: cracking the vault ${Math.floor((runner.channel / def.channelSeconds) * 100)}% — hold still.`;
  }
  if (runner.index === 5 && runner.stage === 2) return 'Golden Palm Heist: run for the cafe safehouse!';
  return `${def.name}: ${def.hint}`;
}

/** The current target point, for the minimap arrow. Null when there is none. */
export function missionTarget(state) {
  const runner = state.missions.runner;
  if (runner.index >= DEFS.length) return null;
  const def = DEFS[runner.index];
  if (runner.index === 0 || runner.index === 1) return def.stops[runner.stop];
  if (runner.index === 2) return runner.stage === 0 ? def.stops[0] : def.stops[1];
  if (runner.index === 3 || runner.index === 4) return null;
  return runner.stage === 2 ? def.stops[1] : def.stops[0];
}
