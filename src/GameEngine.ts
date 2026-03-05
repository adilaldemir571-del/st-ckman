import { Player, PlayerState, WeaponType, Projectile, GameMap, Platform, Vector2, GRAVITY, FRICTION, MOVE_SPEED, JUMP_FORCE, Particle, HealthBox, BuffBox, BuffType, VisualEffect, GameMode } from './types';
import { InputManager } from './InputManager';

import { MAPS } from './maps';

export class GameEngine {
  players: Player[] = [];
  map: GameMap;
  input: InputManager;
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  healthBoxes: HealthBox[] = [];
  buffBoxes: BuffBox[] = [];
  gameEnded: boolean = false;
  winner: string | number | null = null;
  roundState: 'start' | 'fight' | 'end' = 'start';
  roundTimer: number = 0;
  visualEffects: VisualEffect[] = [];
  
  mode: GameMode = 'local';
  wave: number = 1;
  totalTime: number = 0; // In frames or ms, let's use frames and convert
  isUpgradeSelection: boolean = false;
  storyLevel: number = 1;
  storyObjective: string = '';
  isEnding: boolean = false;
  onLevelComplete?: (level: number) => void;
  
  isOnline: boolean = false;
  roomId?: string;
  localPlayerId?: string | number;

  constructor(map: GameMap, input: InputManager, options?: { mode?: GameMode, isOnline?: boolean, roomId?: string, players?: Player[], localPlayerId?: string | number }) {
    this.map = map;
    this.input = input;
    this.mode = options?.mode || 'local';
    this.isOnline = options?.isOnline || false;
    this.roomId = options?.roomId;
    this.localPlayerId = options?.localPlayerId;

    if (this.isOnline && options?.players) {
      this.players = options.players.map(p => ({
        ...this.createPlayer(p.id, { x: 0, y: 0 }, p.color),
        name: p.name,
        position: this.getSpawnPosition(p.id, options.players!.length)
      }));
    } else if (this.mode === 'wave') {
        this.players = [this.createPlayer(1, map.spawnP1, '#3b82f6')];
        this.localPlayerId = 1;
        this.startWave(1);
    } else if (this.mode === 'story') {
        this.players = [this.createPlayer(1, map.spawnP1, '#3b82f6')];
        this.localPlayerId = 1;
        this.startStoryLevel(1);
    } else {
      this.players = [
        this.createPlayer(1, map.spawnP1, '#3b82f6'), // Blue
        this.createPlayer(2, map.spawnP2, '#ef4444'), // Red
      ];
      this.localPlayerId = 1; // Default for local play
    }
    
    this.resetRound();
  }

  private getSpawnPosition(id: string | number, totalPlayers: number): Vector2 {
    // Simple spawn logic for up to 4 players
    const spawns = [
      this.map.spawnP1,
      this.map.spawnP2,
      { x: 400, y: 100 },
      { x: 400, y: 500 }
    ];
    
    // If it's a numeric ID 1-4
    if (typeof id === 'number' && id >= 1 && id <= 4) return spawns[id-1];
    
    // Otherwise index based on player list
    const index = this.players.findIndex(p => p.id === id);
    return spawns[index % spawns.length] || this.map.spawnP1;
  }

  private createPlayer(id: string | number, position: Vector2, color: string, isAI: boolean = false): Player {
    return {
      id,
      position: { ...position },
      velocity: { x: 0, y: 0 },
      width: 30,
      height: 70,
      color,
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
      maxWeaponSwitchCooldown: 180, // 3 seconds
      hitStun: 0,
      projectiles: [],
      score: 0,
      wins: 0,
      shield: 100,
      maxShield: 100,
      lastHitTimer: 0,
      isAI,
      buffs: {
        damage: 1,
        speed: 1,
        timer: 0
      }
    };
  }

