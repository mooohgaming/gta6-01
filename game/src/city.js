// The city itself: road grid, blocks, buildings, parks, beach and sea.
// Buildings never cover a road lane: each one sits inside its block with an
// apron setback, its width and height clamped to the block minus 8 px, and
// marina-column buildings clamped short of the water line. The blocks that
// hold the story's targets keep only their landmark building, so the plaza
// in front of it — where the player has to stand or park — stays clear.

import { APRON, BEACH_X, CITY, HORIZONTAL, LANDMARKS, MARINA_MAX_X, ROAD_HALF, VERTICAL, WATER_X } from './config.js';

const ROOF_COLORS = ['#5b6a80', '#6b7a90', '#7a6a58', '#5f7488', '#6e5a6e', '#4f6a5a'];

function blockRects() {
  const xs = [0, ...VERTICAL, CITY.width];
  const ys = [0, ...HORIZONTAL, CITY.height];
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + (i === 0 ? 0 : ROAD_HALF);
      const x1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 0 : ROAD_HALF);
      const y0 = ys[j] + (j === 0 ? 0 : ROAD_HALF);
      const y1 = ys[j + 1] - (j + 1 === ys.length - 1 ? 0 : ROAD_HALF);
      blocks.push({ x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 });
    }
  }
  return blocks;
}

function pointInRect(x, y, r, pad = 0) {
  return x > r.x - r.w / 2 - pad && x < r.x + r.w / 2 + pad && y > r.y - r.h / 2 - pad && y < r.y + r.h / 2 + pad;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const blocks = blockRects();

  // The landmark buildings go in first, exactly where the story needs them.
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    const b = { ...lm.building, kind: key, name: lm.name, landmark: true, roof: '#a86f1d' };
    // The marina tower sits in the last column: keep it short of the water.
    if (b.x + b.w / 2 > MARINA_MAX_X) b.x = MARINA_MAX_X - b.w / 2;
    buildings.push(b);
  }

  for (const block of blocks) {
    // A block holding a landmark keeps only that building; the plaza in front
    // of it stays open for the player.
    const hasLandmark = buildings.some((b) => pointInRect(b.x, b.y, { x: (block.x0 + block.x1) / 2, y: (block.y0 + block.y1) / 2, w: block.w, h: block.h }));
    if (hasLandmark) continue;
    // The beach column (east of the last road) is sand, not buildings.
    // Buildings in the last column may only use the strip west of the beach.
    const bx1 = Math.min(block.x1, BEACH_X);
    const bw = bx1 - block.x0;
    if (bw < 120) continue;
    // A few blocks are parks: grass and trees, no buildings.
    if (random() < 0.14 && bw > 180 && block.h > 150) {
      parks.push({ x: (block.x0 + bx1) / 2, y: (block.y0 + block.y1) / 2, w: bw, h: block.h, trees: Math.floor(random() * 5) + 3 });
      continue;
    }
    const count = bw < 150 || block.h < 130 ? 1 : 1 + Math.floor(random() * 2);
    for (let n = 0; n < count; n += 1) {
      // Width and height clamped to the block minus 8 px, so even a narrow edge
      // block cannot grow a building over a road lane.
      const w = Math.min(bw - 8, 70 + random() * 110);
      const h = Math.min(block.h - 8, 60 + random() * 90);
      const x = block.x0 + APRON + w / 2 + random() * Math.max(0, bw - 2 * APRON - w);
      const y = block.y0 + APRON + h / 2 + random() * Math.max(0, block.h - 2 * APRON - h);
      const b = { x, y, w, h, kind: 'block', roof: ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)] };
      if (b.x + b.w / 2 > MARINA_MAX_X) b.x = MARINA_MAX_X - b.w / 2;
      buildings.push(b);
    }
  }

  const water = { x: WATER_X, y: 0, w: CITY.width - WATER_X, h: CITY.height };
  const sand = { x: BEACH_X, y: 0, w: WATER_X - BEACH_X, h: CITY.height };

  function overlapsSolid(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && y + r > b.y - b.h / 2 && y - r < b.y + b.h / 2) return b;
    }
    if (x + r > water.x) return water;
    return null;
  }

  /**
   * Push a circle (the player, a car, a pedestrian) out of whatever solid it
   * overlaps, along the axis of least penetration, so a car sliding along a
   * wall keeps its along-wall speed instead of sticking to it. Returns the
   * solid hit, or null.
   */
  function resolveSolid(body) {
    const r = body.radius;
    const hit = overlapsSolid(body.x, body.y, r);
    if (!hit) return null;
    const left = body.x + r - (hit.x - hit.w / 2);
    const right = hit.x + hit.w / 2 - (body.x - r);
    const top = body.y + r - (hit.y - hit.h / 2);
    const bottom = hit.y + hit.h / 2 - (body.y - r);
    const min = Math.min(left, right, top, bottom);
    if (min === left) body.x -= left;
    else if (min === right) body.x += right;
    else if (min === top) body.y -= top;
    else body.y += bottom;
    return hit;
  }

  function isOnRoad(x, y) {
    for (const vx of VERTICAL) if (Math.abs(x - vx) <= ROAD_HALF) return true;
    for (const hy of HORIZONTAL) if (Math.abs(y - hy) <= ROAD_HALF) return true;
    return false;
  }

  function nearestRoadPoint(x, y) {
    const vx = VERTICAL.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const hy = HORIZONTAL.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
    return Math.abs(vx - x) <= Math.abs(hy - y) ? { x: vx, y } : { x, y: hy };
  }

  return { buildings, parks, water, sand, resolveSolid, isOnRoad, nearestRoadPoint };
}
