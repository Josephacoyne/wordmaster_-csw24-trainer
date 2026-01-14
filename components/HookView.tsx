import React, { useState, useEffect, useMemo } from 'react';
import { HookData, Difficulty } from '../types';
import { ArrowLeft } from 'lucide-react';

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
  }, [data]);

  const handlePress = (char: string) => {
    if (!currentQ || feedback.type === 'success') return;

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
         setTimeout(() => setFeedback({ msg: '', type: 'neutral' }), 500);
      }
    }
  };

  const advance = () => {
    setFeedback({ msg: '', type: 'neutral' });
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

  const keyboardKeys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

  return (
    <div className="flex flex-col h-full bg-slate-50">
       <div className="flex items-center justify-between p-4 bg-white shadow-sm z-10">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft />
         </button>
         <div className="font-black text-slate-400 text-xs tracking-widest uppercase">
           Hook Mastery {currentIndex + 1}/{totalCount}
         </div>
         <div className="w-8" />
       </div>

       <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl w-full max-w-sm relative overflow-hidden border-2 border-slate-100 flex flex-col items-center">
             
             <div className="absolute top-4 font-black text-[10px] text-indigo-300 tracking-widest uppercase bg-indigo-50 px-3 py-1 rounded-full">
                {currentQ.type} HOOK
             </div>

             <div className="mt-8 mb-8 text-center min-h-[4rem] flex items-center justify-center">
                <p className="text-xl font-medium text-slate-800 leading-snug">
                  {currentQ.definition || "(No definition available)"}
                </p>
             </div>

             <div className="flex items-center justify-center gap-1 mb-6">
                {currentQ.type === 'FRONT' && (
                  <div className={`w-14 h-20 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-300 text-indigo-600 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : '?'}
                  </div>
                )}
                
                <div className="h-20 px-6 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl font-black text-white shadow-lg tracking-widest">
                   {data.word.w}
                </div>

                {currentQ.type === 'BACK' && (
                  <div className={`w-14 h-20 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-300 text-indigo-600 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : '?'}
                  </div>
                )}
             </div>
             
             <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((qIndex) / questions.length) * 100}%` }} />
             </div>
          </div>
       </div>

       <div className="bg-white p-2 pb-8 border-t border-slate-100">
        <div className="max-w-md mx-auto grid grid-cols-9 gap-1">
           {keyboardKeys.map(k => {
             // HIGHLIGHT LOGIC: Easy Mode shows valid options for this word side
             const isValidOption = difficulty === 'EASY' && validForCurrentSide.has(k);
             
             return (
               <button
                 key={k}
                 onClick={() => handlePress(k)}
                 className={`aspect-[3/4] rounded-md font-bold text-lg transition-all ${
                    isValidOption 
                    ? 'bg-yellow-100 border border-yellow-300 text-yellow-800 shadow-sm hover:bg-yellow-200'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 active:bg-slate-200'
                 }`}
               >
                 {k}
               </button>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default HookView;