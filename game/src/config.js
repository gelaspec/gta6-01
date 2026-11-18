// Meridian Bay — every tuning number, colour and city constant in one place.
// The city is a road grid: streets run north-south and east-west every 80 m,
// roads 14 m wide, blocks 66 m square. The ocean lies east (positive x).
// One unit is one metre; the simulation runs in fixed 1/60 s steps.

export const STEP = 1 / 60;

export const CITY = {
  half: 280, // city spans -280..280 on both axes (roads at -240..240)
  roads: [-240, -160, -80, 0, 80, 160, 240],
  roadWidth: 14,
  block: 66,
  beachX: 296, // sand starts here
  waterX: 322, // ocean starts here
  pierZ: 40, // pier runs along z = 40, out into the ocean
  pierEndX: 452,
};

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 6,
  runSpeed: 10.5,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: 24,
  health: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 42,
  maxReverse: 12,
  steerMax: 0.55,
  steerSpeed: 2.2,
  drag: 0.35,
  handbrakeDrag: 2.4,
  radius: 2.3,
};

export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 12;
export const PED_COUNT = 26;

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  decayDelay: 14, // seconds with no crime and no cop near before stars fall
  decayPerSec: 0.12,
  maxPoliceCars: 4,
};

export const PROTAGONIST = 'Cassian Rowe';
export const FIXER = 'Inez Kade';

// Vehicle classes: every car on the street is one of these, with its own
// silhouette, name and HUD label — a sedan does not read as a van, a taxi
// does not read as a cop car. Weights are the traffic mix (sedans common,
// sports cars rare); police is never picked for traffic, only spawned.
export const CAR_CLASSES = ['sedan', 'coupe', 'suv', 'van', 'taxi', 'sports'];
export const CAR_CLASS_WEIGHTS = [
  [0.32, 'sedan'], [0.16, 'coupe'], [0.16, 'suv'],
  [0.12, 'van'], [0.10, 'taxi'], [0.14, 'sports'],
];
export const CAR_CLASS_LABEL = {
  sedan: 'SEDAN', coupe: 'COUPE', suv: 'SUV', van: 'VAN',
  taxi: 'TAXI', sports: 'SPORTS', police: 'MBPD',
};
export const CAR_NAMES_BY_CLASS = {
  sedan: ['Sunset Cruiser', 'Bay Runner', 'Marlin Sedan', 'Coast Sedan'],
  coupe: ['Marlin Coupe', 'Dune GT', 'Comet Coupe'],
  suv: ['Harbor Hauler', 'Dune Runner', 'Pier Runner'],
  van: ['Pelican Van', 'Dockside Van', 'Harbor Van'],
  taxi: ['Meridian Cab', 'Bay Cab', 'Coast Taxi'],
  sports: ['Comet GT', 'Dune GT', 'Sunset GT'],
  police: ['MBPD Interceptor'],
};

export const RADIO_STATIONS = ['MERIDIAN FM 98.1', 'BAYWAVE 104.5', 'NEON NIGHTS 91.3'];

export const MISSIONS = [
  { id: 1, title: 'First Wheels', giver: 'Inez Kade', reward: 500, par: 120 },
  { id: 2, title: 'Courier Run', giver: 'Inez Kade', reward: 800, par: 90 },
  { id: 3, title: 'The Pickup', giver: 'Inez Kade', reward: 1000, par: 180 },
  { id: 4, title: 'Heat', giver: 'Inez Kade', reward: 1500, par: 150 },
  { id: 5, title: 'Pier Heist', giver: 'Inez Kade', reward: 2500, par: 240 },
  { id: 6, title: 'The Meridian Job', giver: 'Inez Kade', reward: 10000, par: 300 },
];

export const PACKAGE_COUNT = 10;
export const PACKAGE_REWARD = 250;

export const SAVE_KEY = 'meridian-bay.save.v1';

export const PALETTE = {
  sky: 0x8ec9ee,
  fog: 0xe3c69c,
  sun: 0xffe2ac,
  grass: 0x7d9b5e,
  sand: 0xe8d5a4,
  ocean: 0x2e7fa8,
  oceanDeep: 0x1d5f86,
  road: 0x3a3f46,
  roadLine: 0xe8e4d2,
  sidewalk: 0xb9b2a2,
  building: [0xf2e8d8, 0xe8b48c, 0x9fc8c8, 0xe89a8a, 0xd8d2c4, 0xa8c8e8, 0xf0d060],
  roof: 0x6a5a4a,
  palmTrunk: 0x8a6a48,
  palmLeaf: 0x3f8f4f,
  pierWood: 0x9a7a52,
  carPaint: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa856, 0xeeeeee, 0x222222, 0x7a4fc2, 0xe87a2e],
  policeWhite: 0xf2f2f2,
  policeBlack: 0x1a1a22,
  playerShirt: 0x2e8f86,
  playerPants: 0x2a3440,
  gangShirt: 0x8a2a2a,
  copShirt: 0x24344e,
  text: '#eef1f5',
  muted: '#b8c0cc',
  gold: '#f2c94c',
  // Polish pass: neon shop signs, beach umbrellas, street furniture.
  neon: [0xff5a5a, 0x35e0c8, 0xffc93c, 0xff7ad9, 0x7ab8ff],
  umbrella: [0xe84a5f, 0xffc93c, 0x35e0c8, 0xff7a2e, 0xf2f2f2],
  hydrant: 0xc23b2e,
  bush: 0x4a7a3f,
  signGreen: 0x2a6e3f,
  benchWood: 0x7a5a3a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
