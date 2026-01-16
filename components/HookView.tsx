import React, { useState, useEffect, useMemo } from 'react';
import { HookData } from '../types';
import { ArrowLeft, Delete, Info, CheckCircle } from 'lucide-react';

interface HookViewProps {
  data: HookData;
  currentIndex: number;
  totalCount: number;
  onMastery: () => void;
  onExit: () => void;
}

type HookQuestion = {
  type: 'FRONT' | 'BACK';
  char: string;
  definition: string;
};

const LetterButton = ({ k, isHighlighted, onPress }: { k: string, isHighlighted: boolean, onPress: (k: string) => void }) => {
  return (
    <button
      onClick={() => onPress(k)}
      onContextMenu={(e) => e.preventDefault()}
      className={`aspect-[3/4] rounded-lg font-bold text-xl transition-all flex items-center justify-center select-none touch-manipulation shadow-sm active:scale-95 active:shadow-inner ${
         isHighlighted 
           ? 'bg-indigo-100 border-2 border-indigo-400 text-indigo-900 hover:bg-indigo-200' 
           : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100'
      }`}
    >
      {k}
    </button>
  );
};

const HookView: React.FC<HookViewProps> = ({ 
  data, 
  currentIndex,
  totalCount,
  onMastery,
  onExit
}) => {
  const [phase, setPhase] = useState<'LEARN' | 'TEST'>('LEARN');
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'neutral' | 'success' | 'error' | 'warning' }>({ msg: '', type: 'neutral' });
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [mistakesInCurrentRun, setMistakesInCurrentRun] = useState(false);

  // Logic: Flatten hooks
  const questions = useMemo<HookQuestion[]>(() => {
    if (!data) return [];
    const q: HookQuestion[] = [];
    data.frontHooks.forEach(h => q.push({ type: 'FRONT', char: h.char, definition: h.definition }));
    data.backHooks.forEach(h => q.push({ type: 'BACK', char: h.char, definition: h.definition }));
    return q;
  }, [data]);

  const currentQ = questions[qIndex];

  // Logic: Calculate ALL valid hooks for the current side (for Highlighting in Learn phase)
  const validForCurrentSide = useMemo(() => {
    if (!currentQ || !data) return new Set<string>();
    const source = currentQ.type === 'FRONT' ? data.frontHooks : data.backHooks;
    return new Set(source.map(h => h.char));
  }, [currentQ, data]);

  // Reset state when data changes (new word)
  useEffect(() => {
    setQIndex(0);
    setPhase('LEARN');
    setFeedback({ msg: '', type: 'neutral' });
    setSelectedChar(null);
    setMistakesInCurrentRun(false);
  }, [data]);

  const handlePress = (char: string) => {
    if (!currentQ || feedback.type === 'success') return;

    // Check correctness
    if (char === currentQ.char) {
      // Correct!
      setFeedback({ msg: 'Correct!', type: 'success' });
      setTimeout(() => {
        advance();
      }, 400);
    } else {
      // Wrong
      if (phase === 'TEST') {
         setMistakesInCurrentRun(true);
         setFeedback({ msg: 'Incorrect', type: 'error' });
      } else {
         // Learn phase: just visual feedback, no penalty
         setFeedback({ msg: 'Try again', type: 'warning' });
      }
      
      // Clear feedback quickly
      setTimeout(() => {
          if (feedback.type !== 'success') {
             setFeedback({ msg: '', type: 'neutral' });
          }
      }, 600);
    }
  };

  const advance = () => {
    setFeedback({ msg: '', type: 'neutral' });
    setSelectedChar(null);
    
    if (qIndex < questions.length - 1) {
      setQIndex(prev => prev + 1);
    } else {
      // End of questions for this phase
      if (phase === 'LEARN') {
         // Transition to TEST
         if (currentIndex === 0) {
             setShowIntroModal(true); // Barrier for first word only
         } else {
             startTest();
         }
      } else {
         // TEST Phase Complete
         if (mistakesInCurrentRun) {
             // Failed Test
             setFeedback({ msg: 'Mistakes made. Back to Learning...', type: 'error' });
             setTimeout(() => {
                 startLearn(); // Go back to Learn Phase
             }, 1500);
         } else {
             // Passed Test!
             onMastery();
         }
      }
    }
  };

  const startLearn = () => {
      setPhase('LEARN');
      setQIndex(0);
      setMistakesInCurrentRun(false);
      setFeedback({ msg: 'Learning Phase', type: 'neutral' });
      setShowIntroModal(false);
  };

  const startTest = () => {
      setPhase('TEST');
      setQIndex(0);
      setMistakesInCurrentRun(false);
      setFeedback({ msg: 'Test Phase', type: 'neutral' });
      setShowIntroModal(false);
  };

  // Completion Check (End of Deck)
  if (currentIndex >= totalCount) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
           <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center animate-in zoom-in">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <CheckCircle size={48} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Completed!</h2>
              <p className="text-slate-500 font-medium text-lg mb-8">
                 Congratulations, you are a Hook Master!
              </p>
              <button onClick={onExit} className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg">
                 Return Home
              </button>
           </div>
        </div>
      );
  }

  if (!currentQ && questions.length > 0) return <div>Loading...</div>;
  if (questions.length === 0 && data) { setTimeout(onMastery, 100); return <div>No Hooks</div>; }

  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
       {/* Intro Modal for Test Phase */}
       {showIntroModal && (
           <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
               <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs text-center w-full">
                   <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Info size={32} />
                   </div>
                   <h3 className="text-xl font-black text-slate-800 mb-2">Pass The Test To Progress</h3>
                   <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                       You've learned the hooks. Now prove you know them without hints. 
                       <br/><br/>
                       <span className="font-bold text-rose-500">One mistake and you return to learning!</span>
                   </p>
                   <button 
                     onClick={startTest}
                     className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                   >
                       I'm Ready
                   </button>
               </div>
           </div>
       )}

       {/* Header */}
       <div className="flex items-center justify-between p-3 bg-white shadow-sm z-10 shrink-0 h-16">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={24} />
         </button>
         <div className="flex flex-col items-center">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
               {phase === 'LEARN' ? 'Learning Phase' : 'Test Phase'}
           </span>
           <span className="text-lg font-black text-indigo-600">{currentIndex + 1} / {totalCount}</span>
         </div>
         <div className="w-12" />
       </div>

       {/* Game Area */}
       <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
          <div className={`bg-white rounded-[1.5rem] p-3 shadow-xl w-full max-w-xs relative overflow-hidden border-2 flex flex-col items-center justify-center max-h-full transition-colors duration-500 ${
              phase === 'TEST' ? 'border-amber-100 shadow-amber-100/50' : 'border-slate-100'
          }`}>
             
             <div className={`absolute top-3 font-black text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full ${
                 phase === 'TEST' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-400'
             }`}>
                {currentQ.type} HOOK
             </div>

             <div className="mt-6 mb-2 text-center flex-1 flex items-center justify-center max-h-[35%] overflow-y-auto no-scrollbar">
                <p className="text-xl font-medium text-slate-800 leading-snug px-2">
                  {currentQ.definition || "(No definition available)"}
                </p>
             </div>

             <div className={`text-center font-bold h-6 transition-all shrink-0 ${
                feedback.type === 'error' ? 'text-rose-500' :
                feedback.type === 'warning' ? 'text-amber-500' :
                feedback.type === 'success' ? 'text-emerald-500' : 'text-slate-300'
            }`}>
               {feedback.msg}
            </div>

             <div className="flex items-center justify-center gap-1 mb-3 shrink-0">
                {currentQ.type === 'FRONT' && (
                  <div className={`w-12 h-16 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-100 text-indigo-400 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : '?'}
                  </div>
                )}
                
                <div className="h-16 px-4 bg-slate-800 rounded-xl flex items-center justify-center text-4xl font-black text-white shadow-lg tracking-widest">
                   {data.word.w}
                </div>

                {currentQ.type === 'BACK' && (
                  <div className={`w-12 h-16 rounded-xl border-b-4 flex items-center justify-center text-4xl font-black transition-all ${
                     feedback.type === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 
                     feedback.type === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' : 
                     'border-indigo-100 text-indigo-400 bg-indigo-50'
                  }`}>
                     {feedback.type === 'success' ? currentQ.char : '?'}
                  </div>
                )}
             </div>
             
             <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden shrink-0">
                <div 
                    className={`h-full transition-all duration-300 ${phase === 'TEST' ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${((qIndex) / questions.length) * 100}%` }} 
                />
             </div>
          </div>
       </div>

       {/* Keyboard */}
       <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-7 gap-1">
           {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={phase === 'LEARN' && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['H', 'I', 'J', 'K', 'L', 'M', 'N'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={phase === 'LEARN' && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={phase === 'LEARN' && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['V', 'W', 'X', 'Y', 'Z'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={phase === 'LEARN' && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
        </div>
      </div>
    </div>
  );
};

export default HookView;