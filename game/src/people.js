// The people of Solmar Bay: pedestrians on the sidewalks, the police who
// answer the wanted level, and the Vultures gang. Pedestrians wander and
// flee from danger; police chase on foot and by car; gang members hold
// their turf and shoot at the player.
import { GANG, PEDESTRIANS, PLAYER, POLICE, WANTED, WORLD } from './config.js';
import { nearestRoad, resolveBuildingCollision } from './city.js';
import { makeCar } from './vehicles.js';

const PED_COLORS = ['#e8b73a', '#7a4a9e', '#2e6fc2', '#c23b2e', '#3aa655', '#d97b2e', '#e8e4da', '#4a7a9e'];

export function makePedestrian(random, x, y) {
  return {
    x, y, angle: random.range(0, Math.PI * 2),
    speed: PEDESTRIANS.walkSpeed * random.range(0.8, 1.2),
    target: null,
    state: 'walk',
    color: random.pick(PED_COLORS),
    scared: 0,
    dead: false,
    wallet: random.int(5, 40),
  };
}

/** Pedestrians spread over the sidewalks. */
export function spawnPedestrians(random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const x = random.range(200, 2360);
    const y = random.range(200, 1720);
    peds.push(makePedestrian(random, x, y));
  }
  return peds;
}

/** One pedestrian step: walk to its target, or run from danger. */
export function stepPedestrian(ped, dt, danger, random) {
  if (ped.dead) return;
  if (danger) {
    ped.state = 'flee';
    ped.scared = 2;
  } else if (ped.scared > 0) {
    ped.scared -= dt;
    if (ped.scared <= 0) ped.state = 'walk';
  }
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 20) {
    if (ped.state === 'flee' && danger) {
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.target = { x: ped.x + Math.cos(away) * 300, y: ped.y + Math.sin(away) * 300 };
    } else {
      ped.target = { x: ped.x + random.range(-260, 260), y: ped.y + random.range(-260, 260) };
    }
  }
  const speed = ped.state === 'flee' ? PEDESTRIANS.fleeSpeed : ped.speed;
  const angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  ped.angle = angle;
  ped.x = Math.max(40, Math.min(WORLD.width - 40, ped.x + Math.cos(angle) * speed * dt));
  ped.y = Math.max(40, Math.min(WORLD.height - 40, ped.y + Math.sin(angle) * speed * dt));
}

export function makeFootCop(random, x, y) {
  return {
    x, y, angle: 0, health: 60,
    state: 'patrol',
    target: null,
    shootTimer: 0,
    bustTimer: 0,
  };
}

export function makeGangMember(random, x, y) {
  return {
    x, y, angle: 0, health: GANG.health,
    state: 'guard',
    target: null,
    shootTimer: random.range(0, 1),
    home: { x, y },
  };
}

/**
 * The wanted level: crimes raise it, witnesses matter, and it fades when
 * nobody can see the player. Returns true when the level just changed.
 */
export function addWanted(state, stars, reason) {
  const before = state.player.stars;
  state.player.stars = Math.min(WANTED.maxStars, state.player.stars + stars);
  state.player.lastCrime = state.time;
  state.player.crimeLog.push({ reason, stars, at: Math.round(state.time) });
  if (state.player.stars > before) {
    state.events.push({ type: 'wanted', stars: state.player.stars, reason });
    return true;
  }
  return false;
}

/** Decay the wanted level while the player stays out of sight. */
export function decayWanted(state, dt) {
  const p = state.player;
  if (p.stars === 0) return;
  const seen = state.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < WANTED.sightRadius)
    || state.chaseCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < WANTED.sightRadius);
  if (seen) {
    p.hiddenTimer = 0;
    return;
  }
  p.hiddenTimer += dt;
  if (p.hiddenTimer > WANTED.decaySeconds) {
    p.stars = Math.max(0, p.stars - 1);
    p.hiddenTimer = 0;
    state.events.push({ type: 'wanted', stars: p.stars, reason: 'cooled off' });
  }
}

/** How many chase cars the current wanted level calls for. */
export function wantedChaseCount(stars) {
  if (stars <= 0) return 0;
  if (stars === 1) return 1;
  if (stars === 2) return 2;
  if (stars === 3) return 3;
  if (stars === 4) return 4;
  return WANTED.maxChaseCars;
}

