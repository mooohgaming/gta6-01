// Solmar Bay itself: a road grid, blocks of buildings, parks, a beach and
// five named landmarks. The city is generated from a seed, then painted
// once to an offscreen layer; each frame draws only the visible part of
// that layer, so the city costs almost nothing to render.
import { COLORS, WORLD } from './config.js';

const ROOF_COLORS = [COLORS.roofA, COLORS.roofB, COLORS.roofC, COLORS.roofD, COLORS.roofE, COLORS.roofF];
const CAR_COLORS = ['#c23b2e', '#2e6fc2', '#e8b73a', '#3aa655', '#e8e4da', '#22242a', '#7a4a9e', '#d97b2e'];

/** Road centre-lines: verticals at x, horizontals at y. */
export function roadLines() {
  const verticals = [];
  const horizontals = [];
  for (let i = 0; i <= 7; i += 1) verticals.push(160 + i * WORLD.block);
  for (let j = 0; j <= 5; j += 1) horizontals.push(160 + j * WORLD.block);
  return { verticals, horizontals };
}

/** Is the point on a road (within the asphalt)? */
export function isOnRoad(x, y) {
  const { verticals, horizontals } = roadLines();
  const half = WORLD.roadWidth / 2;
  for (const rx of verticals) if (Math.abs(x - rx) <= half && y >= 100 && y <= 1820) return true;
  for (const ry of horizontals) if (Math.abs(y - ry) <= half && x >= 100 && x <= 2460) return true;
  return false;
}

/** The nearest point on any road centre-line, and whether that road runs vertical. */
export function nearestRoad(x, y) {
  const { verticals, horizontals } = roadLines();
  let best = { x, y, vertical: true, dist: Infinity };
  for (const rx of verticals) {
    const d = Math.abs(x - rx);
    if (d < best.dist) best = { x: rx, y: Math.max(160, Math.min(1760, y)), vertical: true, dist: d };
  }
  for (const ry of horizontals) {
    const d = Math.abs(y - ry);
    if (d < best.dist) best = { x: Math.max(160, Math.min(2400, x)), y: ry, vertical: false, dist: d };
  }
  return best;
}

export function generateCity(random) {
  const { verticals, horizontals } = roadLines();
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];

  // Landmarks first, each pinned to its own block so missions can find them.
  const landmarks = [
    { name: "Mama Rosa's Cafe", kind: 'cafe', bx: 1, by: 1, color: COLORS.roofA },
    { name: 'Golden Palm Casino', kind: 'casino', bx: 5, by: 2, color: COLORS.roofF },
    { name: 'Solmar General Hospital', kind: 'hospital', bx: 1, by: 4, color: '#e8e4da' },
    { name: 'Bayview Police HQ', kind: 'police', bx: 6, by: 0, color: COLORS.roofB },
    { name: 'Sunset Mall', kind: 'mall', bx: 3, by: 3, color: COLORS.roofC },
    { name: 'Marina Towers', kind: 'marina', bx: 6, by: 4, color: COLORS.roofE },
  ];
  const landmarkBlocks = new Set(landmarks.map((l) => `${l.bx},${l.by}`));

  for (const lm of landmarks) {
    const bx = verticals[lm.bx] + WORLD.roadWidth / 2;
    const by = horizontals[lm.by] + WORLD.roadWidth / 2;
    const w = lm.kind === 'casino' || lm.kind === 'mall' ? 190 : 150;
    const h = lm.kind === 'casino' || lm.kind === 'mall' ? 150 : 120;
    buildings.push({
      x: bx + (WORLD.block - WORLD.roadWidth - w) / 2,
      y: by + (WORLD.block - WORLD.roadWidth - h) / 2,
      w, h, color: lm.color, name: lm.name, kind: lm.kind, height: 26,
    });
  }

  // Every other block: buildings, a park, or a parking lot.
  for (let i = 0; i < 7; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      if (landmarkBlocks.has(`${i},${j}`)) continue;
      const bx = verticals[i] + WORLD.roadWidth / 2;
      const by = horizontals[j] + WORLD.roadWidth / 2;
      const inner = WORLD.block - WORLD.roadWidth;
      const roll = random.next();
      if (roll < 0.16) {
        const px = bx + 12;
        const py = by + 12;
        const parkTrees = [];
        for (let t = 0; t < 9; t += 1) {
          parkTrees.push({ x: px + random.range(16, inner - 16), y: py + random.range(16, inner - 16), r: random.range(9, 15) });
        }
        parks.push({ x: px, y: py, w: inner - 24, h: inner - 24, trees: parkTrees });
        trees.push(...parkTrees);
        continue;
      }
      if (roll < 0.3) {
        lots.push({ x: bx + 10, y: by + 10, w: inner - 20, h: inner - 20, spots: random.int(3, 6) });
        continue;
      }
      const count = random.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = random.range(70, 120);
        const h = random.range(60, 110);
        const x = bx + random.range(8, inner - w - 8);
        const y = by + random.range(8, inner - h - 8);
        buildings.push({
          x, y, w, h,
          color: random.pick(ROOF_COLORS),
          name: '', kind: 'house', height: random.range(8, 22),
        });
      }
    }
  }

  // Palm trees along the beachfront road and a few on sidewalks.
  for (let x = 200; x < 2400; x += 130) {
    trees.push({ x: x + random.range(-20, 20), y: 1796 + random.range(-6, 6), r: 12, palm: true });
  }

  return {
    buildings, parks, lots, trees, landmarks,
    beach: { x: 0, y: 1780, w: WORLD.width, h: 140 },
    water: { x: 0, y: 1880, w: WORLD.width, h: 40 },
    spawn: { x: verticals[1] + 60, y: horizontals[1] + 60 },
    hideout: { x: verticals[2] + 40, y: horizontals[4] + 40 },
  };
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function resolveBuildingCollision(city, e, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        e.x = cx + (dx / d) * radius;
        e.y = cy + (dy / d) * radius;
      } else {
        e.x += radius;
      }
    }
  }
  return hit;
}

