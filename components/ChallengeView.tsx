import React, { useState, useEffect, useMemo } from 'react';
import { WordEntry, WordLength, Difficulty } from '../types';
import { X, Trophy, ArrowLeft } from 'lucide-react';

interface ChallengeViewProps {
  difficulty: Difficulty;
  onIncorrectReal: (word: WordEntry) => void;
  fullDictionary: WordEntry[];
  fakes: Record<number, string[]>;
  onExit: () => void;
  topStreak: number;
  onUpdateHighScore: (score: number) => void;
}

const ChallengeView: React.FC<ChallengeViewProps> = ({ 
  difficulty,
  onIncorrectReal, 
  fullDictionary = [], 
  fakes,
  onExit,
  topStreak,
  onUpdateHighScore
}) => {
  // Setup vs Playing
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetLength, setTargetLength] = useState<WordLength | null>(null);

  // Gameplay
  const [currentWordStr, setCurrentWordStr] = useState<string | null>(null);
  const [isReal, setIsReal] = useState<boolean>(false);
  const [realWordData, setRealWordData] = useState<WordEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<'CORRECT' | 'WRONG' | null>(null);

  // Pools
  const realPool = useMemo(() => 
    targetLength ? fullDictionary.filter(w => w.w.length === targetLength) : [], 
  [fullDictionary, targetLength]);

  const fakePool = useMemo(() => 
    targetLength ? fakes[targetLength] || [] : [], 
  [fakes, targetLength]);

  const nextWord = () => {
    setResult(null);
    if (!targetLength) return;

    const shouldBeReal = Math.random() > 0.5;
    setIsReal(shouldBeReal);

    if (shouldBeReal) {
      const randomEntry = realPool[Math.floor(Math.random() * realPool.length)];
      setCurrentWordStr(randomEntry.w);
      setRealWordData(randomEntry);
    } else {
      const randomFake = fakePool[Math.floor(Math.random() * fakePool.length)];
      setCurrentWordStr(randomFake);
      setRealWordData(null);
    }
  };

  const handleStart = (len: WordLength) => {
    setTargetLength(len);
    setIsPlaying(true);
    setStreak(0);
  };

  useEffect(() => {
    if (isPlaying && targetLength) {
      nextWord();
    }
  }, [isPlaying]);

  const handleGuess = (userGuessedReal: boolean) => {
    const isCorrect = userGuessedReal === isReal;

    if (isCorrect) {
      setResult('CORRECT');
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > topStreak) {
        onUpdateHighScore(newStreak);
      }
      setTimeout(nextWord, 600);
    } else {
      setResult('WRONG');
      // Bogey if they missed a real word
      if (isReal && realWordData) {
        setTimeout(() => onIncorrectReal(realWordData), 800);
      } else {
        setTimeout(() => {
           setStreak(0);
           nextWord();
        }, 1000);
      }
    }
  };

  if (!isPlaying) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-6">
        <div className="flex items-center justify-between mb-8">
           <button onClick={onExit} className="p-2 bg-white rounded-full shadow-sm text-slate-400">
             <ArrowLeft size={24} />
           </button>
           <h2 className="font-black text-xl text-slate-700">CHALLENGE SETUP</h2>
           <div className="w-10" /> 
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="text-center mb-4">
            <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
            <h3 className="text-2xl font-black text-slate-800">Choose your Arena</h3>
            <p className="text-slate-500 font-medium">Select word length to challenge</p>
          </div>

          {[2, 3, 4].map((len) => (
             <button
               key={len}
               onClick={() => handleStart(len as WordLength)}
               className="w-full py-6 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-indigo-500 hover:text-indigo-600 font-black text-2xl text-slate-700 transition-all flex items-center justify-between px-8"
             >
               <span>{len} Letters</span>
               <ArrowLeft className="rotate-180" />
             </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 z-10">
        <button onClick={onExit} className="p-2 bg-white/50 backdrop-blur rounded-full text-slate-500 hover:bg-white transition-all">
          <X size={24} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Streak</span>
          <div className="flex items-baseline gap-2">
             <span className="text-3xl font-black text-indigo-600 leading-none">{streak}</span>
             <span className="text-xs font-bold text-slate-300">Best: {Math.max(streak, topStreak)}</span>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className={`w-full aspect-[4/3] max-w-sm bg-white rounded-[3rem] shadow-2xl flex items-center justify-center border-4 transition-all duration-300 ${
           result === 'CORRECT' ? 'border-emerald-400 scale-105' :
           result === 'WRONG' ? 'border-rose-400 rotate-1' : 'border-white'
        }`}>
           <span className="text-6xl font-black text-slate-800 tracking-wider">
             {currentWordStr}
           </span>
        </div>

        <div className="h-12 flex items-center justify-center font-black text-xl tracking-widest uppercase mt-4">
           {result === 'CORRECT' && <span className="text-emerald-500 animate-in fade-in slide-in-from-bottom-2">Correct!</span>}
           {result === 'WRONG' && <span className="text-rose-500 animate-in fade-in slide-in-from-bottom-2">Wrong!</span>}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 pb-12 grid grid-cols-2 gap-4">
         <button 
           onClick={() => handleGuess(false)}
           disabled={!!result}
           className="h-24 bg-rose-100 rounded-3xl text-rose-600 font-black text-xl border-b-4 border-rose-200 active:border-b-0 active:translate-y-1 transition-all"
         >
           FAKE
         </button>
         <button 
           onClick={() => handleGuess(true)}
           disabled={!!result}
           className="h-24 bg-emerald-100 rounded-3xl text-emerald-600 font-black text-xl border-b-4 border-emerald-200 active:border-b-0 active:translate-y-1 transition-all"
         >
           VALID
         </button>
      </div>
    </div>
  );
};

export default ChallengeView;