  update() {
    if (this.gameEnded) return;

    this.roundTimer++;

    // Round Start Logic
    if (this.roundState === 'start') {
        if (this.roundTimer > 60) {
            this.roundState = 'fight';
        }
        return;
    }

    this.players.forEach(p => {
      if (p.buffs.timer > 0) {
        p.buffs.timer--;
        if (p.buffs.timer === 0) {
          p.buffs.damage = 1;
          p.buffs.speed = 1;
        }
      }
      
      if (p.isAI && p.state !== 'dead') {
          this.updateAI(p);
      }
    });

    if (this.mode === 'wave') this.updateWaveMode();
    if (this.mode === 'story') this.updateStoryMode();

    if (this.isOnline) {
      const localPlayer = this.players.find(p => p.id === this.localPlayerId);
      if (localPlayer) {
        this.updatePlayer(localPlayer, {
          left: 'a',
          right: 'd',
          jump: 'w',
          block: 's',
          sword: 'f',
          spear: 'g',
          bow: 'h',
          change: 'r',
        });
        
        // Emit state to server
        import('./socket').then(({ socket }) => {
          socket.emit('player-update', {
            roomId: this.roomId,
            playerState: {
              position: localPlayer.position,
              velocity: localPlayer.velocity,
              state: localPlayer.state,
              facing: localPlayer.facing,
              health: localPlayer.health,
              currentWeapon: localPlayer.currentWeapon,
              attackCooldown: localPlayer.attackCooldown,
              maxAttackCooldown: localPlayer.maxAttackCooldown,
              buffs: localPlayer.buffs
            }
          });
        });
      }
      
      // Update remote players (interpolation would be better, but simple sync for now)
      // Remote updates are handled via socket listeners in GameCanvas
    } else {
      this.updatePlayer(this.players[0], {
        left: 'a',
        right: 'd',
        jump: 'w',
        block: 's',
        sword: 'f',
        spear: 'g',
        bow: 'h',
        change: 'r',
      });

      if (this.players[1]) {
        this.updatePlayer(this.players[1], {
          left: 'arrowleft',
          right: 'arrowright',
          jump: 'arrowup',
          block: 'arrowdown',
          sword: '1',
          spear: '2',
          bow: '3',
          change: 'o',
        });
      }
    }

    this.updateProjectiles();
    this.updateParticles();
    this.updateHealthBoxes();
    this.updateBuffBoxes();
    this.updateVisualEffects();
    this.checkCollisions();
    
    if (!this.gameEnded && !this.isUpgradeSelection) {
        this.totalTime++;
    }
    
    // Random Drops
    if (this.roundState === 'fight') {
      if (Math.random() < 0.001 && this.healthBoxes.length < 2) {
          this.spawnHealthBox();
      }
      if (Math.random() < 0.0005 && this.buffBoxes.length < 1) {
          this.spawnBuffBox();
      }
    }
  }

