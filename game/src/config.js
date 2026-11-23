// Tuning and world constants for Solmar Bay. All distances are world units
// (1 unit ~ 1 m); speeds are units per second; angles are radians.
export const WORLD = {
  width: 2560,
  height: 1920,
  // Road centre-lines every 320 units, roads 96 wide, blocks 224 square.
  block: 320,
  roadWidth: 96,
  sidewalk: 14,
};

export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 285,
  radius: 13,
  health: 100,
  punchDamage: 12,
  bulletDamage: 34,
  pistolAmmo: 12,
  pistolReserve: 48,
  reloadSeconds: 1.1,
  fireInterval: 0.22,
  bulletSpeed: 900,
  bulletRange: 520,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 160,
  steerRate: 2.4,
  grip: 3.2,
  length: 54,
  width: 26,
  // Damage the car takes from a hard hit, and the speed that counts as hard.
  damageSpeed: 260,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 26,
  speed: 130,
  minGap: 90,
};

export const PEDESTRIANS = {
  count: 34,
  walkSpeed: 55,
  fleeSpeed: 150,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14,
  // Stars at which each police response starts showing up.
  footCopsAt: 1,
  chaseCarsAt: 1,
  roadblockAt: 3,
  maxChaseCars: 6,
  bustSeconds: 1.6,
  // How far a witness must be to see a crime, and how far police see the player.
  witnessRadius: 420,
  sightRadius: 560,
};

export const POLICE = {
  carSpeed: 520,
  footSpeed: 200,
  shootAtStars: 3,
  shootInterval: 0.9,
  bulletDamage: 9,
  accuracy: 0.45,
};

export const GANG = {
  count: 8,
  health: 50,
  shootInterval: 1.1,
  bulletDamage: 7,
  accuracy: 0.35,
};

export const MISSIONS = {
  // Cash the player starts with, and the fine for getting busted.
  startCash: 120,
  bustFine: 150,
  hospitalBill: 100,
};

// Sunset palette: warm sun-soaked Solmar Bay.
export const COLORS = {
  grass: '#7fae62',
  grassDark: '#74a158',
  sand: '#e8cf96',
  water: '#2e7f9e',
  waterDeep: '#256d8a',
  road: '#3d3a38',
  roadEdge: '#2e2b2a',
  lane: '#e8d44d',
  sidewalk: '#b9b2a4',
  crosswalk: '#e8e4da',
  roofA: '#c96f4a',
  roofB: '#4a7a9e',
  roofC: '#8a6fae',
  roofD: '#b0493f',
  roofE: '#4f8f6b',
  roofF: '#d9a441',
  buildingEdge: '#00000033',
  park: '#5d9b4a',
  tree: '#3f7d33',
  treeDark: '#356b2b',
};
