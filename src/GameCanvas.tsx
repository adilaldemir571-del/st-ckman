import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './GameEngine';
import { InputManager } from './InputManager';
import { MAPS } from './maps';
import { Player, Particle, Room, GameMode } from './types';
import { socket } from './socket';

interface GameCanvasProps {
  mode: GameMode;
  mapId: string;
  onGameOver: (winner: string | number, score1: number, score2: number) => void;
  onLevelComplete?: (level: number) => void;
  isOnline?: boolean;
  roomId?: string;
  initialPlayers?: Player[];
  playerName?: string;
  startLevel?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ mode, mapId, onGameOver, onLevelComplete, isOnline, roomId, initialPlayers, playerName, startLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const [roomData, setRoomData] = useState<Room | null>(null);

  useEffect(() => {
    if (isOnline) {
      socket.on('room-update', (data: Room) => {
        setRoomData(data);
      });

      socket.on('remote-player-update', ({ id, ...state }: any) => {
        if (engineRef.current) {
          const player = engineRef.current.players.find(p => p.id === id);
          if (player) {
            Object.assign(player, state);
          } else {
            // Add new player if they don't exist
            engineRef.current.players.push({
              id,
              ...state
            });
          }
        }
      });

      socket.on('remote-projectile-fired', (projectile: any) => {
        if (engineRef.current) {
          engineRef.current.projectiles.push(projectile);
        }
      });

      socket.on('remote-player-hit', ({ targetId, damage, attackerId }: any) => {
        if (engineRef.current) {
          const target = engineRef.current.players.find(p => p.id === targetId);
          if (target) {
            engineRef.current.damagePlayer(target, damage, 4, attackerId);
          }
        }
      });
    }

    return () => {
      socket.off('room-update');
      socket.off('remote-player-update');
      socket.off('remote-projectile-fired');
      socket.off('remote-player-hit');
    };
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && roomData && engineRef.current) {
      // Remove players that left
      engineRef.current.players = engineRef.current.players.filter(p => 
        p.isAI || roomData.players[p.id as string]
      );
      
      // Add players that joined
      Object.values(roomData.players).forEach((rp: any) => {
        if (!engineRef.current!.players.find(p => p.id === rp.id)) {
          engineRef.current!.players.push({
            id: rp.id,
            name: rp.name,
            color: rp.color,
            position: { x: 400, y: 100 }, // Default spawn
            velocity: { x: 0, y: 0 },
            width: 30,
            height: 70,
            health: 100,
            maxHealth: 100,
            state: 'idle',
            facing: 1,
            isGrounded: false,
            currentWeapon: 'sword',
            attackCooldown: 0,
            maxAttackCooldown: 0,
            blockCooldown: 0,
            weaponSwitchCooldown: 0,
            maxWeaponSwitchCooldown: 0,
            hitStun: 0,
            projectiles: [],
            score: 0,
            wins: 0,
            shield: 100,
            maxShield: 100,
            lastHitTimer: 0,
            isAI: false,
            buffs: { damage: 1, speed: 1, timer: 0 }
          });
        }
      });
    }
  }, [roomData, isOnline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const input = new InputManager();
    const map = MAPS[mapId] || MAPS['lava'];
    
    const engine = new GameEngine(map, input, {
      mode,
      isOnline,
      roomId,
      localPlayerId: socket.id,
      players: initialPlayers
    });

    if (mode === 'story') {
        engine.onLevelComplete = (level) => {
            if (onLevelComplete) onLevelComplete(level);
        };
        if (startLevel) {
            engine.storyLevel = startLevel;
            engine.restartStoryLevel();
        }
    }

    engineRef.current = engine;

    const render = () => {
      engine.update();

      // Clear & Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, map.backgroundColor);
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Map
      engine.map.platforms.forEach(p => {
        ctx.save();
        if (p.type === 'hazard') {
            // Lava glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4500';
            ctx.fillStyle = '#ff4500';
            ctx.fillRect(p.x, p.y + 10, p.width, p.height);
            
            // Lava surface
            ctx.fillStyle = '#ff8c00';
            ctx.fillRect(p.x, p.y, p.width, 10);
        } else {
            // Platform styling
            ctx.fillStyle = map.groundColor;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(p.x, p.y, p.width, 5);
            
            // Border
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.width, p.height);
        }
        ctx.restore();
      });
      
      // Atmospheric Effects
      if (map.id === 'forest') {
          // Fog
          const time = Date.now() / 5000;
          ctx.fillStyle = 'rgba(200, 220, 255, 0.05)';
          for(let i=0; i<5; i++) {
              const x = ((time * 50) + (i * 200)) % (canvas.width + 200) - 200;
              const y = 200 + Math.sin(time + i) * 50;
              ctx.beginPath();
              ctx.arc(x, y, 100, 0, Math.PI*2);
              ctx.fill();
          }
      } else if (map.id === 'lava') {
          // Heat haze / rising embers
          if (Math.random() > 0.9) {
              const x = Math.random() * canvas.width;
              engine.particles.push({
                  id: Math.random().toString(),
                  x,
                  y: canvas.height,
                  vx: (Math.random() - 0.5) * 0.5,
                  vy: -1 - Math.random(),
                  life: 100,
                  maxLife: 100,
                  color: 'rgba(255, 100, 0, 0.5)',
                  size: 2 + Math.random() * 2
              });
          }
      } else if (map.id === 'castle') {
          // Dust / Old atmosphere
          if (Math.random() > 0.95) {
              const x = Math.random() * canvas.width;
              const y = Math.random() * canvas.height;
              engine.particles.push({
                  id: Math.random().toString(),
                  x,
                  y,
                  vx: (Math.random() - 0.5) * 0.2,
                  vy: (Math.random() - 0.5) * 0.2,
                  life: 150,
                  maxLife: 150,
                  color: 'rgba(200, 200, 200, 0.2)',
                  size: 1 + Math.random() * 2
              });
          }
      }

      // Draw Particles
      engine.particles.forEach(p => {
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
      });

      // Draw Buff Boxes
      engine.buffBoxes.forEach(box => {
          ctx.save();
          const color = box.type === 'damage' ? '#f97316' : '#06b6d4';
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 5);
          ctx.fill();
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(box.type === 'damage' ? 'D' : 'S', box.x + box.width/2, box.y + box.height/2);
          ctx.restore();
      });