  private updatePlayer(player: Player, controls: any) {
    if (player.hitStun > 0) {
      player.hitStun--;
      player.state = 'hit';
      this.applyPhysics(player);
      return;
    }

    if (player.attackCooldown > 0) {
        player.attackCooldown--;
    } else if (player.state === 'attack') {
        player.state = 'idle';
    }
    if (player.blockCooldown > 0) player.blockCooldown--;
    if (player.weaponSwitchCooldown > 0) player.weaponSwitchCooldown--;
    if (player.lastHitTimer > 0) player.lastHitTimer--;

    // Shield regeneration
    if (player.lastHitTimer === 0 && player.shield < player.maxShield) {
        player.shield = Math.min(player.maxShield, player.shield + 0.2);
    }

    const currentMoveSpeed = MOVE_SPEED * player.buffs.speed;

    if (this.input.isKeyPressed(controls.left)) {
      player.velocity.x = -currentMoveSpeed;
      player.facing = -1;
      if (player.state !== 'jump' && player.state !== 'attack' && player.state !== 'block' && player.state !== 'fall') player.state = 'run';
      if (player.isGrounded && Math.random() > 0.8) {
          this.createParticle(player.position.x + player.width/2, player.position.y + player.height, '#555', 2);
      }
    } else if (this.input.isKeyPressed(controls.right)) {
      player.velocity.x = currentMoveSpeed;
      player.facing = 1;
      if (player.state !== 'jump' && player.state !== 'attack' && player.state !== 'block' && player.state !== 'fall') player.state = 'run';
      if (player.isGrounded && Math.random() > 0.8) {
          this.createParticle(player.position.x + player.width/2, player.position.y + player.height, '#555', 2);
      }
    } else {
      player.velocity.x *= FRICTION;
      if (Math.abs(player.velocity.x) < 0.1) player.velocity.x = 0;
      if (player.isGrounded && player.state !== 'attack' && player.state !== 'block') player.state = 'idle';
      else if (!player.isGrounded && player.state !== 'attack' && player.state !== 'jump') player.state = 'fall';
    }

    if (this.input.isKeyPressed(controls.jump) && player.isGrounded) {
      player.velocity.y = JUMP_FORCE;
      player.isGrounded = false;
      player.state = 'jump';
      for(let i=0; i<5; i++) {
          this.createParticle(player.position.x + player.width/2, player.position.y + player.height, '#888', 3);
      }
    }

    if (this.input.isKeyPressed(controls.block) && player.isGrounded) {
      player.state = 'block';
      player.velocity.x = 0;
    } else if (player.state === 'block') {
      player.state = 'idle';
    }

    if (this.input.isKeyPressed(controls.change) && player.attackCooldown === 0 && player.weaponSwitchCooldown === 0) {
        if (player.currentWeapon === 'sword') player.currentWeapon = 'spear';
        else if (player.currentWeapon === 'spear') player.currentWeapon = 'bow';
        else player.currentWeapon = 'sword';
        
        player.weaponSwitchCooldown = player.maxWeaponSwitchCooldown;
        for(let i=0; i<8; i++) {
            this.createParticle(player.position.x + player.width/2, player.position.y + player.height/2, 'white', 2);
        }
    }

    if (player.attackCooldown === 0 && player.state !== 'block' && player.state !== 'hit') {
      if (this.input.isKeyPressed(controls.sword)) {
        this.performAttack(player, 'sword');
      } else if (this.input.isKeyPressed(controls.spear)) {
        this.performAttack(player, 'spear');
      } else if (this.input.isKeyPressed(controls.bow)) {
        this.performAttack(player, 'bow');
      }
    }

    this.applyPhysics(player);
  }

  private performAttack(player: Player, weapon: WeaponType) {
    player.state = 'attack';
    player.currentWeapon = weapon;
    
    if (weapon === 'sword') {
      player.attackCooldown = 40;
      player.maxAttackCooldown = 40;
      player.velocity.x = player.facing * 6; // Step forward
      this.visualEffects.push({
        type: 'slash',
        x: player.position.x + (player.facing === 1 ? player.width : 0),
        y: player.position.y + 20,
        radius: 50,
        startAngle: player.facing === 1 ? -Math.PI/2 : Math.PI/2,
        endAngle: player.facing === 1 ? Math.PI/2 : 3*Math.PI/2,
        life: 15,
        maxLife: 15
      });
    } else if (weapon === 'spear') {
      player.attackCooldown = 45;
      player.maxAttackCooldown = 45;
      player.velocity.x = player.facing * 15; // Lunge forward
    } else if (weapon === 'bow') {
      player.attackCooldown = 60;
      player.maxAttackCooldown = 60;
      this.fireProjectile(player, 'arrow');
      player.velocity.x = -player.facing * 4; // Recoil backward
    } else if (weapon === 'axe') {
      player.attackCooldown = 55;
      player.maxAttackCooldown = 55;
      player.velocity.x = player.facing * 4; // Small step
      this.visualEffects.push({
        type: 'slash',
        x: player.position.x + (player.facing === 1 ? player.width : 0),
        y: player.position.y + 10,
        radius: 60,
        startAngle: player.facing === 1 ? -Math.PI/2 : Math.PI/2,
        endAngle: player.facing === 1 ? Math.PI/2 : 3*Math.PI/2,
        life: 20,
        maxLife: 20
      });
    }
  }

