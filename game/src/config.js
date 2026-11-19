// Meridian Bay — tuning, palette, districts, missions, cars, radio.
// One place for every number the rest of the game reads, so a balance
// change never means hunting through the systems that use it.

export const CONFIG = {
  title: 'MERIDIAN BAY',
  subtitle: 'Open-World Crime in a Sun-Soaked Port City',
  version: 'v7',

  // -- city grid ------------------------------------------------------------
  city: {
    blocks: 7, // 7 x 7 blocks
    block: 44, // a block's side, in metres
    road: 12, // a road's width
    pitch: 56, // block + road
    half: 190, // half the built-up span; beach starts past this
    beachX: 206, // sand begins here (east edge)
    seaX: 238, // water begins here
    groundY: 0,
  },

  // -- districts (name, centre, colour used on the minimap) -----------------
  districts: [
    { name: 'Old Port', x: -140, z: -140, color: '#e8a34c' },
    { name: 'Marina', x: 120, z: -140, color: '#4cc3e8' },
    { name: 'Downtown', x: 0, z: 0, color: '#e84c7a' },
    { name: 'Calle Verde', x: -140, z: 140, color: '#7ac74c' },
    { name: 'The Palms', x: 120, z: 140, color: '#c78ae8' },
  ],

  // -- bright palette (golden-hour friendly, never murky) -------------------
  palette: {
    skyDay: 0x7ecbf2,
    skyGolden: 0xffb36b,
    skyDusk: 0x8f7bd8,
    skyNight: 0x1b2a4a,
    sunDay: 0xfff2cc,
    sunGolden: 0xff9a3c,
    sunNight: 0x9db8ff,
    road: 0xaab0b8,
    roadLine: 0xfff6c9,
    sidewalk: 0xd8d2c4,
    sand: 0xf2d492,
    sea: 0x2fa8c9,
    grass: 0x86c96a,
    building: [0xffd9a0, 0xffb3c8, 0xa8dcff, 0xfff1a8, 0xc8f0c0, 0xffc4a3, 0xd9c2ff],
    heroCar: 0xff2e88, // hot pink Comet GT
    policeCar: 0x1c2733,
    taxi: 0xffc61a,
  },

  // -- on foot ---------------------------------------------------------------
  player: {
    walkSpeed: 5.2,
    runSpeed: 9.0,
    accel: 42,
    jumpSpeed: 8.5,
    gravity: 24,
    radius: 0.6,
    health: 100,
  },

  // -- driving ---------------------------------------------------------------
  car: {
    accel: 26,
    brake: 42,
    reverseAccel: 16,
    maxSpeed: 46, // ~166 km/h
    maxReverse: 12,
    steer: 1.9, // rad/s at full lock, scaled by speed
    grip: 8.5,
    handbrakeGrip: 2.2,
    radius: 1.6,
  },

  // -- wanted / police -------------------------------------------------------
  police: {
    maxWanted: 5,
    chaseSpeed: 40,
    ramSpeed: 46,
    bustTime: 3.0, // seconds boxed in at ~0 speed before BUSTED
    loseTime: 14, // seconds out of sight before a star drops
    loseDistance: 120,
    heliAtWanted: 3,
    maxCars: 6,
    maxFoot: 5,
  },

  // -- combat ----------------------------------------------------------------
  combat: {
    pistolDamage: 34,
    pistolAmmo: 12,
    pistolReserve: 60,
    punchDamage: 18,
    punchRange: 2.2,
    punchArc: 1.1,
    copHealth: 100,
    pedHealth: 60,
    playerRegen: 6, // hp/s while unwatched
  },

  // -- missions --------------------------------------------------------------
  missions: [
    {
      id: 'm1', chapter: 'CHAPTER 1', name: 'First Wheels',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'Cassian, you are back in Meridian Bay with nothing but a bus ticket. Steal a car and bring it to the Marina. No scratches. Well — few scratches.',
      reward: 990,
      stages: [
        { type: 'steal', text: 'Steal a car (press E near one)', hint: 'Any parked car will do. The pink Comet GT by the pier is sweet.' },
        { type: 'goto', text: 'Drive to the Marina marker', target: [150, -150], hint: 'Follow the yellow diamond. Watch the traffic.' },
      ],
    },
    {
      id: 'm2', chapter: 'CHAPTER 2', name: 'Courier Run',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'A package in Old Port needs to be in Downtown in ninety seconds. The Harbor Kings are watching the docks, so take the back streets.',
      reward: 1410, timeLimit: 90,
      stages: [
        { type: 'goto', text: 'Pick up the package in Old Port', target: [-150, -150], hint: 'Grab the glowing case by the crates.' },
        { type: 'timed', text: 'Deliver to Downtown before the timer ends', target: [20, 10], hint: 'Ninety seconds. Drive like you mean it.' },
      ],
    },
    {
      id: 'm3', chapter: 'CHAPTER 3', name: 'The Pickup',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'Three drops are hidden around Calle Verde. Collect them all and stay off the MBPD radar. The money is good and the risk is honest.',
      reward: 2200,
      stages: [
        { type: 'collect', text: 'Collect the drops in Calle Verde (0/3)', targets: [[-160, 120], [-110, 165], [-150, 60]], hint: 'Look for the gold glow. Three of them.' },
      ],
    },
    {
      id: 'm4', chapter: 'CHAPTER 4', name: 'Heat',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'The MBPD has your face on a board, Cassian. Get to three stars, then lose them. If they box you in, it is over — run the coast road.',
      reward: 13600,
      stages: [
        { type: 'wanted', text: 'Raise your wanted level to 3 stars', wanted: 3, hint: 'Steal cars, speed past patrols. Make them notice you.' },
        { type: 'escape', text: 'Lose the cops — break line of sight', hint: 'Hide in the alleys of Calle Verde until the stars fade.' },
      ],
    },
    {
      id: 'm5', chapter: 'CHAPTER 5', name: 'Pier Heist',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'A Harbor Kings van is parked on the pier with the week\'s take inside. Ram it, grab the cash, and be gone before the helicopter arrives.',
      reward: 6350,
      stages: [
        { type: 'goto', text: 'Reach the pier', target: [205, 0], hint: 'East, past the beach. The van is parked at the end.' },
        { type: 'ram', text: 'Ram the security van', target: [258, 0], hint: 'Hit it hard. Then take the cash.' },
        { type: 'goto', text: 'Escape to Calle Verde', target: [-140, 140], hint: 'Lose the tail on the way south.' },
      ],
    },
    {
      id: 'm6', chapter: 'CHAPTER 6', name: 'The Meridian Job',
      giver: 'Inez Kade', role: 'FIXER',
      brief: 'The Meridian Bank vault, tonight, golden hour. Grab the cash, outrun the whole MBPD, and meet the boat at the Marina. This is the one, Cassian.',
      reward: 6400,
      stages: [
        { type: 'goto', text: 'Reach Meridian Bank, Downtown', target: [10, -10], hint: 'Downtown tower, gold doors.' },
        { type: 'grab', text: 'Grab the vault cash', target: [10, -10], hint: 'Hold E at the vault.' },
        { type: 'goto', text: 'Break through the Downtown cordon — 4 stars', target: [-40, -100], hint: 'Four stars. Do not stop for anything.' },
        { type: 'escape', text: 'Escape to the Marina boat', target: [150, -150], hint: 'Four stars. Helicopter up. Do not stop.' },
      ],
    },
  ],

  // -- side activities -------------------------------------------------------
  side: {
    packages: 10, // hidden packages around the city
    packageReward: 500,
    taxiFare: 120,
    startCash: 250,
    repPerMission: 14,
  },

  // -- cars that spawn in the world ------------------------------------------
  carModels: [
    { name: 'Comet GT', color: 0xff2e88, speed: 1.15, sport: true },
    { name: 'Marlin S', color: 0x2fb7ff, speed: 1.0, sport: false },
    { name: 'Coral Cruiser', color: 0xff7a3c, speed: 0.92, sport: false },
    { name: 'Sunset LX', color: 0xffd23c, speed: 0.95, sport: false },
    { name: 'Harbor Van', color: 0xe8e8e8, speed: 0.8, sport: false, van: true },
    { name: 'Palm Sedan', color: 0x7ac74c, speed: 0.9, sport: false },
    { name: 'Neon Coupe', color: 0xb46bff, speed: 1.08, sport: true },
  ],

  // -- radio -----------------------------------------------------------------
  radio: [
    { station: 'MERIDIAN FM 101.2', song: 'Neon Coast — Sunset Drive' },
    { station: 'BAY WAVE 88.4', song: 'Palms & Chrome — Midnight Run' },
    { station: 'CALLE VERDE 95.7', song: 'Los Reyes — Calle Caliente' },
  ],

  // -- dialogue lines ---------------------------------------------------------
  lines: {
    steal: [
      { name: 'Inez Kade', role: 'FIXER', text: 'Nice. Now bring it to the Marina — and try not to total it.' },
    ],
    busted: [
      { name: 'MBPD Dispatch', role: 'DISPATCH', text: 'Suspect in custody. Units stand down. The Bay stays quiet — tonight.' },
    ],
    complete: [
      { name: 'Inez Kade', role: 'FIXER', text: 'Thirty-one thousand and change, Cassian. The Meridian Job is done. Meridian Bay is ours.' },
    ],
    package: [
      { name: 'Inez Kade', role: 'FIXER', text: 'One package down. Keep them coming — each one pays.' },
    ],
    taxi: [
      { name: 'Passenger', role: 'FARE', text: 'Marina, please — and step on it, I am late for a boat.' },
    ],
  },

  // -- police unit names for the response panel ------------------------------
  units: ['MBPD-12', 'MBPD-07', 'MBPD-21', 'MBPD-33', 'MBPD-04', 'MBPD-18', 'MBPD-26', 'MBPD-40'],
};

// District lookup: nearest district centre wins; the beach strip is Marina.
export function districtAt(x, z) {
  if (x > CONFIG.city.beachX) return 'Marina Beach';
  let best = CONFIG.districts[0];
  let bestD = Infinity;
  for (const d of CONFIG.districts) {
    const dx = x - d.x;
    const dz = z - d.z;
    const dist = dx * dx + dz * dz;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best.name;
}

// Street name from the nearest road, for the minimap readout.
export function streetAt(x, z) {
  const { pitch } = CONFIG.city;
  const rx = Math.abs(x) % pitch;
  const rz = Math.abs(z) % pitch;
  const onVertical = Math.min(rx, pitch - rx) < 8;
  const onHorizontal = Math.min(rz, pitch - rz) < 8;
  if (onVertical && !onHorizontal) return 'Meridian Ave';
  if (onHorizontal && !onVertical) return 'Bayfront Blvd';
  if (onVertical && onHorizontal) return 'Meridian Ave / Bayfront Blvd';
  return 'Side street';
}
