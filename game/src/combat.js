// Combat: bullets, punches, and pickups. Bullets fly straight until they
// hit a building, a person, or a car; punches land on whatever is right in
// front of the player.
import { PLAYER } from './config.js';
import { resolveBuildingCollision } from './city.js';

export function fireBullet(state, x, y, angle, from, damage) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    from, damage, life: PLAYER.bulletRange / PLAYER.bulletSpeed,
  });
  state.particles.push({
    x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18,
    vx: 0, vy: 0, life: 0.08, maxLife: 0.08, color: '#ffd94d', size: 5, spark: true,
  });
}

/** A punch: anything within arm's reach in front of the player takes a hit. */
export function punch(state) {
  const p = state.player;
  const px = p.x + Math.cos(p.angle) * 26;
  const py = p.y + Math.sin(p.angle) * 26;
  const hit = (e, radius) => Math.hypot(e.x - px, e.y - py) < radius + 26;
  for (const ped of state.peds) {
    if (!ped.dead && hit(ped, 14)) {
      ped.dead = true;
      state.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
      return true;
    }
  }
  for (const g of state.gang) {
    if (g.health > 0 && hit(g, 14)) {
      g.health -= PLAYER.punchDamage;
      state.events.push({ type: 'hit', x: g.x, y: g.y });
      return true;
    }
  }
  for (const c of state.cops) {
    if (c.health > 0 && hit(c, 14)) {
      c.health -= PLAYER.punchDamage;
      state.events.push({ type: 'hit', x: c.x, y: c.y });
      return true;
    }
  }
  return false;
}

/** Move every bullet and resolve what it hits. Returns nothing; events go on the state. */
export function stepBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    const probe = { x: b.x, y: b.y };
    if (resolveBuildingCollision(state.city, probe, 2)) {
      b.life = 0;
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#c9c2b4', size: 4, spark: true });
      continue;
    }
    const hitPerson = (e, radius) => Math.hypot(e.x - b.x, e.y - b.y) < radius;
    if (b.from === 'player') {
      let done = false;
      for (const g of state.gang) {
        if (g.health > 0 && hitPerson(g, 15)) {
          g.health -= b.damage;
          b.life = 0;
          state.events.push({ type: 'hit', x: g.x, y: g.y });
          done = true;
          break;
        }
      }
      if (!done) {
        for (const c of state.cops) {
          if (c.health > 0 && hitPerson(c, 15)) {
            c.health -= b.damage;
            b.life = 0;
            state.events.push({ type: 'hit', x: c.x, y: c.y });
            done = true;
            break;
          }
        }
      }
      if (!done) {
        for (const ped of state.peds) {
          if (!ped.dead && hitPerson(ped, 14)) {
            ped.dead = true;
            b.life = 0;
            state.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
            done = true;
            break;
          }
        }
      }
      if (!done) {
        for (const car of state.cars) {
          if (car !== p.car && hitPerson(car, 28)) {
            car.health = Math.max(0, car.health - b.damage);
            b.life = 0;
            state.events.push({ type: 'hit', x: car.x, y: car.y });
            break;
          }
        }
      }
    } else if ((b.from === 'police' || b.from === 'gang') && !p.car && hitPerson(p, 14)) {
      p.health -= b.damage;
      b.life = 0;
      state.events.push({ type: 'playerHit' });
    } else if ((b.from === 'police' || b.from === 'gang') && p.car && hitPerson(p.car, 28)) {
      p.car.health = Math.max(0, p.car.health - b.damage);
      b.life = 0;
      state.events.push({ type: 'hit', x: p.car.x, y: p.car.y });
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

/** Spawn a pickup: health, ammo, or cash. */
export function spawnPickup(state, x, y, kind, amount) {
  state.pickups.push({ x, y, kind, amount });
}

/** The player walks over a pickup: collect it. */
export function collectPickups(state) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + pk.amount);
      else if (pk.kind === 'ammo') p.reserve += pk.amount;
      else if (pk.kind === 'cash') p.cash += pk.amount;
      state.events.push({ type: 'pickup', kind: pk.kind, x: pk.x, y: pk.y });
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
}