  private fireProjectile(player: Player, type: 'arrow') {
    const projectile: Projectile = {
      id: Math.random().toString(36).substr(2, 9),
      position: { 
        x: player.position.x + (player.facing === 1 ? player.width : 0), 
        y: player.position.y + player.height / 3 
      },
      velocity: { 
          x: player.facing * 15, 
          y: -0.5 
      }, 
      width: 30,
      height: 4,
      damage: 12 * player.buffs.damage,
      ownerId: player.id,
      active: true,
    };
    if (this.isOnline && player.id === this.localPlayerId) {
      import('./socket').then(({ socket }) => {
        socket.emit('projectile-fired', {
          roomId: this.roomId,
          projectile
        });
      });
    }
    this.projectiles.push(projectile);
  }

  private spawnHealthBox() {
      const platform = this.map.platforms[Math.floor(Math.random() * this.map.platforms.length)];
      if (platform.type === 'hazard') return;
      this.healthBoxes.push({
          id: Math.random().toString(),
          x: platform.x + Math.random() * (platform.width - 30),
          y: platform.y - 40,
          width: 30,
          height: 30,
          active: true
      });
  }

  private spawnBuffBox() {
    const platform = this.map.platforms[Math.floor(Math.random() * this.map.platforms.length)];
    if (platform.type === 'hazard') return;
    const type: BuffType = Math.random() > 0.5 ? 'damage' : 'speed';
    this.buffBoxes.push({
        id: Math.random().toString(),
        x: platform.x + Math.random() * (platform.width - 30),
        y: platform.y - 40,
        width: 30,
        height: 30,
        type,
        active: true
    });
  }

  private updateHealthBoxes() {
      this.players.forEach(player => {
          for (let i = this.healthBoxes.length - 1; i >= 0; i--) {
              const box = this.healthBoxes[i];
              if (this.checkRectCollision({ ...player.position, width: player.width, height: player.height }, box)) {
                  player.health = Math.min(player.maxHealth, player.health + 35);
                  this.healthBoxes.splice(i, 1);
                  for(let j=0; j<10; j++) {
                      this.createParticle(box.x + box.width/2, box.y + box.height/2, '#22c55e', 3);
                  }
              }
          }
      });
  }

  private updateBuffBoxes() {
    this.players.forEach(player => {
        for (let i = this.buffBoxes.length - 1; i >= 0; i--) {
            const box = this.buffBoxes[i];
            if (this.checkRectCollision({ ...player.position, width: player.width, height: player.height }, box)) {
                if (box.type === 'damage') player.buffs.damage = 1.5;
                else player.buffs.speed = 1.4;
                player.buffs.timer = 300; // 5 seconds
                this.buffBoxes.splice(i, 1);
                const color = box.type === 'damage' ? '#ef4444' : '#3b82f6';
                for(let j=0; j<15; j++) {
                    this.createParticle(box.x + box.width/2, box.y + box.height/2, color, 4);
                }
            }
        }
    });
  }

