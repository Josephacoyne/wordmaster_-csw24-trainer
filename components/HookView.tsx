import React, { useState, useEffect, useMemo } from 'react';
import { HookData, Difficulty } from '../types';
import { ArrowLeft, Delete } from 'lucide-react';

interface HookViewProps {
  data: HookData;
  difficulty: Difficulty;
  currentIndex: number;
  totalCount: number;
  onMastery: (word: string) => void;
  onFail: () => void;
  onNext: () => void;
  onExit: () => void;
}

type HookQuestion = {
  type: 'FRONT' | 'BACK';
  char: string;
  definition: string;
};

const LetterButton = ({ k, highlightedKeys, onPress }: { k: string, highlightedKeys: Set<string>, onPress: (k: string) => void }) => {
  const isPossible = highlightedKeys.has(k);
  return (
    <button
      onClick={() => onPress(k)}
      onContextMenu={(e) => e.preventDefault()}
      className={`aspect-[3/4] rounded-lg font-bold text-xl transition-all flex items-center justify-center select-none touch-manipulation shadow-sm active:scale-95 active:shadow-inner ${
         isPossible 
           ? 'bg-yellow-100 border-2 border-yellow-300 text-yellow-800 hover:bg-yellow-200' 
           : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100'
      }`}
    >
      {k}
    </button>
  );
};

