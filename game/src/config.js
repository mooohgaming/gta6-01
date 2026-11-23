// Every tuning number and colour for Solmar Bay in one place. The world is a fixed
// 2560x2080 city; the renderer shows a 1280x720 camera window of it, so no rule below
// depends on the screen size. All simulation numbers are in world units and seconds.

export const WORLD = { width: 2560, height: 2080 };

export const VERTICAL_ROADS = [200, 600, 1000, 1400, 1800, 2200];
export const HORIZONTAL_ROADS = [180, 520, 860, 1200, 1540, 1880];
export const ROAD_HALF = 32;
/** Buildings keep this much sidewalk clear of every road edge. */
export const APRON = 22;
/** The sand strip along the south edge of the map. */
export const BEACH_Y = 1970;
/** The water strip along the east edge of the map. */
export const MARINA_X = 2440;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 10,
  walkSpeed: 220,
  health: 100,
};

export const CAR = {
  radius: 16,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 220,
  turnRate: 2.7,
  drag: 0.55,
  handbrakeDecel: 900,
};

export const TRAFFIC_SPEED = { min: 170, max: 260 };
export const TRAFFIC_COUNT = 26;
export const PARKED_COUNT = 11;
export const PEOPLE_COUNT = 24;
export const PICKUP_COUNT = 20;

export const GUN = {
  mag: 12,
  reloadSeconds: 1.2,
  fireInterval: 0.25,
  bulletSpeed: 900,
  bulletRange: 700,
  bulletDamage: 1,
};

export const START_CASH = 120;
export const BUSTED_FINE = 150;
export const WASTED_BILL = 100;
export const PICKUP_CASH = 25;

/** Mission payouts, in order: cafe job, pizza run, Comet theft, losing the tail, turf war, heist. */
export const MISSION_PAYOUTS = [120, 180, 300, 320, 460, 600];

export const LANDMARKS = {
  casino: { name: 'Golden Palm Casino', x: 390, y: 380, w: 180, h: 120 },
  cafe: { name: "Mama Rosa's Cafe", x: 1160, y: 970, w: 210, h: 120 },
  hospital: { name: 'Solmar General Hospital', x: 2000, y: 950, w: 200, h: 80 },
  hq: { name: 'Bayview Police HQ', x: 390, y: 1290, w: 180, h: 80 },
  mall: { name: 'Sunset Mall', x: 1600, y: 990, w: 240, h: 180 },
  marina: { name: 'Marina Towers', x: 2350, y: 1700, w: 180, h: 160 },
};

/** Where busted and wasted players wake up. */
export const RESPAWN = {
  busted: { x: 390, y: 1370 },
  wasted: { x: 2000, y: 1030 },
};

export const WANTED = {
  sightRange: 550,
  giveUpRange: 700,
  giveUpSeconds: 12,
  decayDelay: 10,
  decaySeconds: 4,
  maxCops: 5,
  maxInterceptors: 3,
  ramDamagePerSecond: 6,
};

export const PALETTE = {
  backdrop: '#0d1420',
  grass: '#1d3a24',
  sand: '#c9b183',
  water: '#14506e',
  road: '#2b2f38',
  roadLine: '#d8c95a',
  sidewalk: '#3a3f4a',
  building: '#4a4f5e',
  buildingRoof: '#5d6373',
  casino: '#7a5c1e',
  cafe: '#8a4b2d',
  hospital: '#3d6b8a',
  hq: '#33415e',
  mall: '#5e4a7a',
  marina: '#2d5e6b',
  park: '#245c31',
  tree: '#2f7a3d',
  player: '#4fc3f7',
  car: '#e8b23a',
  traffic: '#b8bec9',
  taxi: '#f2c94c',
  comet: '#d92626',
  interceptor: '#1c2733',
  ped: '#d8d8d8',
  vulture: '#8a2f2f',
  cop: '#2b4a7a',
  bullet: '#ffe08a',
  enemyBullet: '#ff7a5c',
  panel: '#1c2330',
  text: '#eef1f5',
  muted: '#8b93a3',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#5ec97a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save';
