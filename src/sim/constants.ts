// Core tuning values for the simulation. Everything here is in metres,
// seconds and radians. The simulation never reads the frame rate: it runs in
// fixed SIM_DT steps so 30, 60 and 120 fps play identically.

export const LANE_WIDTH = 2.2;
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const ROAD_HALF_WIDTH = LANE_WIDTH * 1.5;
/** Right-hand shoulder used by the chaser vehicle. Never part of the lanes. */
export const CHASER_LANE_X = 5.2;

export const SIM_DT = 1 / 120;
/** Frame deltas above this (tab suspension, debugger) are clamped. */
export const MAX_FRAME_DT = 0.1;

export const GRAVITY = 42;
export const JUMP_V = 13.5;
export const JUMP_AIRTIME = (2 * JUMP_V) / GRAVITY;
export const JUMP_PEAK = (JUMP_V * JUMP_V) / (2 * GRAVITY);
export const FAST_FALL_V = 24;
export const SLIDE_TIME = 0.72;
export const LANE_CHANGE_TIME = 0.15;
export const LANE_SPEED = LANE_WIDTH / LANE_CHANGE_TIME;
export const COYOTE_TIME = 0.08;
export const INPUT_BUFFER_TIME = 0.16;

export const PLAYER_HALF_W = 0.36;
export const PLAYER_HALF_D = 0.3;
export const PLAYER_STAND_H = 1.75;
export const PLAYER_SLIDE_H = 0.8;

export const BASE_SPEED = 13;
export const MAX_SPEED = 26;
export const SPEED_RAMP_DIST = 3200;
export const ACCEL = 9;
export const SPEED_FACTOR = { chase: 1.1, speedRun: 1.25, vikas: 1.4 } as const;
/** The generator spaces rows for this multiple of base speed, so a Speed Run
 * or chase can never shrink reaction windows below the design target. */
export const GEN_SPEED_MARGIN = 1.25;

export const SPAWN_AHEAD_TIME = 5;
export const SPAWN_AHEAD_MIN = 80;
export const DESPAWN_BEHIND = 16;

export const STUMBLE_TIME = 0.75;
export const STUMBLE_TIMESCALE = 0.3;
export const CINEMATIC_FULL = 4.0;
export const CINEMATIC_SHORT = 1.6;
export const EVENT_PENDING_MAX = 2.5;
/** Rivalry Mode: the "Political Challenge Ahead!" warning shows at least this long before the stumble. */
export const CHALLENGE_WARNING = 1.0;
export const SUCCESS_TIME = 1.8;
export const FAILURE_TIME = 1.9;
export const GUARD_RECHARGE = 10;
export const CHASE_FULL = 20;
export const CHASE_SHORT = 15;
export const CHASE_CHALLENGE = 30;
export const CHASE_DODGE_REWARD = 0.6;
export const CHASE_TOKEN_TIME = 2.5;
export const CHASE_OPENING_CLEAR = 2.6;

export const THEME_SEGMENT = 750;
export const MAGNET_TIME = 8;
export const VIKAS_TIME = 5;
export const SPEED_RUN_TIME = 8;
export const SPEED_RUN_WARNING = 2.5;

/** Development Race: course length (m) and the rival's pace as a fraction of base speed. */
export const RACE_LENGTH = 1500;
export const RACE_PACE = 1.03;

/** Manifesto Mayhem: metres until the rival's manifesto runs empty. */
export const MAYHEM_LENGTH = 1200;