/** Spawn a police car on the nearest road, already chasing the player. */
export function spawnChaseCar(random, state) {
  const p = state.player;
  const road = nearestRoad(p.x, p.y);
  const offset = 500;
  const dir = random.chance(0.5) ? 1 : -1;
  const car = makeCar(random, road.x, road.y, 0, {
    police: true, color: '#1a1a22', model: 'Interceptor',
    roadVertical: road.vertical, roadPos: road.vertical ? road.x : road.y, roadDir: dir,
  });
  if (road.vertical) {
    car.y = Math.max(180, Math.min(1740, p.y + dir * offset));
    car.angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.x = Math.max(180, Math.min(2380, p.x + dir * offset));
    car.angle = dir === 1 ? 0 : Math.PI;
  }
  car.siren = true;
  car.cruise = POLICE.carSpeed;
  state.chaseCars.push(car);
  return car;
}

/** One chase-car step: steer toward the player, ram on contact. */
export function stepChaseCar(car, dt, state) {
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
  car.speed = Math.min(POLICE.carSpeed, car.speed + 420 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
  car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
  const probe = { x: car.x, y: car.y };
  if (resolveBuildingCollision(state.city, probe, 26)) {
    car.x = probe.x;
    car.y = probe.y;
    car.speed *= 0.4;
    car.angle += 0.6;
  }
  // Ram the player's car, or the player on foot.
  const target = p.car ?? p;
  const d = Math.hypot(target.x - car.x, target.y - car.y);
  if (d < 44) {
    if (p.car) {
      p.car.health = Math.max(0, p.car.health - 6 * dt);
      p.car.speed *= 0.96;
    } else if (p.stars > 0) {
      // A cop car touching the player on foot starts the bust.
      state.bustTimer += dt;
    }
  }
}

/** One foot-cop step: patrol, chase, and try to bust the player. */
export function stepFootCop(cop, dt, state) {
  const p = state.player;
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  if (p.stars > 0 && d < WANTED.sightRadius) {
    cop.state = 'chase';
  } else if (p.stars === 0) {
    cop.state = 'patrol';
  }
  if (cop.state === 'chase') {
    const angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = angle;
    cop.x += Math.cos(angle) * POLICE.footSpeed * dt;
    cop.y += Math.sin(angle) * POLICE.footSpeed * dt;
    if (d < 26) {
      cop.bustTimer += dt;
      if (cop.bustTimer > WANTED.bustSeconds) state.flags.busted = true;
    } else {
      cop.bustTimer = 0;
    }
    // Cops open fire at three stars and up.
    if (p.stars >= POLICE.shootAtStars && d < 420) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = POLICE.shootInterval;
        state.bullets.push({
          x: cop.x, y: cop.y,
          vx: Math.cos(angle) * PLAYER.bulletSpeed,
          vy: Math.sin(angle) * PLAYER.bulletSpeed,
          from: 'police', damage: POLICE.bulletDamage, life: 0.8,
        });
        state.events.push({ type: 'shot', x: cop.x, y: cop.y });
      }
    }
  } else {
    if (!cop.target || Math.hypot(cop.target.x - cop.x, cop.target.y - cop.y) < 16) {
      cop.target = { x: cop.x + (state.random.next() - 0.5) * 300, y: cop.y + (state.random.next() - 0.5) * 300 };
    }
    const angle = Math.atan2(cop.target.y - cop.y, cop.target.x - cop.x);
    cop.angle = angle;
    cop.x += Math.cos(angle) * 70 * dt;
    cop.y += Math.sin(angle) * 70 * dt;
  }
  resolveBuildingCollision(state.city, cop, PLAYER.radius);
}

/** One gang member step: guard home turf, shoot the player on sight. */
export function stepGangMember(g, dt, state) {
  const p = state.player;
  const d = Math.hypot(p.x - g.x, p.y - g.y);
  if (d < 480) {
    const angle = Math.atan2(p.y - g.y, p.x - g.x);
    g.angle = angle;
    // Strafe closer when far, hold ground when near.
    if (d > 260) {
      g.x += Math.cos(angle) * 90 * dt;
      g.y += Math.sin(angle) * 90 * dt;
    }
    g.shootTimer -= dt;
    if (g.shootTimer <= 0 && d < 420) {
      g.shootTimer = GANG.shootInterval;
      const spread = (state.random.next() - 0.5) * 0.3;
      state.bullets.push({
        x: g.x, y: g.y,
        vx: Math.cos(angle + spread) * PLAYER.bulletSpeed,
        vy: Math.sin(angle + spread) * PLAYER.bulletSpeed,
        from: 'gang', damage: GANG.bulletDamage, life: 0.8,
      });
      state.events.push({ type: 'shot', x: g.x, y: g.y });
    }
  } else {
    const home = Math.hypot(g.home.x - g.x, g.home.y - g.y);
    if (home > 30) {
      const angle = Math.atan2(g.home.y - g.y, g.home.x - g.x);
      g.angle = angle;
      g.x += Math.cos(angle) * 60 * dt;
      g.y += Math.sin(angle) * 60 * dt;
    }
  }
  resolveBuildingCollision(state.city, g, PLAYER.radius);
}