      // Draw Visual Effects (Slashes)
      engine.visualEffects.forEach(effect => {
          ctx.save();
          ctx.globalAlpha = effect.life / effect.maxLife;
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, effect.startAngle, effect.endAngle);
          ctx.stroke();
          ctx.restore();
      });

    // Draw Players (Stickman)
    engine.players.forEach(p => {
        drawStickman(ctx, p);
        
        // Draw health bar above AI players
        if (p.isAI && p.state !== 'dead') {
            const barWidth = 40;
            const barHeight = 4;
            const bx = p.position.x + p.width / 2 - barWidth / 2;
            const by = p.position.y - 15;
            
            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx, by, barWidth, barHeight);
            
            // Health
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(bx, by, barWidth * (p.health / p.maxHealth), barHeight);
            
            // Shield if any
            if (p.shield > 0) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(bx, by - 2, barWidth * (p.shield / p.maxShield), 2);
            }
        }
    });

      // Draw Health Boxes
      engine.healthBoxes.forEach(box => {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(box.x, box.y, box.width, box.height);
          
          // Cross
          ctx.fillStyle = 'white';
          ctx.fillRect(box.x + 12, box.y + 5, 6, 20);
          ctx.fillRect(box.x + 5, box.y + 12, 20, 6);
          
          // Glow
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.shadowBlur = 0;
      });

      // Draw Projectiles
      engine.projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.position.x, p.position.y);
        ctx.rotate(Math.atan2(p.velocity.y, p.velocity.x));
        
        // Arrow shaft
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        
        // Arrow head
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -3);
        ctx.lineTo(5, 3);
        ctx.fill();
        
        // Trail
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-30, 0);
        ctx.stroke();
        
        ctx.restore();
      });

      // UI Overlay
      drawUI(ctx, engine);
      
      // Round Start Overlay
      if (engine.roundState === 'start') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.save();
          ctx.translate(canvas.width/2, canvas.height/2);
          
          const roundNum = engine.players[0].score + engine.players[1].score + 1;
          
          ctx.fillStyle = 'white';
          ctx.font = '900 64px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 20;
          ctx.fillText(`ROUND ${roundNum}`, 0, -20);
          
          ctx.font = 'bold 32px sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText("READY?", 0, 40);
          
          ctx.restore();
      } else if (engine.roundState === 'fight' && engine.roundTimer < 90) { 
           // Show FIGHT!
          ctx.save();
          ctx.translate(canvas.width/2, canvas.height/2);
          
          // Scale effect
          const scale = 1 + (Math.sin(engine.roundTimer * 0.5) * 0.1);
          ctx.scale(scale, scale);
          
          ctx.fillStyle = '#ef4444';
          ctx.font = '900 80px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 20;
          ctx.fillText("FIGHT!", 0, 0);
          
          ctx.restore();
      }

      if (engine.gameEnded && engine.winner) {
        // Pass wave and time for records
        onGameOver(
            engine.winner, 
            engine.players[0].wins, 
            engine.players[1]?.wins || 0,
            engine.mode === 'wave' ? engine.wave : undefined,
            engine.mode === 'wave' ? Math.floor(engine.totalTime / 60) : undefined // Convert frames to seconds
        );
      } else {
        requestRef.current = requestAnimationFrame(render);
      }
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(requestRef.current);
      input.cleanup();
    };
  }, [mapId]);

  const drawStickman = (ctx: CanvasRenderingContext2D, p: Player) => {
    ctx.save();
    
    // Hit flash
    if (p.hitStun > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
        ctx.filter = 'brightness(200%)';
    }

    // Buff Aura
    if (p.buffs.timer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = p.buffs.damage > 1 ? '#f97316' : '#06b6d4';
        ctx.beginPath();
        ctx.arc(p.position.x + p.width/2, p.position.y + p.height/2, 40 + Math.sin(Date.now()/200)*5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    const cx = p.position.x + p.width / 2;
    const cy = p.position.y + p.height / 2;

    ctx.translate(cx, cy);
    ctx.scale(p.facing, 1);

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Animation States
    const time = Date.now() / 100;
    let legOffset = 0;
    let armOffset = 0;
    
    const attackProgress = p.maxAttackCooldown > 0 ? (p.maxAttackCooldown - p.attackCooldown) / p.maxAttackCooldown : 0;

    if (p.state === 'run') {
        legOffset = Math.sin(time * 1.5) * 10;
        armOffset = Math.cos(time * 1.5) * 10;
    } else if (p.state === 'idle') {
        armOffset = Math.sin(time * 0.5) * 2;
    }

    // --- Body Parts ---
    
    // Head
    ctx.fillStyle = '#fff'; // White head
    ctx.beginPath();
    ctx.arc(0, -25, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Torso
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(0, 10);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(0, 10);
    if (p.state === 'jump') {
        ctx.lineTo(-10, 25); // Left Leg
        ctx.moveTo(0, 10);
        ctx.lineTo(10, 20); // Right Leg
    } else {
        ctx.lineTo(-8 + legOffset, 30); // Left Leg
        ctx.moveTo(0, 10);
        ctx.lineTo(8 - legOffset, 30); // Right Leg
    }
    ctx.stroke();

    // Arms & Weapon
    // Back Arm
    ctx.beginPath();
    ctx.moveTo(0, -10);
    if (p.state === 'attack') {
        ctx.lineTo(-10, 0);
    } else {
        ctx.lineTo(-10 - armOffset, 5);
    }
    ctx.stroke();

    // Front Arm (holding weapon)
    ctx.beginPath();
    ctx.moveTo(0, -10);
    
    let handX = 15;
    let handY = 0;

    if (p.state === 'attack') {
        if (p.currentWeapon === 'sword') {
             // Swing arm from up to down
             const swingAngle = -Math.PI/2 + attackProgress * Math.PI;
             handX = Math.cos(swingAngle) * 25;
             handY = -10 + Math.sin(swingAngle) * 25;
        } else if (p.currentWeapon === 'spear') {
             // Thrust arm forward
             handX = 15 + attackProgress * 20;
             handY = -5;
        } else if (p.currentWeapon === 'bow') {
             handX = 20 - attackProgress * 5;
             handY = -5;
        }
    } else if (p.state === 'block') {
        handX = 10; handY = -5;
    } else {
        handX = 15 + armOffset; handY = 5;
    }
    
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Draw Weapon
    drawWeapon(ctx, p, handX, handY, attackProgress);
    
    // Shield/Block visual
    if (p.state === 'block' || p.shield > 0) {
        ctx.save();
        ctx.strokeStyle = p.state === 'block' ? '#FFD700' : '#000000'; // Gold for block, Black for shield
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (p.state === 'block') {
            ctx.arc(0, 0, 35, -Math.PI/3, Math.PI/3);
        } else {
            ctx.globalAlpha = 0.3 * (p.shield / p.maxShield);
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
        }
        ctx.stroke();
        if (p.state === 'block') {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#FFD700';
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore();
  };

  const drawWeapon = (ctx: CanvasRenderingContext2D, p: Player, handX: number, handY: number, attackProgress: number) => {
      ctx.save();
      ctx.translate(handX, handY);
      
      if (p.currentWeapon === 'sword') {
          // Sword
          if (p.state === 'attack') {
              // Rotate sword with the swing
              const swordRotation = -Math.PI/4 + attackProgress * Math.PI;
              ctx.rotate(swordRotation);
          } else {
              ctx.rotate(-Math.PI / 4);
          }
          
          // Hilt
          ctx.fillStyle = '#333';
          ctx.fillRect(-2, -5, 4, 10);
          ctx.fillRect(-6, -5, 12, 2);
          
          // Blade
          ctx.fillStyle = '#eee';
          ctx.beginPath();
          ctx.moveTo(-2, 0);
          ctx.lineTo(-2, 35);
          ctx.lineTo(0, 40);
          ctx.lineTo(2, 35);
          ctx.lineTo(2, 0);
          ctx.fill();
      } else if (p.currentWeapon === 'spear') {
          // Spear
          if (p.state === 'attack') {
              // Thrust forward
              ctx.translate(attackProgress * 15, 0);
              ctx.rotate(0);
          } else {
              ctx.rotate(-Math.PI / 6);
          }
          
          // Shaft
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(-40, -2, 80, 4);
          
          // Head
          ctx.fillStyle = 'silver';
          ctx.beginPath();
          ctx.moveTo(40, -4);
          ctx.lineTo(55, 0);
          ctx.lineTo(40, 4);
          ctx.fill();
          
          if (p.state === 'attack') {
             // Thrust trail
             ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.fillRect(40, -2, 30, 4);
          }

      } else if (p.currentWeapon === 'bow') {
          // Bow
          if (p.state === 'attack') {
              ctx.translate(-attackProgress * 5, 0);
          } else {
              ctx.rotate(-Math.PI / 2);
          }
          
          ctx.strokeStyle = '#8B4513';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 20, -Math.PI/2, Math.PI/2);
          ctx.stroke();
          
          // String
          ctx.strokeStyle = '#eee';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -20);
          if (p.state === 'attack') {
              ctx.lineTo(-10 + attackProgress * 10, 0);
          }
          ctx.lineTo(0, 20);
          ctx.stroke();
          
          // Arrow
          if (p.state === 'attack' && attackProgress < 0.2) {
              ctx.fillStyle = '#eee';
              ctx.fillRect(-15, -1, 30, 2);
          }
      }
      
      ctx.restore();
  };

  const drawUI = (ctx: CanvasRenderingContext2D, engine: GameEngine) => {
    // Top Bar Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 800, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(800, 70);
    ctx.stroke();

    // Health Bars for all players (only human players in top UI)
    engine.players.forEach((p, i) => {
      if (p.isAI) return; // Don't show AI health in top UI
      const x = i < 2 ? 30 + (i * 440) : 30 + ((i-2) * 440);
      const y = i < 2 ? 20 : 50;
      drawHealthBar(ctx, x, y, p.health, p.shield, p.color, p.name || `PLAYER ${p.id}`, p.wins);
    });

    // Score / Info (Center)
    ctx.fillStyle = 'white';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    
    if (engine.mode === 'wave') {
        ctx.fillText(`WAVE ${engine.wave}`, 400, 45);
    } else if (engine.mode === 'story') {
        ctx.fillText(`CHAPTER ${engine.storyLevel}`, 400, 45);
        
        // Draw Objective
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(engine.storyObjective, 400, 65);
        ctx.restore();

        // Save indicator
        ctx.save();
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText("AUTO-SAVED", 400, 80);
        ctx.restore();
    } else {
        const scores = engine.players.slice(0, 2).map(p => p.wins).join(' - ');
        ctx.fillText(scores, 400, 45);
    }
    
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    
    // Weapon Icons (Bottom)
    engine.players.forEach((p, i) => {
      if (p.id === engine.localPlayerId || !isOnline) {
        const x = i % 2 === 0 ? 30 : 610;
        drawWeaponHUD(ctx, x, 530, p);
      }
    });
  };
  
  const drawHealthBar = (ctx: CanvasRenderingContext2D, x: number, y: number, health: number, shield: number, color: string, label: string, wins: number) => {
      // Back
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(x, y, 300, 20, 10);
      ctx.fill();
      
      // Health Fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, 300 * (health / 100), 20, 10);
      ctx.fill();

      // Shield Fill (Thin bar on top)
      if (shield > 0) {
          ctx.fillStyle = '#000000'; // Black shield bar
          ctx.beginPath();
          ctx.roundRect(x, y, 300 * (shield / 100), 6, 10);
          ctx.fill();
      }
      
      // Border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, 300, 20, 10);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${label} (${wins} WINS)`, x + 10, y + 14);
  };
  
  const drawWeaponHUD = (ctx: CanvasRenderingContext2D, x: number, y: number, player: Player) => {
      const weapons = ['sword', 'spear', 'bow'];
      const boxSize = 40;
      const gap = 5;
      
      // Draw Cooldown Bar (Global for switching)
      if (player.weaponSwitchCooldown > 0) {
          const totalWidth = (boxSize * 3) + (gap * 2);
          const ratio = player.weaponSwitchCooldown / player.maxWeaponSwitchCooldown;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(x, y - 10, totalWidth, 5);
          
          ctx.fillStyle = 'white';
          ctx.fillRect(x, y - 10, totalWidth * ratio, 5);
      }

      weapons.forEach((w, i) => {
          const bx = x + (i * (boxSize + gap));
          const isSelected = player.currentWeapon === w;
          
          // Box Background
          ctx.fillStyle = isSelected ? player.color : 'rgba(0,0,0,0.5)';
          if (isSelected) ctx.globalAlpha = 0.8;
          ctx.fillRect(bx, y, boxSize, boxSize);
          ctx.globalAlpha = 1;
          
          // Border
          ctx.strokeStyle = isSelected ? 'white' : 'rgba(255,255,255,0.3)';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(bx, y, boxSize, boxSize);
          
          // Icon/Text
          ctx.fillStyle = isSelected ? 'black' : 'white';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          let label = '';
          switch(w) {
              case 'sword': label = 'SWD'; break;
              case 'spear': label = 'SPR'; break;
              case 'bow': label = 'BOW'; break;
          }
          ctx.fillText(label, bx + boxSize/2, y + boxSize/2);
      });
      
      // Reset text align
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
  };

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain bg-black shadow-2xl rounded-lg" />
      {mode === 'story' && (
        <button 
          onClick={() => {
            if (engineRef.current) {
              engineRef.current.saveStoryProgress();
              alert("Game Saved!");
            }
          }}
          className="absolute top-4 right-4 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-black rounded-xl border border-zinc-700 backdrop-blur-sm transition-all"
        >
          SAVE GAME
        </button>
      )}

      {engineRef.current?.isUpgradeSelection && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50">
          <h2 className="text-4xl font-black mb-8 text-orange-500 italic">WAVE 10 COMPLETE! CHOOSE UPGRADE</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => engineRef.current?.applyUpgrade('damage')}
              className="p-6 bg-zinc-900 border-2 border-orange-500 rounded-2xl hover:bg-orange-500 hover:text-black transition-all group"
            >
              <div className="text-2xl font-black mb-2">ATTACK POWER</div>
              <div className="text-sm opacity-60 group-hover:opacity-100">+20% Damage</div>
            </button>
            <button 
              onClick={() => engineRef.current?.applyUpgrade('speed')}
              className="p-6 bg-zinc-900 border-2 border-blue-500 rounded-2xl hover:bg-blue-500 hover:text-black transition-all group"
            >
              <div className="text-2xl font-black mb-2">AGILITY</div>
              <div className="text-sm opacity-60 group-hover:opacity-100">+10% Movement Speed</div>
            </button>
            <button 
              onClick={() => engineRef.current?.applyUpgrade('health')}
              className="p-6 bg-zinc-900 border-2 border-green-500 rounded-2xl hover:bg-green-500 hover:text-black transition-all group"
            >
              <div className="text-2xl font-black mb-2">VITALITY</div>
              <div className="text-sm opacity-60 group-hover:opacity-100">+20 Max Health & Full Heal</div>
            </button>
            <button 
              onClick={() => engineRef.current?.applyUpgrade('shield')}
              className="p-6 bg-zinc-900 border-2 border-zinc-500 rounded-2xl hover:bg-zinc-100 hover:text-black transition-all group"
            >
              <div className="text-2xl font-black mb-2">DEFENSE</div>
              <div className="text-sm opacity-60 group-hover:opacity-100">+20 Max Shield & Full Recharge</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
