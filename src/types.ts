
export type Vector2 = { x: number; y: number };

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WeaponType = 'sword' | 'spear' | 'bow' | 'axe';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'block' | 'hit' | 'dead' | 'boss_intro';

export type GameMode = 'local' | 'online' | 'wave' | 'story';

export type HealthBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
};

export type BuffType = 'damage' | 'speed';

export type BuffBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BuffType;
  active: boolean;
};

export type Player = {
  id: string | number;
  name?: string;
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  color: string;
  health: number;
  maxHealth: number;
  state: PlayerState;
  facing: 1 | -1; // 1 right, -1 left
  isGrounded: boolean;
  currentWeapon: WeaponType;
  attackCooldown: number;
  maxAttackCooldown: number;
  blockCooldown: number;
  weaponSwitchCooldown: number;
  maxWeaponSwitchCooldown: number;
  hitStun: number;
  projectiles: Projectile[];
  score: number;
  wins: number;
  shield: number;
  maxShield: number;
  lastHitTimer: number;
  isAI: boolean;
  aiType?: 'minion' | 'boss';
  buffs: {
    damage: number; // multiplier
    speed: number; // multiplier
    timer: number;
  };
  ready?: boolean;
};

export type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type Projectile = {
  id: string;
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  damage: number;
  ownerId: string | number;
  active: boolean;
};

export type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
};

export type Room = {
  id: string;
  players: Record<string, Player>;
  chat: ChatMessage[];
  gameState: 'lobby' | 'playing' | 'gameover';
  mapId: MapType;
  mode: GameMode;
  wave: number;
  storyLevel: number;
};

export type MapType = 'forest' | 'castle' | 'lava';

export type Platform = Box & {
  type?: 'solid' | 'hazard'; // hazard deals damage (lava)
};

export type VisualEffect = {
  type: 'slash';
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  life: number;
  maxLife: number;
};

export type GameMap = {
  id: MapType;
  name: string;
  platforms: Platform[];
  spawnP1: Vector2;
  spawnP2: Vector2;
  backgroundColor: string;
  groundColor: string;
};

export const GRAVITY = 0.6;
export const FRICTION = 0.8;
export const MOVE_SPEED = 5;
export const JUMP_FORCE = -12;
