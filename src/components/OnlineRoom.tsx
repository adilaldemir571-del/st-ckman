import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { Room, ChatMessage, Player } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Check, Shield, MessageSquare, X, Plus } from 'lucide-react';

interface OnlineRoomProps {
  room: Room;
  onLeave: () => void;
  onStart: () => void;
}

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
];

export const OnlineRoom: React.FC<OnlineRoomProps> = ({ room, onLeave, onStart }) => {
  const [chatText, setChatText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const me = room.players[socket.id || ''];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.chat]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      socket.emit('send-chat', { roomId: room.id, text: chatText.trim() });
      setChatText('');
    }
  };

  const handleSelectColor = (color: string) => {
    socket.emit('select-color', { roomId: room.id, color });
  };

  const handleToggleReady = () => {
    socket.emit('toggle-ready', { roomId: room.id });
  };

  const players = Object.values(room.players) as Player[];
  const usedColors = players.map(p => p.color);

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-8 bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl w-full max-w-6xl h-full max-h-[80vh] overflow-hidden">
      {/* Left: Room Info & Players */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
              ROOM: <span className="text-orange-500">{room.id}</span>
            </h2>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-1">
              {players.length} / 4 PLAYERS CONNECTED
            </p>
          </div>
          <button 
            onClick={onLeave}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {players.map((player) => (
            <motion.div 
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                player.id === socket.id 
                  ? 'bg-zinc-800 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: player.color }}
              >
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg">{player.name}</span>
                  {player.ready && <Check className="w-4 h-4 text-green-500" />}
                </div>
                <span className="text-zinc-500 text-xs font-bold uppercase">{player.id === socket.id ? 'YOU' : 'PLAYER'}</span>
              </div>
            </motion.div>
          ))}
          
          {/* Empty Slots */}
          {Array.from({ length: 4 - players.length }).map((_, i) => (
            <div key={i} className="p-4 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center gap-4 opacity-50">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <Plus className="w-6 h-6 text-zinc-700" />
              </div>
              <span className="text-zinc-700 font-bold uppercase text-xs">Waiting for player...</span>
            </div>
          ))}
        </div>

        {/* Color Selection */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Choose Your Color</h3>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((color) => {
              const isTaken = usedColors.includes(color.value) && me?.color !== color.value;
              return (
                <button
                  key={color.value}
                  disabled={isTaken}
                  onClick={() => handleSelectColor(color.value)}
                  className={`w-12 h-12 rounded-xl transition-all relative group ${
                    me?.color === color.value ? 'ring-4 ring-white scale-110' : ''
                  } ${isTaken ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:scale-105'}`}
                  style={{ backgroundColor: color.value }}
                >
                  {me?.color === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {isTaken && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <X className="w-6 h-6 text-white/50" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={handleToggleReady}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl ${
            me?.ready 
              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' 
              : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {me?.ready ? 'UNREADY' : 'READY TO FIGHT'}
        </button>
      </div>

      {/* Right: Chat */}
      <div className="w-full lg:w-80 flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-bottom border-zinc-800 flex items-center gap-2 bg-zinc-800/50">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          <span className="font-black text-xs uppercase tracking-widest">Room Chat</span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[200px]">
          {room.chat.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'System' ? 'items-center' : ''}`}>
              {msg.sender !== 'System' && (
                <span className="text-[10px] font-black text-zinc-500 uppercase mb-1">{msg.sender}</span>
              )}
              <div className={`px-3 py-2 rounded-xl text-sm ${
                msg.sender === 'System' 
                  ? 'bg-zinc-800/50 text-zinc-500 italic text-xs' 
                  : msg.sender === me?.name ? 'bg-orange-500 text-white self-end' : 'bg-zinc-800 text-zinc-300 self-start'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendChat} className="p-4 bg-zinc-950 border-t border-zinc-800 flex gap-2">
          <input 
            type="text" 
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Type message..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <button 
            type="submit"
            className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};


