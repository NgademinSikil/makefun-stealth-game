// NIGHTSHADE — the three rooms. Each level is plain data: where the walls
// stand, where the dark corners are, where the relics wait, where the
// guards walk, where the door out is, and where the thief slips in.
// Nothing here runs; world.js reads it and brings it to life.

export const LEVELS = [
  {
    name: 'The Gallery',
    hint: 'Lift all three relics, then slip out the east door unseen.',
    start: { x: 60, y: 360 },
    exit: { x: 1216, y: 48, w: 48, h: 84 },
    walls: [
      { x: 560, y: 280, w: 160, h: 120 }, // display block
      { x: 250, y: 450, w: 90, h: 90 }, // plinth
      { x: 850, y: 150, w: 220, h: 60 }, // long shelf
    ],
    shadows: [
      { x: 120, y: 120, w: 180, h: 140 },
      { x: 950, y: 480, w: 200, h: 150 },
    ],
    relics: [
      { x: 640, y: 180 },
      { x: 1150, y: 600 },
      { x: 150, y: 600 },
    ],
    guards: [
      { path: [[380, 180], [380, 520]], pause: 0.9 },
      { path: [[820, 260], [1080, 260], [1080, 560], [820, 560]], pause: 0.7 },
    ],
  },
  {
    name: 'The Vault Hall',
    hint: 'Three guards now, and the vault door only opens for three relics.',
    start: { x: 60, y: 80 },
    exit: { x: 1216, y: 600, w: 48, h: 84 },
    walls: [
      { x: 300, y: 150, w: 120, h: 200 }, // vault column
      { x: 700, y: 350, w: 200, h: 90 }, // strongbox row
      { x: 950, y: 120, w: 90, h: 220 }, // pillar
      { x: 200, y: 500, w: 220, h: 70 }, // low counter
    ],
    shadows: [
      { x: 80, y: 80, w: 200, h: 120 },
      { x: 1000, y: 520, w: 180, h: 140 },
      { x: 520, y: 520, w: 160, h: 120 },
    ],
    relics: [
      { x: 640, y: 120 },
      { x: 120, y: 650 },
      { x: 1120, y: 360 },
    ],
    guards: [
      { path: [[470, 200], [470, 620]], pause: 0.8 },
      { path: [[520, 120], [880, 120]], pause: 1.0 },
      { path: [[850, 480], [1150, 480], [1150, 640], [850, 640]], pause: 0.6 },
    ],
  },
  {
    name: 'The Rooftop Garden',
    hint: 'The last room. The guards are quicker here — patience wins.',
    start: { x: 60, y: 360 },
    exit: { x: 1216, y: 320, w: 48, h: 84 },
    walls: [
      { x: 350, y: 200, w: 180, h: 70 }, // planter
      { x: 750, y: 450, w: 180, h: 70 }, // planter
      { x: 500, y: 80, w: 90, h: 140 }, // fountain base
      { x: 950, y: 180, w: 70, h: 180 }, // hedge block
    ],
    shadows: [
      { x: 60, y: 500, w: 220, h: 140 },
      { x: 1050, y: 60, w: 170, h: 130 },
      { x: 560, y: 300, w: 160, h: 110 },
    ],
    relics: [
      { x: 200, y: 120 },
      { x: 1180, y: 640 },
      { x: 640, y: 640 },
    ],
    guards: [
      { path: [[300, 120], [300, 600]], pause: 0.7 },
      { path: [[650, 150], [1050, 150], [1050, 500]], pause: 0.8 },
      { path: [[900, 600], [1200, 600], [1200, 300]], pause: 0.6 },
    ],
  },
];
