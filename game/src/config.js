// Solmar Bay — every tuning number, landmark and colour in one place.
// The city is a fixed 2560x2080 world; the renderer follows the player with a
// camera, so no rule below depends on the screen size.
export const STEP = 1 / 60;

export const CITY = { width: 2560, height: 2080 };

/** Road centrelines. Roads are 64 px wide; blocks sit between them. */
export const VERTICAL = [200, 600, 1000, 1400, 1800, 2200];
export const HORIZONTAL = [180, 520, 860, 1200, 1540, 1880];
export const ROAD_W = 64;
export const ROAD_HALF = ROAD_W / 2;

/** How far a building sits back from a block edge (the road side of it). */
export const APRON = 22;
/** The water line: everything east of this is sea, and no building may cross it. */
export const WATER_X = 2440;
export const MARINA_MAX_X = WATER_X - APRON;
/** The sand strip between the last road and the sea. */
export const BEACH_X = 2300;

export const LANDMARKS = {
  casino: { name: 'Golden Palm Casino', x: 390, y: 460, building: { x: 390, y: 360, w: 170, h: 92 } },
  cafe: { name: "Mama Rosa's Cafe", x: 1160, y: 1080, building: { x: 1160, y: 1018, w: 150, h: 84 } },
  mall: { name: 'Sunset Mall', x: 1600, y: 1150, building: { x: 1600, y: 1088, w: 190, h: 92 } },
  hq: { name: 'Bayview Police HQ', x: 390, y: 1700, building: { x: 390, y: 1636, w: 150, h: 88 } },
  hospital: { name: 'Solmar General Hospital', x: 2000, y: 460, building: { x: 2000, y: 398, w: 170, h: 92 } },
  marina: { name: 'Marina Towers', x: 2380, y: 1000, building: { x: 2362, y: 1000, w: 96, h: 200 } },
};

export const SPAWN = { x: 220, y: 200 };
export const COMET_SPOT = { x: 2200, y: 1330 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 215,
  carRadius: 21,
  accel: 620,
  brake: 900,
  reverseMax: 190,
  topSpeed: 560,
  steer: 2.5,
  handbrake: 1400,
  health: 100,
  startCash: 120,
};

export const TRAFFIC_COUNT = 26;
export const PARKED_COUNT = 11;
export const PEOPLE_COUNT = 24;
export const PICKUP_COUNT = 20;

export const GUN = { mag: 12, reloadSeconds: 1.2, bulletSpeed: 920, damage: 34, range: 1.4 };

export const WANTED = {
  sightRange: 550,
  decaySeconds: 5,
  giveUpSeconds: 12,
  bustRange: 30,
  bustSeconds: 0.6,
  maxStars: 5,
  bustedFine: 150,
  wastedBill: 100,
};

export const MISSION_PAYOUTS = [120, 180, 300, 320, 460, 600];
export const STORY_TOTAL = 1980;

export const PALETTE = {
  backdrop: '#0d1526',
  grass: '#3f7a4a',
  park: '#2e6b3a',
  sand: '#d9c08a',
  water: '#1f6f9f',
  road: '#33373f',
  roadLine: '#c9a227',
  sidewalk: '#565d68',
  building: '#7d8aa0',
  buildingRoof: '#5b6a80',
  landmark: '#c98a2e',
  landmarkRoof: '#a86f1d',
  player: '#4fc3f7',
  playerCar: '#e5534b',
  traffic: '#9aa5b1',
  parked: '#b7c0cc',
  comet: '#d21f3c',
  cop: '#2b4acb',
  interceptor: '#1d2f7a',
  vulture: '#8e2f8e',
  pedestrian: '#e8dcc8',
  bullet: '#ffe066',
  enemyBullet: '#ff5a4e',
  cash: '#37d67a',
  health: '#ff6b81',
  ammo: '#f2c94c',
  panel: '#171e2c',
  text: '#eef1f5',
  muted: '#93a0b4',
  star: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best';
