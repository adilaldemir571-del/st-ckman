import { GameMap } from './types';

export const MAPS: Record<string, GameMap> = {
  lava: {
    id: 'lava',
    name: 'Volcanic Core',
    backgroundColor: '#1a0505', // Deep dark red
    groundColor: '#2a2a2a', // Dark rock
    spawnP1: { x: 50, y: 350 },
    spawnP2: { x: 750, y: 350 },
    platforms: [
      // Main central arena - broken into steps
      { x: 200, y: 450, width: 400, height: 40, type: 'solid' }, // Center bridge
      { x: 100, y: 350, width: 100, height: 200, type: 'solid' }, // Left Tower Base
      { x: 600, y: 350, width: 100, height: 200, type: 'solid' }, // Right Tower Base
      
      // Floating hazards
      { x: 300, y: 550, width: 200, height: 20, type: 'hazard' }, // Lava pit bottom
      
      // Upper platforms
      { x: 250, y: 250, width: 80, height: 20, type: 'solid' }, // High left
      { x: 470, y: 250, width: 80, height: 20, type: 'solid' }, // High right
      { x: 360, y: 150, width: 80, height: 20, type: 'solid' }, // Top peak
    ],
  },
  castle: {
    id: 'castle',
    name: 'Shadow Fortress',
    backgroundColor: '#0f172a', // Dark slate
    groundColor: '#334155', // Slate stone
    spawnP1: { x: 100, y: 400 },
    spawnP2: { x: 700, y: 400 },
    platforms: [
      { x: 0, y: 500, width: 800, height: 100, type: 'solid' }, // Ground
      { x: 50, y: 350, width: 150, height: 20, type: 'solid' }, // Left platform
      { x: 600, y: 350, width: 150, height: 20, type: 'solid' }, // Right platform
      { x: 300, y: 250, width: 200, height: 20, type: 'solid' }, // Top center
      { x: 350, y: 400, width: 100, height: 100, type: 'solid' }, // Center block
    ],
  },
  forest: {
    id: 'forest',
    name: 'Moonlit Grove',
    backgroundColor: '#051a10', // Dark forest green
    groundColor: '#1e293b', // Dark wood/stone
    spawnP1: { x: 100, y: 300 },
    spawnP2: { x: 700, y: 300 },
    platforms: [
      { x: 0, y: 500, width: 200, height: 100, type: 'solid' }, // Left Base
      { x: 600, y: 500, width: 200, height: 100, type: 'solid' }, // Right Base
      { x: 200, y: 450, width: 400, height: 20, type: 'solid' }, // Low bridge
      { x: 100, y: 300, width: 150, height: 20, type: 'solid' }, // High left
      { x: 550, y: 300, width: 150, height: 20, type: 'solid' }, // High right
      { x: 350, y: 200, width: 100, height: 20, type: 'solid' }, // Top perch
    ],
  },
  creative: {
    id: 'creative',
    name: 'Creative Sandbox',
    backgroundColor: '#1e1e2f',
    groundColor: '#2d2d44',
    spawnP1: { x: 100, y: 400 },
    spawnP2: { x: 700, y: 400 },
    platforms: [
      { x: 0, y: 500, width: 800, height: 100, type: 'solid' }, // Ground
      { x: 100, y: 350, width: 200, height: 20, type: 'solid' },
      { x: 500, y: 350, width: 200, height: 20, type: 'solid' },
      { x: 300, y: 200, width: 200, height: 20, type: 'solid' },
    ],
  },
};
