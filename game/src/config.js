// NIGHTSHADE — shared tuning numbers for the stealth game.
// One place holds every speed, range and timing so the sim, the renderer
// and the autopilot all agree on what the game feels like.

export const STEP = 1 / 60;

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Player movement (pixels per second).
export const WALK_SPEED = 150;
export const RUN_SPEED = 250;
export const CROUCH_SPEED = 80;
export const PLAYER_RADIUS = 12;

// Guard senses.
export const VISION_RANGE = 250;
export const VISION_HALF_ANGLE = 0.62; // radians, about 35 degrees each side
export const HEARING_RANGE = 270; // how far running footsteps carry
export const GUARD_TOUCH = 26; // a chasing guard this close catches the thief

// How fast suspicion grows when the thief is seen (per second, at point blank,
// standing in the open). Distance, crouching and shadow all slow it down.
export const SPOT_RATE = 1.1;
export const SPOT_DECAY = 0.45; // suspicion lost per second while unseen

export const CHASE_SPEED = 235;
export const PATROL_SPEED = 70;
export const INVESTIGATE_SPEED = 120;
export const CHASE_MEMORY = 4.0; // seconds a guard hunts without seeing you
export const LOOK_AROUND_TIME = 2.0; // seconds spent searching a last-seen spot

export const RELIC_SCORE = 100;
export const LEVEL_BONUS = 250;
export const START_LIVES = 3;
export const RELICS_PER_LEVEL = 3;
