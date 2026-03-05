import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Clock, Skull, ArrowLeft } from 'lucide-react';

interface Score {
  id: number;
  username: string;
  waves: number;
  time: number;
  date: string;
}

interface LeaderboardProps {
  onBack: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setScores(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load leaderboard', err);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30 p-12"
    >
      <div className="w-full max-w-2xl bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        <div className="p-6 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            WAVE MODE LEADERBOARD
          </h2>
          <button 
            onClick={onBack}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-zinc-500 font-bold">
              LOADING SCORES...
            </div>
          ) : scores.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500 font-bold">
              NO SCORES YET. BE THE FIRST!
            </div>
          ) : (
            <div className="space-y-4">
              {scores.map((score, index) => (
                <div 
                  key={score.id} 
                  className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-zinc-300 text-black' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-black text-xl">{score.username}</div>
                      <div className="text-xs text-zinc-500 font-bold">
                        {new Date(score.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-8">
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-zinc-500 font-bold flex items-center gap-1">
                        <Skull className="w-3 h-3" /> WAVES
                      </div>
                      <div className="font-black text-orange-500 text-xl">{score.waves}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-zinc-500 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> TIME
                      </div>
                      <div className="font-black text-blue-400 text-xl">
                        {Math.floor(score.time / 60)}:{(score.time % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