const HookView: React.FC<HookViewProps> = ({ 
  data, 
  difficulty, 
  currentIndex,
  totalCount,
  onMastery,
  onFail,
  onNext,
  onExit
}) => {
  const [qIndex, setQIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'neutral' | 'success' | 'error' }>({ msg: '', type: 'neutral' });
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  // Logic: Flatten hooks
  const questions = useMemo<HookQuestion[]>(() => {
    if (!data) return [];
    const q: HookQuestion[] = [];
    data.frontHooks.forEach(h => q.push({ type: 'FRONT', char: h.char, definition: h.definition }));
    data.backHooks.forEach(h => q.push({ type: 'BACK', char: h.char, definition: h.definition }));
    return q;
  }, [data]);

  const currentQ = questions[qIndex];

  // Logic: Calculate ALL valid hooks for the current side (for Easy Mode highlighting)
  const validForCurrentSide = useMemo(() => {
    if (!currentQ || !data) return new Set<string>();
    const source = currentQ.type === 'FRONT' ? data.frontHooks : data.backHooks;
    return new Set(source.map(h => h.char));
  }, [currentQ, data]);

  useEffect(() => {
    setQIndex(0);
    setFeedback({ msg: '', type: 'neutral' });
    setSelectedChar(null);
  }, [data]);

  const validateAnswer = (char: string) => {
    if (char === currentQ.char) {
      setFeedback({ msg: 'Correct!', type: 'success' });
      setTimeout(() => {
        advance();
      }, 500);
    } else {
      setFeedback({ msg: difficulty === 'HARD' ? 'Strict Fail! Resetting...' : 'Incorrect', type: 'error' });
      
      if (difficulty === 'HARD') {
         setTimeout(() => onFail(), 1000);
      } else {
         setTimeout(() => {
             setFeedback({ msg: '', type: 'neutral' });
             setSelectedChar(null);
         }, 500);
      }
    }
  };

  const handlePress = (char: string) => {
    if (!currentQ || feedback.type === 'success') return;
    
    // In Hard Mode, select the char but don't validate yet
    if (difficulty === 'HARD') {
        setSelectedChar(char);
    } else {
        // Easy/Medium: validate immediately
        validateAnswer(char);
    }
  };

  const handleEnter = () => {
      if (selectedChar) {
          validateAnswer(selectedChar);
      }
  };

  const handleDelete = () => {
      setSelectedChar(null);
  };

  const advance = () => {
    setFeedback({ msg: '', type: 'neutral' });
    setSelectedChar(null);
    if (qIndex < questions.length - 1) {
      setQIndex(prev => prev + 1);
    } else {
      // Done with this word
      onMastery(data.word.w);
    }
  };

  if (!currentQ && questions.length > 0) return <div>Loading...</div>;
  // Auto-skip if empty
  if (questions.length === 0 && data) { setTimeout(onNext, 100); return <div>No Hooks</div>; }

  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
       <div className="flex items-center justify-between p-3 bg-white shadow-sm z-10 shrink-0 h-16">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={24} />
         </button>
         <div className="flex flex-col items-center">
           <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">Hook Mastery</span>
           <span className="text-lg font-black text-indigo-600">{currentIndex + 1} / {totalCount}</span>
         </div>
         {/* Placeholder for symmetry or skip button if needed, but Hook mode has auto-advance */}
         <div className="w-12" />
       </div>

       <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
          <div className="bg-white rounded-[1.5rem] p-3 shadow-xl w-full max-w-xs relative overflow-hidden border-2 border-slate-100 flex flex-col items-center justify-center max-h-full">
             
             <div className="absolute top-3 font-black text-[9px] text-indigo-300 tracking-widest uppercase bg-indigo-50 px-2 py-0.5 rounded-full">
                {currentQ.type} HOOK
             </div>

             <div className="mt-6 mb-2 text-center flex-1 flex items-center justify-center max-h-[35%] overflow-y-auto no-scrollbar">
                <p className="text-xl font-medium text-slate-800 leading-snug px-2">
                  {currentQ.definition || "(No definition available)"}
                </p>
             </div>

             <div className="flex items-center justify-center gap-1 mb-3 shrink-0">
                {currentQ.type === 'FRONT' && (
                  <div className={`w-12 h-16 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-300 text-indigo-600 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : (difficulty === 'HARD' ? selectedChar || '' : '')}
                  </div>
                )}
                
                <div className="h-16 px-4 bg-slate-800 rounded-xl flex items-center justify-center text-4xl font-black text-white shadow-lg tracking-widest">
                   {data.word.w}
                </div>

                {currentQ.type === 'BACK' && (
                  <div className={`w-12 h-16 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-300 text-indigo-600 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : (difficulty === 'HARD' ? selectedChar || '' : '')}
                  </div>
                )}
             </div>
             
             <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden shrink-0">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((qIndex) / questions.length) * 100}%` }} />
             </div>
          </div>
       </div>

       <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-7 gap-1">
           {/* Row 1: A-G */}
           {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(k => (
              <LetterButton key={k} k={k} highlightedKeys={difficulty === 'EASY' ? validForCurrentSide : new Set()} onPress={handlePress} />
           ))}

           {/* Row 2: H-N */}
           {['H', 'I', 'J', 'K', 'L', 'M', 'N'].map(k => (
              <LetterButton key={k} k={k} highlightedKeys={difficulty === 'EASY' ? validForCurrentSide : new Set()} onPress={handlePress} />
           ))}

           {/* Row 3: O-U */}
           {['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map(k => (
              <LetterButton key={k} k={k} highlightedKeys={difficulty === 'EASY' ? validForCurrentSide : new Set()} onPress={handlePress} />
           ))}

           {/* Row 4: V-Z + DEL + ENTER */}
           {['V', 'W', 'X', 'Y', 'Z'].map(k => (
              <LetterButton key={k} k={k} highlightedKeys={difficulty === 'EASY' ? validForCurrentSide : new Set()} onPress={handlePress} />
           ))}

           {/* DELETE BUTTON (Column 6 of Row 4) */}
           <button 
              onClick={handleDelete}
              className={`rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-black text-xs hover:bg-slate-200 active:scale-95 flex flex-col items-center justify-center transition-all ${
                difficulty !== 'HARD' ? 'col-span-2 aspect-auto' : 'aspect-[3/4]'
              }`}
              aria-label="Delete"
            >
              <Delete size={20} />
              <span className="text-[10px] mt-0.5">DEL</span>
            </button>

            {/* ENTER BUTTON (Column 7 of Row 4 - Only in Hard Mode) */}
            {difficulty === 'HARD' && (
                <button 
                  onClick={handleEnter}
                  disabled={!selectedChar}
                  className={`aspect-[3/4] rounded-lg border font-black text-xs flex flex-col items-center justify-center transition-all ${
                     selectedChar 
                       ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-200' 
                       : 'bg-slate-50 border-slate-200 text-slate-300'
                  }`}
                  aria-label="Enter"
                >
                  <div className="w-5 h-5 flex items-center justify-center border-2 border-current rounded-md mb-0.5">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
                  </div>
                  <span className="text-[10px]">ENT</span>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
// Updated HookView with 4-row keyboard and Hard Mode Enter logic

export default HookView;