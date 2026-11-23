// The city of Solmar Bay: its road grid, buildings, parks, beach and marina, and the
// collision that keeps the player, cars and pedestrians out of the buildings. A
// building never covers a mission target, a spawn or a respawn: those points are
// protected, and every generated building is checked against them.
import {
  APRON,
  BEACH_Y,
  HORIZONTAL_ROADS,
  LANDMARKS,
  MARINA_X,
  ROAD_HALF,
  VERTICAL_ROADS,
  WORLD,
} from './config.js';

/** Points nothing may be built on: mission targets, the spawn and the respawns. */
const PROTECTED = [
  { x: 1160, y: 1080, r: 80 },
  { x: 1600, y: 1150, r: 80 },
  { x: 390, y: 460, r: 80 },
  { x: 1400, y: 1200, r: 80 },
  { x: 390, y: 1370, r: 80 },
  { x: 2000, y: 1030, r: 80 },
  { x: 2240, y: 1330, r: 80 },
];

/** The six named landmarks, as rectangles with their palette key. */
const LANDMARK_RECTS = [
  { x: 300, y: 320, w: 180, h: 120, kind: 'casino', name: LANDMARKS.casino.name, color: 'casino' },
  { x: 1060, y: 920, w: 200, h: 120, kind: 'cafe', name: LANDMARKS.cafe.name, color: 'cafe' },
  { x: 1900, y: 920, w: 200, h: 80, kind: 'hospital', name: LANDMARKS.hospital.name, color: 'hospital' },
  { x: 300, y: 1260, w: 180, h: 80, kind: 'hq', name: LANDMARKS.hq.name, color: 'hq' },
  { x: 1480, y: 920, w: 240, h: 180, kind: 'mall', name: LANDMARKS.mall.name, color: 'mall' },
  { x: 2260, y: 1620, w: 180, h: 160, kind: 'marina', name: LANDMARKS.marina.name, color: 'marina' },
];

function rectsOverlap(a, b, gap = 0) {
  return a.x - gap < b.x + b.w && a.x + a.w + gap > b.x && a.y - gap < b.y + b.h && a.y + a.h + gap > b.y;
}

function circleHitsRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

export function createCity(random) {
  const buildings = LANDMARK_RECTS.map((rect) => ({ ...rect }));
  const parks = [];
  const trees = [];

  const xs = [0, ...VERTICAL_ROADS, WORLD.width];
  const ys = [0, ...HORIZONTAL_ROADS, WORLD.height];

  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const minX = xs[bi] + ROAD_HALF + APRON;
      // Buildings stay on dry land: the marina water starts at MARINA_X, so the
      // eastern block's buildable ground ends there, not at the map edge.
      const maxX = Math.min(xs[bi + 1] - ROAD_HALF - APRON, MARINA_X - APRON);
      const minY = ys[bj] + ROAD_HALF + APRON;
      const maxY = ys[bj + 1] - ROAD_HALF - APRON;
      // The beach and the marina are open ground: no buildings there.
      if (minY >= BEACH_Y || minX >= MARINA_X) continue;
      const width = maxX - minX;
      const height = Math.min(maxY, BEACH_Y - APRON) - minY;
      if (width < 90 || height < 70) continue;
      // One block in four is a park instead of buildings.
      if (random() < 0.25) {
        parks.push({ x: minX, y: minY, w: width, h: height });
        const treeCount = 3 + Math.floor(random() * 4);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: minX + 20 + random() * (width - 40), y: minY + 20 + random() * (height - 40) });
        }
        continue;
      }
      const count = 1 + (random() < 0.5 ? 1 : 0);
      for (let n = 0; n < count; n += 1) {
        // A building never outgrows its block: an oversize one would jut into
        // a road and wall off a lane.
        const w = Math.min(80 + random() * 120, width - 8);
        const h = Math.min(60 + random() * 90, height - 8);
        const x = minX + random() * Math.max(1, width - w);
        const y = minY + random() * Math.max(1, height - h);
        const rect = { x, y, w, h, kind: 'block', name: '', color: 'building' };
        if (buildings.some((other) => rectsOverlap(rect, other, 12))) continue;
        if (PROTECTED.some((point) => circleHitsRect(point, rect))) continue;
        buildings.push(rect);
      }
    }
  }

  return { buildings, parks, trees };
}

export function pointInBuilding(city, x, y) {
  for (const rect of city.buildings) {
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return true;
  }
  return false;
}

export function isOnRoad(x, y) {
  const onVertical = VERTICAL_ROADS.some((road) => Math.abs(x - road) <= ROAD_HALF);
  const onHorizontal = HORIZONTAL_ROADS.some((road) => Math.abs(y - road) <= ROAD_HALF);
  return onVertical || onHorizontal;
}

export function nearestRoadX(x) {
  return VERTICAL_ROADS.reduce((best, road) => (Math.abs(road - x) < Math.abs(best - x) ? road : best));
}

export function nearestRoadY(y) {
  return HORIZONTAL_ROADS.reduce((best, road) => (Math.abs(road - y) < Math.abs(best - y) ? road : best));
}

/**
 * Push a circle out of every building it overlaps and out of the world edge.
 * The push is along the axis of least penetration, so a car sliding along a wall
 * keeps its tangential motion instead of wedging on a corner. Returns true when
 * anything was pushed.
 */
export function resolveSolid(city, body, radius) {
  let pushed = false;
  for (const rect of city.buildings) {
    const closestX = Math.max(rect.x, Math.min(body.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(body.y, rect.y + rect.h));
    const dx = body.x - closestX;
    const dy = body.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    pushed = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      body.x += (dx / dist) * push;
      body.y += (dy / dist) * push;
    } else {
      // The centre is inside the rectangle: leave by the nearest edge.
      const left = body.x - rect.x + radius;
      const right = rect.x + rect.w - body.x + radius;
      const top = body.y - rect.y + radius;
      const bottom = rect.y + rect.h - body.y + radius;
      const least = Math.min(left, right, top, bottom);
      if (least === left) body.x = rect.x - radius;
      else if (least === right) body.x = rect.x + rect.w + radius;
      else if (least === top) body.y = rect.y - radius;
      else body.y = rect.y + rect.h + radius;
    }
  }
  if (body.x < radius) { body.x = radius; pushed = true; }
  if (body.x > WORLD.width - radius) { body.x = WORLD.width - radius; pushed = true; }
  if (body.y < radius) { body.y = radius; pushed = true; }
  if (body.y > WORLD.height - radius) { body.y = WORLD.height - radius; pushed = true; }
  return pushed;
}
