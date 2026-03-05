import React, { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import { MAPS } from './maps';
import { MapType, Room, GameMode } from './types';
import { Swords, Shield, Skull, Trophy, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socket, connectSocket, disconnectSocket } from './socket';
import { OnlineLobby } from './components/OnlineLobby';
import { OnlineRoom } from './components/OnlineRoom';
import { Leaderboard } from './components/Leaderboard';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'controls' | 'lobby' | 'room' | 'username' | 'leaderboard'>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [username, setUsername] = useState('');
  const [selectedMap, setSelectedMap] = useState<MapType>('forest');
  const [playedMaps, setPlayedMaps] = useState<MapType[]>([]);
  const [winner, setWinner] = useState<number | string | null>(null);
  const [finalScores, setFinalScores] = useState<{p1: number, p2: number}>({p1: 0, p2: 0});
  const [waveRecord, setWaveRecord] = useState<{waves: number, time: number}>({waves: 0, time: 0});
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [storyProgress, setStoryProgress] = useState<number>(1);

  useEffect(() => {
    const saved = localStorage.getItem('stick_arena_story_progress');
    if (saved) setStoryProgress(parseInt(saved));
    socket.on('room-update', (room: Room) => {
      setCurrentRoom(room);
      setGameState('room');
    });

    socket.on('start-game', ({ mapId }: { mapId: MapType }) => {
      setSelectedMap(mapId);
      setGameState('playing');
    });

    socket.on('error', (msg: string) => {
      alert(msg);
    });

    return () => {
      socket.off('room-update');
      socket.off('start-game');
      socket.off('error');
    };
  }, []);

  const startGame = (mode: GameMode = 'local', startLevel?: number) => {
    setGameMode(mode);
    setIsOnline(false);
    
    if (mode === 'wave' && !username) {
      setGameState('username');
      return;
    }
    
    if (mode === 'story') {
        setSelectedMap('castle');
        if (startLevel) {
            setStoryProgress(startLevel);
        } else {
            setStoryProgress(1);
            localStorage.setItem('stick_arena_story_progress', '1');
        }
    } else {
        const mapKeys = Object.keys(MAPS) as MapType[];
        
        // Filter out maps that have already been played in the current cycle
        let availableMaps = mapKeys.filter(m => !playedMaps.includes(m));
        
        // If all maps have been played, reset the cycle
        if (availableMaps.length === 0) {
          // When resetting, avoid the very last map played to ensure a change
          const lastMap = playedMaps[playedMaps.length - 1];
          availableMaps = mapKeys.filter(m => m !== lastMap);
          
          // Fallback if there's only one map total (shouldn't happen with current maps)
          if (availableMaps.length === 0) availableMaps = mapKeys;
          
          const nextMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
          setSelectedMap(nextMap);
          setPlayedMaps([nextMap]);
        } else {
          const nextMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
          setSelectedMap(nextMap);
          setPlayedMaps(prev => [...prev, nextMap]);
        }
    }
    
    setGameState('playing');
  };

  const startOnline = () => {
    setGameMode('online');
    if (!username) {
      setGameState('username');
      return;
    }
    connectSocket();
    setIsOnline(true);
    setGameState('lobby');
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      if (gameMode === 'wave') {
        startGame('wave');
      } else {
        startOnline();
      }
    }
  };

  const joinRoom = (roomId: string, playerName: string) => {
    socket.emit('join-room', { roomId, playerName });
  };

  const leaveRoom = () => {
    disconnectSocket();
    setCurrentRoom(null);
    setGameState('menu');
  };

  const handleGameOver = (winnerId: number | string, score1: number, score2: number, wave?: number, time?: number) => {
    setWinner(winnerId);
    setFinalScores({p1: score1, p2: score2});
    if (wave !== undefined && time !== undefined) {
        setWaveRecord({ waves: wave, time: time });
        
        // Save score to leaderboard
        const nameToSave = username || 'Anonymous';
        fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: nameToSave, waves: wave, time })
        }).catch(err => console.error('Failed to save score', err));
    }
    setGameState('gameover');
  };

  const resetGame = () => {
    if (isOnline) {
        leaveRoom();
    } else {
        setGameState('menu');
        setWinner(null);
        setFinalScores({p1: 0, p2: 0});
        setPlayedMaps([]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-white selection:bg-orange-500/30">
      <Analytics />
      <div className="w-full max-w-5xl aspect-[4/3] bg-black rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] relative border border-zinc-800/50">
        
        <AnimatePresence mode="wait">
          {gameState === 'menu' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 overflow-hidden z-10"
            >
              {/* Animated Background */}
              <div className="absolute inset-0 z-0 opacity-30">
                  <motion.div 
                    animate={{ 
                        backgroundPosition: ['0% 0%', '100% 100%'],
                    }}
                    transition={{ 
                        duration: 30, 
                        repeat: Infinity, 
                        ease: "linear" 
                    }}
                    className="w-full h-full"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/0 via-zinc-900/40 to-zinc-900"></div>
              </div>

              <div className="z-10 flex flex-col items-center w-full px-12">
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h1 className="text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 drop-shadow-2xl">
                      STICK ARENA
                    </h1>
                    <div className="h-1 w-full bg-gradient-to-r from-transparent via-orange-500 to-transparent mb-8"></div>
                  </motion.div>
                  
                  <motion.div 
                    className="flex flex-col gap-4 w-full max-w-xs"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <button
                      onClick={() => startGame('story')}
                      className="group relative px-12 py-5 bg-indigo-600 text-white font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(79,70,229,0.2)] overflow-hidden border border-indigo-400/50"
                    >
                      <Shield className="w-6 h-6" />
                      NEW STORY
                    </button>

                    {storyProgress > 1 && (
                      <button
                        onClick={() => startGame('story', storyProgress)}
                        className="group relative px-12 py-4 bg-indigo-900/50 text-indigo-200 font-bold text-lg rounded-2xl hover:bg-indigo-800/50 transition-all flex items-center justify-center gap-3 border border-indigo-700/50"
                      >
                        CONTINUE (CH. {storyProgress})
                      </button>
                    )}

                    <button
                      onClick={() => startGame('wave')}
                      className="group relative px-12 py-5 bg-red-600 text-white font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.2)] overflow-hidden border border-red-400/50"
                    >
                      <Skull className="w-6 h-6" />
                      WAVE MODE
                    </button>

                    <button
                      onClick={() => startGame('local')}
                      className="group relative px-12 py-5 bg-white text-black font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden"
                    >
                      <Swords className="w-6 h-6" />
                      LOCAL PLAY
                    </button>

                    <button
                      onClick={startOnline}
                      className="group relative px-12 py-5 bg-orange-500 text-white font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.2)] overflow-hidden border border-orange-400/50"
                    >
                      <Globe className="w-6 h-6" />
                      ONLINE PLAY
                    </button>
                    
                    <button
                      onClick={() => setGameState('controls')}
                      className="px-12 py-4 bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 text-white font-bold text-lg rounded-2xl hover:bg-zinc-700/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Shield className="w-5 h-5" />
                      CONTROLS
                    </button>

                    <button
                      onClick={() => setGameState('leaderboard')}
                      className="px-12 py-4 bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 text-yellow-500 font-bold text-lg rounded-2xl hover:bg-zinc-700/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Trophy className="w-5 h-5" />
                      LEADERBOARD
                    </button>
                  </motion.div>

                  <p className="mt-12 text-zinc-500 text-sm font-medium tracking-widest uppercase">First to 3 Rounds Wins</p>
              </div>
            </motion.div>
          )}

          {gameState === 'leaderboard' && (
            <Leaderboard onBack={() => setGameState('menu')} />
          )}

          {gameState === 'controls' && (
            <motion.div 
              key="controls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-20 p-12"
            >
              <h2 className="text-4xl font-black mb-12 tracking-tight">GAME CONTROLS</h2>
              
              <div className="grid grid-cols-2 gap-12 w-full max-w-4xl mb-12">
                <div className="bg-zinc-800/50 p-8 rounded-3xl border border-zinc-700 shadow-xl">
                  <h3 className="text-blue-400 font-black text-2xl mb-6 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                    PLAYER 1
                  </h3>
                  <div className="space-y-4 text-zinc-300">
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Movement</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">W A S D</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Block</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">S</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Sword / Spear / Bow</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">F / G / H</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Switch Weapon</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">R</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-8 rounded-3xl border border-zinc-700 shadow-xl">
                  <h3 className="text-red-400 font-black text-2xl mb-6 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    PLAYER 2
                  </h3>
                  <div className="space-y-4 text-zinc-300">
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Movement</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">ARROWS</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Block</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">DOWN</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-bottom border-zinc-700/50">
                      <span>Sword / Spear / Bow</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">1 / 2 / 3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Switch Weapon</span>
                      <span className="bg-zinc-700 px-3 py-1 rounded-lg font-mono text-white">O</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setGameState('menu')}
                className="px-12 py-4 bg-zinc-100 text-black font-black rounded-2xl hover:scale-105 transition-transform"
              >
                BACK TO MENU
              </button>
            </motion.div>
          )}

          {gameState === 'username' && (
            <motion.div 
              key="username"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30 p-12"
            >
              <h2 className="text-4xl font-black mb-8 tracking-tight">ENTER USERNAME</h2>
              <form onSubmit={handleUsernameSubmit} className="w-full max-w-sm flex flex-col gap-4">
                <input 
                  autoFocus
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your Name..."
                  className="w-full px-6 py-4 bg-zinc-800 border border-zinc-700 rounded-2xl text-xl font-bold focus:outline-none focus:border-orange-500 transition-colors"
                  maxLength={15}
                />
                <button 
                  type="submit"
                  className="w-full py-4 bg-orange-500 text-white font-black text-xl rounded-2xl hover:scale-105 transition-transform"
                >
                  CONTINUE
                </button>
                <button 
                  type="button"
                  onClick={() => setGameState('menu')}
                  className="w-full py-4 bg-zinc-800 text-zinc-400 font-bold text-lg rounded-2xl hover:bg-zinc-700 transition-colors"
                >
                  CANCEL
                </button>
              </form>
            </motion.div>
          )}

          {gameState === 'lobby' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-20"
            >
              <OnlineLobby playerName={username} onJoinRoom={joinRoom} onBack={() => setGameState('username')} />
            </motion.div>
          )}

          {gameState === 'room' && currentRoom && (
            <motion.div 
              key="room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-20"
            >
              <OnlineRoom room={currentRoom} onLeave={leaveRoom} onStart={() => {}} />
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div 
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <GameCanvas 
                mode={gameMode}
                mapId={selectedMap} 
                onGameOver={handleGameOver} 
                onLevelComplete={(level) => setStoryProgress(level)}
                isOnline={isOnline} 
                roomId={currentRoom?.id}
                initialPlayers={currentRoom ? Object.values(currentRoom.players) : undefined}
                playerName={username}
                startLevel={gameMode === 'story' ? (storyProgress || 1) : undefined}
              />
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl z-30"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-8">
                  <Trophy className="w-32 h-32 text-yellow-400" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full"
                  />
                </div>
                
                <h2 className="text-6xl font-black mb-2 tracking-tighter">
                  {gameMode === 'story' && winner === 'Enemies' ? 'CHAPTER FAILED' : 
                   gameMode === 'story' && winner !== 'Enemies' ? 'STORY COMPLETE!' :
                   gameMode === 'wave' ? 'WAVE OVER' :
                   `PLAYER ${winner} WINS!`}
                </h2>
                <p className="text-zinc-400 mb-12 font-medium uppercase tracking-widest">
                  {gameMode === 'story' && winner === 'Enemies' ? 'You were defeated' : 
                   gameMode === 'story' && winner !== 'Enemies' ? 'The Prince is Rescued!' :
                   gameMode === 'wave' ? 'The Horde Overwhelmed You' :
                   'Match Concluded'}
                </p>

                {gameMode === 'wave' && (
                  <div className="flex gap-12 text-4xl font-black mb-16 bg-zinc-800/50 px-12 py-6 rounded-3xl border border-zinc-700 shadow-2xl">
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-zinc-500 mb-1">WAVES COMPLETED</span>
                        <span className="text-orange-400">{waveRecord.waves}</span>
                      </div>
                      <div className="text-zinc-700 self-center">|</div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-zinc-500 mb-1">TOTAL TIME</span>
                        <span className="text-blue-400">
                            {Math.floor(waveRecord.time / 3600)}:
                            {Math.floor((waveRecord.time % 3600) / 60).toString().padStart(2, '0')}:
                            {(waveRecord.time % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                  </div>
                )}

                {gameMode !== 'story' && gameMode !== 'wave' && (
                  <div className="flex gap-12 text-4xl font-black mb-16 bg-zinc-800/50 px-12 py-6 rounded-3xl border border-zinc-700 shadow-2xl">
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-zinc-500 mb-1">PLAYER 1</span>
                        <span className="text-blue-400">{finalScores.p1}</span>
                      </div>
                      <div className="text-zinc-700 self-end mb-1">VS</div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-zinc-500 mb-1">PLAYER 2</span>
                        <span className="text-red-400">{finalScores.p2}</span>
                      </div>
                  </div>
                )}
                
                <div className="flex gap-4">
                    {gameMode === 'story' && winner === 'Enemies' ? (
                      <button
                        onClick={() => setGameState('playing')}
                        className="px-12 py-5 bg-white text-black font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                      >
                        RESTART CHAPTER
                      </button>
                    ) : (
                      <button
                        onClick={() => startGame(gameMode)}
                        className="px-12 py-5 bg-white text-black font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                      >
                        {gameMode === 'story' ? 'PLAY AGAIN' : 'PLAY AGAIN'}
                      </button>
                    )}
                    <button
                      onClick={resetGame}
                      className="px-12 py-5 bg-zinc-800 border border-zinc-700 text-white font-black text-xl rounded-2xl hover:bg-zinc-700 transition-all"
                    >
                      MENU
                    </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default App;