/** Paint the whole city once to an offscreen canvas; returns the canvas. */
export function createCityLayer(city) {
  const layer = document.createElement('canvas');
  layer.width = WORLD.width;
  layer.height = WORLD.height;
  const c = layer.getContext('2d');
  const { verticals, horizontals } = roadLines();

  // Ground: grass, then beach sand and water along the south edge.
  c.fillStyle = COLORS.grass;
  c.fillRect(0, 0, WORLD.width, WORLD.height);
  c.fillStyle = COLORS.grassDark;
  for (let i = 0; i < 260; i += 1) {
    const x = (i * 97) % WORLD.width;
    const y = (i * 173) % WORLD.height;
    c.fillRect(x, y, 3, 3);
  }
  c.fillStyle = COLORS.sand;
  c.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  c.fillStyle = COLORS.water;
  c.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  c.fillStyle = COLORS.waterDeep;
  for (let x = 0; x < WORLD.width; x += 90) {
    c.fillRect(x, city.water.y + 12, 60, 4);
    c.fillRect(x + 40, city.water.y + 26, 50, 3);
  }

  // Roads: asphalt, edge lines, dashed centre lines, crosswalks at junctions.
  for (const ry of horizontals) {
    c.fillStyle = COLORS.road;
    c.fillRect(80, ry - WORLD.roadWidth / 2, WORLD.width - 160, WORLD.roadWidth);
  }
  for (const rx of verticals) {
    c.fillStyle = COLORS.road;
    c.fillRect(rx - WORLD.roadWidth / 2, 80, WORLD.roadWidth, WORLD.height - 160 - 80);
  }
  c.fillStyle = COLORS.lane;
  for (const ry of horizontals) {
    for (let x = 100; x < WORLD.width - 100; x += 44) c.fillRect(x, ry - 2, 24, 4);
  }
  for (const rx of verticals) {
    for (let y = 100; y < 1760; y += 44) c.fillRect(rx - 2, y, 4, 24);
  }
  c.fillStyle = COLORS.crosswalk;
  for (const rx of verticals) {
    for (const ry of horizontals) {
      for (let k = -3; k <= 3; k += 1) {
        c.fillRect(rx - WORLD.roadWidth / 2 + 6, ry + k * 12 - 4, WORLD.roadWidth - 12, 7);
      }
    }
  }

  // Sidewalks: pale strips just off the asphalt.
  c.fillStyle = COLORS.sidewalk;
  for (const ry of horizontals) {
    c.fillRect(80, ry - WORLD.roadWidth / 2 - WORLD.sidewalk, WORLD.width - 160, WORLD.sidewalk);
    c.fillRect(80, ry + WORLD.roadWidth / 2, WORLD.width - 160, WORLD.sidewalk);
  }
  for (const rx of verticals) {
    c.fillRect(rx - WORLD.roadWidth / 2 - WORLD.sidewalk, 80, WORLD.sidewalk, 1700);
    c.fillRect(rx + WORLD.roadWidth / 2, 80, WORLD.sidewalk, 1700);
  }

  // Parks and parking lots.
  for (const p of city.parks) {
    c.fillStyle = COLORS.park;
    c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#4a7d3c';
    c.lineWidth = 3;
    c.strokeRect(p.x, p.y, p.w, p.h);
  }
  for (const lot of city.lots) {
    c.fillStyle = '#55504c';
    c.fillRect(lot.x, lot.y, lot.w, lot.h);
    c.strokeStyle = '#e8e4da';
    c.lineWidth = 2;
    for (let s = 0; s < lot.spots; s += 1) {
      const sx = lot.x + 10 + s * ((lot.w - 20) / lot.spots);
      c.strokeRect(sx, lot.y + 10, (lot.w - 20) / lot.spots - 8, lot.h - 20);
    }
  }

  // Buildings: long sunset shadow, roof, windows, and the landmark's name.
  for (const b of city.buildings) {
    c.fillStyle = 'rgba(40,20,10,0.28)';
    c.fillRect(b.x + b.height, b.y + b.height, b.w, b.h);
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = COLORS.buildingEdge;
    c.lineWidth = 3;
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        c.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 24, 12, 10);
      }
    }
    if (b.name) {
      c.fillStyle = '#fff8ea';
      c.font = `bold ${b.kind === 'casino' || b.kind === 'mall' ? 17 : 14}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const words = b.name.split(' ');
      if (words.length > 2) {
        c.fillText(words.slice(0, 2).join(' '), b.x + b.w / 2, b.y + b.h / 2 - 10);
        c.fillText(words.slice(2).join(' '), b.x + b.w / 2, b.y + b.h / 2 + 10);
      } else {
        c.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
      }
    }
  }

  // Trees: round canopies, palms near the beach.
  for (const t of city.trees) {
    if (t.palm) {
      c.strokeStyle = '#7a5230';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(t.x, t.y + 10);
      c.lineTo(t.x, t.y - 8);
      c.stroke();
      c.fillStyle = '#4f9e44';
      c.beginPath();
      c.arc(t.x, t.y - 12, 11, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = COLORS.treeDark;
      c.beginPath();
      c.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = COLORS.tree;
      c.beginPath();
      c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      c.fill();
    }
  }

  return layer;
}

export { CAR_COLORS };
