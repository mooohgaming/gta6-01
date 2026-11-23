// The story of Solmar Bay: six missions from Mama Rosa's cafe to the
// Golden Palm heist. Each mission is a small state machine: an objective,
// a target on the map, stages, and a reward. The manager watches the
// world each step and advances the mission when its conditions are met.
import { makeCar } from './vehicles.js';
import { addWanted, makeGangMember } from './people.js';

function landmark(state, kind) {
  return state.city.landmarks.find((l) => l.kind === kind);
}

function landmarkCentre(state, kind) {
  const lm = landmark(state, kind);
  const b = state.city.buildings.find((x) => x.kind === kind);
  if (!b) return { x: 400, y: 400 };
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export const MISSION_DEFS = [
  {
    name: 'Welcome to Solmar',
    brief: 'Rico Vega just rolled into Solmar Bay with $120 and a busted scooter. Mama Rosa runs the cafe on Coral Row and she has work. Get to her cafe.',
    reward: 100,
  },
  {
    name: 'Pizza Run',
    brief: 'Mama Rosa needs three pizzas delivered across town, fast. The clock is running — drive like the tips depend on it, because they do.',
    reward: 150,
  },
  {
    name: 'Borrowed Wheels',
    brief: 'A red Comet GT is parked outside the Golden Palm Casino. The Vultures left the keys in it. Take it and bring it to the garage at the hideout. Try not to be seen.',
    reward: 250,
  },
  {
    name: 'Heat',
    brief: 'The Bayview PD is all over you. Three stars. Lose them — stay out of sight until the heat dies down, and do not get busted.',
    reward: 200,
  },
  {
    name: 'Turf War',
    brief: 'The Vultures are hitting Mama Rosa\'s cafe to send a message. Hold the block. Drop all eight of them before they wreck the place.',
    reward: 300,
  },
  {
    name: 'The Golden Palm',
    brief: 'The big one. Walk into the Golden Palm Casino, empty the vault, and get out. Four stars the moment the alarm trips. Lose the cops and bring the take to the hideout.',
    reward: 800,
  },
];

export function createMissionManager(state) {
  const manager = {
    index: 0,
    active: false,
    stage: 0,
    objective: 'Talk to Mama Rosa.',
    timer: 0,
    target: null,
    progress: 0,
    stops: [],
    stopIndex: 0,
    targetCar: null,
    done: false,
  };

  function setObjective(text, target) {
    manager.objective = text;
    if (target) manager.target = target;
  }

  function startMission(i) {
    manager.index = i;
    manager.active = true;
    manager.stage = 0;
    manager.progress = 0;
    manager.stopIndex = 0;
    manager.targetCar = null;
    const p = state.player;
    if (i === 0) {
      const cafe = landmarkCentre(state, 'cafe');
      setObjective('Drive to Mama Rosa\'s Cafe on Coral Row.', { x: cafe.x, y: cafe.y + 90, label: 'Cafe' });
    } else if (i === 1) {
      manager.timer = 90;
      manager.stops = [
        { x: 480, y: 480, label: 'Pizza 1' },
        { x: 2080, y: 1120, label: 'Pizza 2' },
        { x: 1120, y: 1440, label: 'Pizza 3' },
      ];
      setObjective('Deliver pizza 1 of 3 — fast. 90 seconds.', manager.stops[0]);
    } else if (i === 2) {
      const casino = landmarkCentre(state, 'casino');
      const car = makeCar(state.random, casino.x + 130, casino.y + 110, 0, { color: '#c23b2e', model: 'Comet GT', parked: true });
      car.missionCar = true;
      state.cars.push(car);
      manager.targetCar = car;
      setObjective('Steal the red Comet GT outside the casino.', { x: car.x, y: car.y, label: 'Comet GT' });
    } else if (i === 3) {
      addWanted(state, 3, 'heat');
      manager.timer = 120;
      setObjective('Lose the cops. Stay out of sight until your wanted level clears.', null);
    } else if (i === 4) {
      const cafe = landmarkCentre(state, 'cafe');
      state.gang = [];
      for (let k = 0; k < 8; k += 1) {
        const g = makeGangMember(state.random, cafe.x + state.random.range(-160, 160), cafe.y + state.random.range(-140, 140));
        state.gang.push(g);
      }
      setObjective('Defend the cafe — drop all 8 Vultures.', { x: cafe.x, y: cafe.y, label: 'Cafe' });
    } else if (i === 5) {
      const casino = landmarkCentre(state, 'casino');
      setObjective('Walk into the Golden Palm Casino.', { x: casino.x, y: casino.y + 100, label: 'Casino' });
    }
  }

  function completeMission() {
    const def = MISSION_DEFS[manager.index];
    state.player.cash += def.reward;
    state.player.missionsDone += 1;
    state.events.push({ type: 'mission', name: def.name, reward: def.reward });
    state.saveDirty = true;
    if (manager.index >= MISSION_DEFS.length - 1) {
      manager.done = true;
      manager.active = false;
      manager.objective = 'Story complete. Solmar Bay is yours — free roam, Rico.';
      manager.target = null;
      return;
    }
    manager.active = false;
    manager.objective = `Mission complete: ${def.name} (+$${def.reward}). Press E to start the next job.`;
    manager.target = null;
  }

  function failMission(reason) {
    if (!manager.active) return;
    manager.active = false;
    manager.objective = `Mission failed: ${reason}. Press E to try again.`;
    manager.target = null;
    state.events.push({ type: 'missionFailed', reason });
  }

  function update(dt) {
    if (!manager.active) return;
    const p = state.player;
    const dist = (t) => (t ? Math.hypot(p.x - t.x, p.y - t.y) : Infinity);

    if (manager.index === 0) {
      if (dist(manager.target) < 70) completeMission();
    } else if (manager.index === 1) {
      manager.timer -= dt;
      if (manager.timer <= 0) {
        failMission('Out of time on the pizza run.');
        return;
      }
      if (dist(manager.target) < 70) {
        state.player.cash += 20;
        manager.stopIndex += 1;
        if (manager.stopIndex >= manager.stops.length) {
          completeMission();
        } else {
          const next = manager.stops[manager.stopIndex];
          setObjective(`Deliver pizza ${manager.stopIndex + 1} of 3 — ${Math.ceil(manager.timer)}s left.`, next);
        }
      } else {
        manager.objective = `Deliver pizza ${manager.stopIndex + 1} of 3 — ${Math.ceil(manager.timer)}s left.`;
      }
    } else if (manager.index === 2) {
      if (manager.stage === 0) {
        if (p.car === manager.targetCar) {
          manager.stage = 1;
          const hide = state.city.hideout;
          setObjective('Deliver the Comet GT to the garage at the hideout.', { x: hide.x, y: hide.y, label: 'Garage' });
        }
      } else if (dist(manager.target) < 80 && p.car === manager.targetCar) {
        completeMission();
      }
    } else if (manager.index === 3) {
      manager.timer -= dt;
      if (p.stars === 0) {
        completeMission();
      } else if (manager.timer <= 0) {
        failMission('The heat never died down.');
      }
    } else if (manager.index === 4) {
      const alive = state.gang.filter((g) => g.health > 0).length;
      manager.objective = `Defend the cafe — ${alive} Vultures left.`;
      if (alive === 0) completeMission();
    } else if (manager.index === 5) {
      if (manager.stage === 0) {
        if (dist(manager.target) < 80 && !p.car) {
          manager.stage = 1;
          manager.progress = 0;
          setObjective('Empty the vault — hold position.', landmarkCentre(state, 'casino'));
        }
      } else if (manager.stage === 1) {
        manager.progress += dt;
        manager.objective = `Emptying the vault… ${Math.ceil(5 - manager.progress)}s.`;
        if (manager.progress >= 5) {
          manager.stage = 2;
          addWanted(state, 4, 'casino robbery');
          const hide = state.city.hideout;
          setObjective('Get the take to the hideout — and lose the cops.', { x: hide.x, y: hide.y, label: 'Hideout' });
        }
      } else if (manager.stage === 2) {
        if (dist(manager.target) < 80 && p.stars === 0) completeMission();
        else if (dist(manager.target) < 80) manager.objective = 'You are here — but the cops are still on you. Lose them first.';
      }
    }
  }

  return { manager, startMission, completeMission, failMission, update };
}
