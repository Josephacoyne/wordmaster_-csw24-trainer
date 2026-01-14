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

  // Long Press Logic for Hard Mode
  const [pressingKey, setPressingKey] = useState<string | null>(null);
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handlePressStart = (k: string) => {
     if (difficulty !== 'HARD') return; // Handled by onClick
     
     setPressingKey(k);
     longPressTimer.current = setTimeout(() => {
        handlePress(k);
        setPressingKey(null);
        if (navigator.vibrate) navigator.vibrate(15); 
     }, 400); // 400ms hold required
  };

  const handlePressEnd = () => {
     if (difficulty !== 'HARD') return;
     if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
     }
     setPressingKey(null);
  };
  
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
                     {feedback.type === 'success' ? currentQ.char : ''}
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
                     {feedback.type === 'success' ? currentQ.char : ''}
                  </div>
                )}
             </div>
             
             <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden shrink-0">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((qIndex) / questions.length) * 100}%` }} />
             </div>
          </div>
       </div>

       <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-9 gap-0.5">
           {keyboardKeys.map(k => {
             const isValidOption = difficulty === 'EASY' && validForCurrentSide.has(k);
             const isPressing = pressingKey === k;
             
             return (
               <button
                 key={k}
                 onClick={() => difficulty !== 'HARD' && handlePress(k)}
                 onPointerDown={(e) => {
                   // Do NOT release capture to ensure we track the hold
                   handlePressStart(k);
                 }}
                 onPointerUp={handlePressEnd}
                 onPointerLeave={handlePressEnd}
                 onPointerCancel={handlePressEnd}
                 onContextMenu={(e) => e.preventDefault()}
                 className={`aspect-[3/4] rounded-md font-bold text-lg transition-all select-none touch-manipulation relative overflow-hidden ${
                    isPressing ? 'scale-90 bg-indigo-200 border-indigo-400 text-indigo-800' :
                    isValidOption 
                    ? 'bg-yellow-100 border border-yellow-300 text-yellow-800 shadow-sm hover:bg-yellow-200'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 active:bg-slate-200'
                 }`}
               >
                 {difficulty === 'HARD' && (
                    <div 
                      className={`absolute bottom-0 left-0 right-0 bg-indigo-500/30 transition-all duration-[400ms] ease-linear ${isPressing ? 'h-full' : 'h-0'}`} 
                    />
                 )}
                 <span className="relative z-10">{k}</span>
               </button>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default HookView;