  private updateVisualEffects() {
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      this.visualEffects[i].life--;
      if (this.visualEffects[i].life <= 0) this.visualEffects.splice(i, 1);
    }
  }

  private createParticle(x: number, y: number, color: string, size: number) {
      this.particles.push({
          id: Math.random().toString(),
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 30 + Math.random() * 20,
          maxLife: 50,
          color,
          size
      });
  }

  private updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          p.size *= 0.95; // Shrink
          
          if (p.life <= 0 || p.size < 0.1) {
              this.particles.splice(i, 1);
          }
      }
  }

  private applyPhysics(player: Player) {
    player.velocity.y += GRAVITY;
    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;

    if (player.position.x < 0) player.position.x = 0;
    if (player.position.x + player.width > 800) player.position.x = 800 - player.width;

    player.isGrounded = false;
    for (const platform of this.map.platforms) {
      const playerRect = { x: player.position.x, y: player.position.y, width: player.width, height: player.height };
      if (this.checkRectCollision(playerRect, platform)) {
        if (platform.type === 'hazard') {
             if (player.hitStun === 0) {
                 this.damagePlayer(player, 1);
                 if (Math.random() > 0.5) {
                    this.createParticle(player.position.x + player.width/2, player.position.y + player.height, '#ff4500', 3);
                 }
             }
             continue;
        }

        const dx = (player.position.x + player.width / 2) - (platform.x + platform.width / 2);
        const dy = (player.position.y + player.height / 2) - (platform.y + platform.height / 2);
        const width = (player.width + platform.width) / 2;
        const height = (player.height + platform.height) / 2;
        const crossWidth = width * dy;
        const crossHeight = height * dx;

        if (Math.abs(dx) <= width && Math.abs(dy) <= height) {
            if (crossWidth > crossHeight) {
                if (crossWidth > -crossHeight) {
                    player.position.y = platform.y + platform.height;
                    player.velocity.y = 0;
                } else {
                    player.position.x = platform.x - player.width;
                    player.velocity.x = 0;
                }
            } else {
                if (crossWidth > -crossHeight) {
                    player.position.x = platform.x + platform.width;
                    player.velocity.x = 0;
                } else {
                    player.position.y = platform.y - player.height;
                    player.velocity.y = 0;
                    player.isGrounded = true;
                    if (player.state === 'jump' || player.state === 'fall') player.state = 'idle';
                }
            }
        }
      }
    }
    
    // Out of bounds or Glitch check
    if (player.position.y > 600 || player.position.y < -200) {
        this.respawnSafely(player);
    }
  }

  private respawnSafely(player: Player) {
    // Find a solid platform to land on
    const safePlatform = this.map.platforms.find(p => p.type !== 'hazard') || this.map.platforms[0];
    player.position.x = safePlatform.x + safePlatform.width / 2 - player.width / 2;
    player.position.y = safePlatform.y - player.height - 50;
    player.velocity.x = 0;
    player.velocity.y = 0;
    this.damagePlayer(player, 10); // Penalty for falling
    for(let i=0; i<10; i++) {
        this.createParticle(player.position.x + player.width/2, player.position.y + player.height/2, player.color, 3);
    }
  }

  private updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.position.x += p.velocity.x;
      p.position.y += p.velocity.y;
      
      // Only apply gravity to arrows (width 30 is arrow, 10 is bullet hack)
      if (p.width > 15) {
          p.velocity.y += 0.05; 
      }

      // Remove if out of bounds
      if (p.position.x < 0 || p.position.x > 800 || p.position.y > 600) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with all other players
      const projRect = { x: p.position.x, y: p.position.y, width: p.width, height: p.height };

      // Check collision with platforms
      let hitPlatform = false;
      for (const platform of this.map.platforms) {
          if (this.checkRectCollision(projRect, platform)) {
              this.projectiles.splice(i, 1);
              hitPlatform = true;
              // Impact particles
              for(let k=0; k<3; k++) {
                  this.createParticle(p.position.x, p.position.y, '#888', 1.5);
              }
              break;
          }
      }
      if (hitPlatform) continue;

      for (const target of this.players) {
        if (target.id === p.ownerId || target.state === 'dead') continue;
        
        const targetRect = { x: target.position.x, y: target.position.y, width: target.width, height: target.height };
        
        if (this.checkRectCollision(projRect, targetRect)) {
          this.damagePlayer(target, p.damage, 4, p.ownerId);
          this.projectiles.splice(i, 1);
          
          // Hit particles
          for(let k=0; k<5; k++) {
              this.createParticle(p.position.x, p.position.y, 'white', 2);
          }
          break; // Projectile destroyed
        }
      }
    }
  }

  private checkCollisions() {
    // Melee attacks for all players
    for (let i = 0; i < this.players.length; i++) {
      for (let j = 0; j < this.players.length; j++) {
        if (i === j) continue;
        this.checkMeleeAttack(this.players[i], this.players[j]);
      }
    }
  }

  private checkMeleeAttack(attacker: Player, defender: Player) {
    if (attacker.state === 'attack' && attacker.attackCooldown > 10) {
       let damage = 0;
       let width = 0;
       let knockback = 4;
       
       if (attacker.currentWeapon === 'sword') {
           damage = 18 * attacker.buffs.damage;
           width = 65;
           knockback = 5;
       } else if (attacker.currentWeapon === 'spear') {
           damage = 14 * attacker.buffs.damage;
           width = 110;
           knockback = 8; // Higher knockback for spear
       } else if (attacker.currentWeapon === 'axe') {
           damage = 25 * attacker.buffs.damage;
           width = 75;
           knockback = 12; // Very high knockback for axe
       } else {
           return;
       }

       const attackBox = {
           x: attacker.facing === 1 ? attacker.position.x + attacker.width : attacker.position.x - width,
           y: attacker.position.y + 10,
           width: width,
           height: 50
       };

       const defenderRect = { x: defender.position.x, y: defender.position.y, width: defender.width, height: defender.height };

       if (this.checkRectCollision(attackBox, defenderRect)) {
           const triggerFrame = attacker.currentWeapon === 'sword' ? 20 : 40;
           if (attacker.attackCooldown === triggerFrame) {
               this.damagePlayer(defender, damage, knockback);
               for(let k=0; k<8; k++) {
                   this.createParticle(defender.position.x + defender.width/2, defender.position.y + defender.height/2, 'red', 3);
               }
           }
       }
    }
  }

  public damagePlayer(player: Player, amount: number, knockback: number = 4, attackerId?: string | number) {
    player.lastHitTimer = 180; // Reset regen timer (3 seconds)

    if (player.state === 'block') {
        amount = Math.floor(amount * 0.15); // 85% reduction
        for(let k=0; k<5; k++) {
            this.createParticle(player.position.x + player.width/2, player.position.y + player.height/2, 'gold', 2);
        }
    } else if (player.shield > 0) {
        const shieldDamage = Math.min(player.shield, amount);
        player.shield -= shieldDamage;
        amount -= shieldDamage;
        for(let k=0; k<5; k++) {
            this.createParticle(player.position.x + player.width/2, player.position.y + player.height/2, '#000000', 2);
        }
    }
    
    // In online mode, only the victim or the attacker should report the hit to avoid duplicates
    // Let's have the victim report it if it's local
    if (this.isOnline && player.id === this.localPlayerId) {
      import('./socket').then(({ socket }) => {
        socket.emit('player-hit', {
          roomId: this.roomId,
          targetId: player.id,
          damage: amount,
          attackerId: attackerId
        });
      });
    }

    player.health -= amount;
    player.hitStun = 18;
    player.velocity.y = -5;
    player.velocity.x = player.facing * -knockback; 
    
    if (player.health <= 0) {
      player.health = 0;
      player.state = 'dead';
      
      // Immediately remove AI players
      if (player.isAI) {
          setTimeout(() => {
              this.players = this.players.filter(p => p.id !== player.id);
          }, 0);
      }

      if (this.mode === 'wave' || this.mode === 'story') {
          if (!player.isAI) {
              this.gameEnded = true;
              this.winner = 'Enemies';
          }
          return;
      }

      if (!this.isOnline) {
        const winnerId = player.id === 1 ? 2 : 1;
        const winner = this.players.find(p => p.id === winnerId);
        if (winner) {
            winner.wins += 1;
            if (winner.wins >= 10) {
                this.gameEnded = true;
                this.winner = winnerId;
            } else {
                this.resetRound();
            }
        }
      } else {
          // In online mode, the server handles win conditions usually, 
          // but we can track locally for UI
          const winnerId = attackerId;
          const winner = this.players.find(p => p.id === winnerId);
          if (winner) {
              winner.wins += 1;
              if (winner.wins >= 10) {
                  this.gameEnded = true;
                  this.winner = winnerId;
              }
          }
      }
    }
  }

  private resetRound() {
      if (this.mode === 'wave' || this.mode === 'story') return;
      
      const mapKeys = Object.keys(MAPS);
      const randomMapKey = mapKeys[Math.floor(Math.random() * mapKeys.length)];
      this.map = MAPS[randomMapKey];

      this.players.forEach((p, i) => {
        const spawnPos = i === 0 ? this.map.spawnP1 : this.map.spawnP2;
        p.position = { ...spawnPos };
        p.health = 100;
        p.state = 'idle';
        p.velocity = { x: 0, y: 0 };
        p.projectiles = [];
        p.hitStun = 0;
        p.attackCooldown = 0;
        p.maxAttackCooldown = 0;
        p.weaponSwitchCooldown = 0;
        p.facing = i === 0 ? 1 : -1;
        p.buffs = { damage: 1, speed: 1, timer: 0 };
      });

      this.projectiles = [];
      this.particles = [];
      this.healthBoxes = [];
      this.buffBoxes = [];
      this.visualEffects = [];
      this.roundState = 'start';
      this.roundTimer = 0;
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    const isBossWave = waveNum % 10 === 0;
    const enemyCount = isBossWave ? 1 : 2 + Math.floor(waveNum / 2);
    
    for (let i = 0; i < enemyCount; i++) {
        this.spawnEnemy(isBossWave ? 'boss' : 'minion', 100 + Math.random() * 600, 50);
    }
  }

  private updateWaveMode() {
    const enemies = this.players.filter(p => p.isAI);
    if (enemies.length === 0 && !this.gameEnded && !this.isUpgradeSelection) {
        const nextWave = this.wave + 1;
        if (nextWave % 10 === 1 && nextWave > 1) {
            this.isUpgradeSelection = true;
        } else {
            this.startWave(nextWave);
        }
    }
  }

  public applyUpgrade(type: 'damage' | 'speed' | 'health' | 'shield') {
      const player = this.players.find(p => p.id === this.localPlayerId);
      if (player) {
          if (type === 'damage') player.buffs.damage += 0.2;
          else if (type === 'speed') player.buffs.speed += 0.1;
          else if (type === 'health') {
              player.maxHealth += 20;
              player.health = player.maxHealth;
          } else if (type === 'shield') {
              player.maxShield += 20;
              player.shield = player.maxShield;
          }
      }
      this.isUpgradeSelection = false;
      this.startWave(this.wave + 1);
  }

  private startStoryLevel(levelNum: number) {
    this.storyLevel = levelNum;
    this.players = this.players.filter(p => !p.isAI);
    const localPlayer = this.players.find(p => p.id === this.localPlayerId);
    if (localPlayer) {
        localPlayer.health = 100;
        localPlayer.shield = 100;
        localPlayer.position = { ...this.map.spawnP1 };
        localPlayer.state = 'idle';
    }

    if (levelNum === 10) {
        this.storyObjective = "Rescue the Prince & Defeat the Overlord";
        this.spawnEnemy('boss', 600, 100);
        // Add some minions for the final battle
        this.spawnEnemy('minion', 200, 100);
        this.spawnEnemy('minion', 400, 100);
    } else {
        this.storyObjective = `Chapter ${levelNum}: Defeat all enemies`;
        // Progressive difficulty
        const enemyCount = 2 + Math.floor(levelNum / 2);
        for (let i = 0; i < enemyCount; i++) {
            this.spawnEnemy('minion', 100 + Math.random() * 600, 50);
        }
        if (levelNum % 3 === 0) {
            this.spawnEnemy('boss', 500, 50);
        }
    }
    
    this.saveStoryProgress();
    if (this.onLevelComplete) this.onLevelComplete(levelNum);
  }

  public restartStoryLevel() {
      if (this.mode !== 'story') return;
      this.startStoryLevel(this.storyLevel);
      this.gameEnded = false;
      this.winner = null;
      this.isEnding = false;
  }

  public saveStoryProgress() {
      if (this.mode !== 'story') return;
      localStorage.setItem('stick_arena_story_progress', this.storyLevel.toString());
  }

  public loadStoryProgress(): number {
      const saved = localStorage.getItem('stick_arena_story_progress');
      return saved ? parseInt(saved) : 1;
  }

  private updateStoryMode() {
    const enemies = this.players.filter(p => p.isAI && p.state !== 'dead');
    const localPlayer = this.players.find(p => p.id === this.localPlayerId);

    if (localPlayer && localPlayer.state === 'dead') {
        // Player died in story mode
        this.gameEnded = true;
        this.winner = 'Enemies';
        return;
    }

    if (enemies.length === 0 && !this.gameEnded) {
        if (this.storyLevel >= 10) {
            this.gameEnded = true;
            this.winner = this.localPlayerId || 1;
            this.isEnding = true;
        } else {
            this.startStoryLevel(this.storyLevel + 1);
        }
    }
  }

  private spawnEnemy(type: 'minion' | 'boss', x: number, y: number) {
    const id = `enemy-${Math.random()}`;
    const color = type === 'boss' ? '#9333ea' : '#ef4444';
    const enemy = this.createPlayer(id, { x, y }, color, true);
    enemy.aiType = type;
    
    // Assign random weapon to AI
    const weapons: WeaponType[] = ['sword', 'spear', 'bow', 'axe'];
    enemy.currentWeapon = weapons[Math.floor(Math.random() * weapons.length)];

    if (type === 'boss') {
        enemy.maxHealth = 500;
        enemy.health = 500;
        enemy.width = 60;
        enemy.height = 120;
    }
    this.players.push(enemy);
  }

  private updateAI(ai: Player) {
    const target = this.players.find(p => !p.isAI && p.state !== 'dead');
    if (!target) return;

    const dx = target.position.x - ai.position.x;
    const dy = target.position.y - ai.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const attackDist = ai.currentWeapon === 'bow' ? 400 : 
                      ai.currentWeapon === 'spear' ? 100 : 
                      ai.currentWeapon === 'axe' ? 80 : 70;

    const stopDist = ai.currentWeapon === 'bow' ? 300 : 60;

    // Simple AI behavior
    if (dist > stopDist) {
        ai.velocity.x = Math.sign(dx) * (ai.aiType === 'boss' ? 2 : 3);
        ai.facing = Math.sign(dx) as 1 | -1;
        if (ai.isGrounded) ai.state = 'run';
    } else if (ai.currentWeapon === 'bow' && dist < 200) {
        // Bow AI tries to keep distance
        ai.velocity.x = -Math.sign(dx) * 2;
        ai.facing = Math.sign(dx) as 1 | -1;
        if (ai.isGrounded) ai.state = 'run';
    } else {
        ai.velocity.x *= FRICTION;
        ai.facing = Math.sign(dx) as 1 | -1;
    }

    if (dist < attackDist && ai.attackCooldown === 0) {
        this.performAttack(ai, ai.currentWeapon);
    }

    if (dy < -50 && ai.isGrounded && Math.random() > 0.95) {
        ai.velocity.y = JUMP_FORCE;
        ai.isGrounded = false;
        ai.state = 'jump';
    }

    this.applyPhysics(ai);
  }

  private checkRectCollision(rect1: {x: number, y: number, width: number, height: number}, rect2: {x: number, y: number, width: number, height: number}) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }
}
