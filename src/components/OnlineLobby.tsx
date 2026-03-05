import React, { useState, useEffect } from 'react';
import { socket, connectSocket } from '../socket';
import { Room } from '../types';
import { motion } from 'motion/react';
import { Users, Plus, ArrowRight } from 'lucide-react';

interface OnlineLobbyProps {
  playerName: string;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onBack: () => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ playerName, onJoinRoom, onBack }) => {
  const [roomId, setRoomId] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom(roomId.trim(), playerName);
    }
  };

  const handleCreate = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinRoom(newRoomId, playerName);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl w-full max-w-md"
    >
      <h2 className="text-3xl font-black mb-8 tracking-tight">ONLINE MULTIPLAYER</h2>
      
      <div className="w-full space-y-6">
        <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700 flex items-center justify-between">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Playing as</label>
            <span className="text-lg font-black text-white">{playerName}</span>
          </div>
          <button 
            onClick={onBack}
            className="text-xs font-bold text-orange-500 hover:text-orange-400"
          >
            CHANGE
          </button>
        </div>

        <div className="h-px bg-zinc-800 my-2"></div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Join Room</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Room Code..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button 
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-xl transition-colors"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </form>

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-zinc-800"></div>
          <span className="flex-shrink mx-4 text-zinc-600 text-xs font-bold uppercase">Or</span>
          <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        <button 
          onClick={handleCreate}
          className="w-full bg-white text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          CREATE NEW ROOM
        </button>

        <button 
          onClick={onBack}
          className="w-full text-zinc-500 font-bold py-2 hover:text-white transition-colors text-sm"
        >
          BACK TO MENU
        </button>
      </div>
    </motion.div>
  );
};
