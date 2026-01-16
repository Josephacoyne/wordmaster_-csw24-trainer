import React, { useState, useEffect, useMemo } from 'react';
import { WordEntry, WordLength, Difficulty } from '../types';
import { X, Trophy, ArrowLeft, ArrowRight, Shuffle, SortAsc } from 'lucide-react';

interface ChallengeViewProps {
  difficulty: Difficulty;
  onIncorrectReal: (word: WordEntry) => void;
  fullDictionary: WordEntry[];
  fakes: Record<number, string[]>;
  onExit: () => void;
  topStreak: number;
  onUpdateHighScore: (score: number) => void;
}

type ChallengeOrder = 'RANDOM' | 'ALPHA';

interface ChallengeItem {
  word: string;
  isReal: boolean;
  data?: WordEntry;
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
  // Setup State
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetLength, setTargetLength] = useState<WordLength | null>(null);
  const [order, setOrder] = useState<ChallengeOrder>('RANDOM');

  // Game State
  const [deck, setDeck] = useState<ChallengeItem[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Derived
  const currentItem = deck[deckIndex];

  const buildDeck = (len: WordLength, mode: ChallengeOrder): ChallengeItem[] => {
    const reals = fullDictionary.filter(w => w.w.length === len);
    const fakeWords = fakes[len] || [];
    
    // Create items
    const realItems: ChallengeItem[] = reals.map(r => ({ word: r.w, isReal: true, data: r }));
    const fakeItems: ChallengeItem[] = fakeWords.map(f => ({ word: f, isReal: false }));
    
    let combined: ChallengeItem[] = [];

    if (mode === 'RANDOM') {
      combined = [...realItems, ...fakeItems];
      // Fisher-Yates shuffle
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }
    } else {
      // ALPHA: Group by first letter, then shuffle within group
      const groups: Record<string, ChallengeItem[]> = {};
      const allItems = [...realItems, ...fakeItems];
      
      allItems.forEach(item => {
        const char = item.word[0];
        if (!groups[char]) groups[char] = [];
        groups[char].push(item);
      });
      
      const sortedKeys = Object.keys(groups).sort();
      sortedKeys.forEach(key => {
        const group = groups[key];
        // Shuffle group
        group.sort(() => 0.5 - Math.random());
        combined.push(...group);
      });
    }
    
    return combined;
  };

  const handleStart = (len: WordLength) => {
    const newDeck = buildDeck(len, order);
    setDeck(newDeck);
    setDeckIndex(0);
    setTargetLength(len);
    setStreak(0);
    setIsPlaying(true);
    setIsComplete(false);
    setResult(null);
  };

  const nextWord = () => {
    setResult(null);
    if (deckIndex >= deck.length - 1) {
      setIsComplete(true);
    } else {
      setDeckIndex(prev => prev + 1);
    }
  };

  const handleGuess = (userGuessedReal: boolean) => {
    if (!currentItem) return;
    
    const isCorrect = userGuessedReal === currentItem.isReal;

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
      if (currentItem.isReal && currentItem.data) {
        // Need to capture data for closure
        const wordData = currentItem.data;
        setTimeout(() => onIncorrectReal(wordData), 800);
      } else {
        setTimeout(() => {
           setStreak(0);
           nextWord();
        }, 800);
      }
    }
  };

  const handleNextLevel = () => {
    if (targetLength && targetLength < 4) {
      handleStart((targetLength + 1) as WordLength);
    } else {
      onExit();
    }
  };

  if (!isPlaying) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4">
        <div className="flex items-center justify-between mb-4">
           <button onClick={onExit} className="p-2 bg-white rounded-full shadow-sm text-slate-400">
             <ArrowLeft size={20} />
           </button>
           <h2 className="font-black text-lg text-slate-700">CHALLENGE SETUP</h2>
           <div className="w-10" /> 
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-center mb-2">
            <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
            <h3 className="text-2xl font-black text-slate-800 mb-1">Choose your Arena</h3>
            <p className="text-slate-500 font-medium">Select word length to challenge</p>
          </div>

          {/* Order Toggle */}
          <div className="bg-white p-1 rounded-2xl shadow-sm flex gap-1 mb-2">
            <button
              onClick={() => setOrder('RANDOM')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                order === 'RANDOM'
                  ? 'bg-slate-800 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <Shuffle size={16} />
              RANDOM
            </button>
            <button
              onClick={() => setOrder('ALPHA')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                order === 'ALPHA'
                  ? 'bg-slate-800 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <SortAsc size={16} />
              ALPHABETICAL
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {[2, 3, 4].map((len) => (
               <button
                 key={len}
                 onClick={() => handleStart(len as WordLength)}
                 className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-indigo-500 hover:text-indigo-600 font-black text-xl text-slate-700 transition-all flex items-center justify-between px-6 group"
               >
                 <span>{len} Letters</span>
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                    <ArrowRight className="text-slate-400 group-hover:text-indigo-600" size={16} />
                 </div>
               </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Completion Modal
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <Trophy size={40} fill="currentColor" />
            </div>
           <h2 className="text-3xl font-black text-slate-800 mb-2">
              {targetLength}L Challenge Complete
           </h2>
           <p className="text-slate-500 font-medium mb-8">
              You've faced every word in the deck.
           </p>
           
           <div className="flex flex-col gap-3">
              {targetLength && targetLength < 4 ? (
                 <button onClick={handleNextLevel} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                   Try {targetLength + 1}L
                 </button>
              ) : null}
               <button onClick={onExit} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                  Return Home
               </button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-10 shrink-0">
        <button onClick={onExit} className="p-2 bg-white/50 backdrop-blur rounded-full text-slate-500 hover:bg-white transition-all">
          <X size={20} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Streak</span>
          <div className="flex items-baseline gap-1">
             <span className="text-2xl font-black text-indigo-600 leading-none">{streak}</span>
             <span className="text-[10px] font-bold text-slate-300">Best: {Math.max(streak, topStreak)}</span>
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Progress Bar (Optional but helpful for 'Completion') */}
      <div className="px-6 shrink-0 mb-2">
          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${((deckIndex) / deck.length) * 100}%` }}
              />
          </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-0">
        <div className={`w-full aspect-[4/3] max-w-xs bg-white rounded-[2rem] shadow-2xl flex items-center justify-center border-4 transition-all duration-300 max-h-full ${
           result === 'CORRECT' ? 'border-emerald-400 scale-105' :
           result === 'WRONG' ? 'border-rose-400 rotate-1' : 'border-white'
        }`}>
           <span className="text-5xl font-black text-slate-800 tracking-wider text-center break-words px-4">
             {currentItem?.word}
           </span>
        </div>

        <div className="h-8 flex items-center justify-center font-black text-lg tracking-widest uppercase mt-4 shrink-0">
           {result === 'CORRECT' && <span className="text-emerald-500 animate-in fade-in slide-in-from-bottom-2">Correct!</span>}
           {result === 'WRONG' && <span className="text-rose-500 animate-in fade-in slide-in-from-bottom-2">Wrong!</span>}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 pb-8 grid grid-cols-2 gap-3 shrink-0">
         <button 
           onClick={() => handleGuess(false)}
           disabled={!!result}
           className="h-20 bg-rose-100 rounded-2xl text-rose-600 font-black text-lg border-b-4 border-rose-200 active:border-b-0 active:translate-y-1 transition-all"
         >
           FAKE
         </button>
         <button 
           onClick={() => handleGuess(true)}
           disabled={!!result}
           className="h-20 bg-emerald-100 rounded-2xl text-emerald-600 font-black text-lg border-b-4 border-emerald-200 active:border-b-0 active:translate-y-1 transition-all"
         >
           VALID
         </button>
      </div>
    </div>
  );
};

export default ChallengeView;