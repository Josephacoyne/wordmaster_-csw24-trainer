import React, { useState, useEffect, useMemo } from 'react';
import { HookData } from '../types';
import { ArrowLeft, CheckCircle } from 'lucide-react';

interface HookViewProps {
  data: HookData;
  currentIndex: number;
  totalCount: number;
  onMastery: () => void;
  onExit: () => void;
  onScoreUpdate?: (correct: number, incorrect: number) => void;
  onAllComplete?: (totalErrors: number) => void;
}

type HookQuestion = {
  type: 'FRONT' | 'BACK';
  char: string;
  definition: string;
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const LetterButton: React.FC<{ k: string, isHighlighted: boolean, onPress: (k: string) => void }> = ({ k, isHighlighted, onPress }) => {
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

// Stages: Learn Front → Test Front → Learn Back → Test Back
type Stage = 'LEARN_FRONT' | 'TEST_FRONT' | 'LEARN_BACK' | 'TEST_BACK';

const HookView: React.FC<HookViewProps> = ({
  data,
  currentIndex,
  totalCount,
  onMastery,
  onExit,
  onScoreUpdate,
  onAllComplete
}) => {
  const [stage, setStage] = useState<Stage>('LEARN_FRONT');
  const [qIndex, setQIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'neutral' | 'success' | 'error' | 'warning' }>({ msg: '', type: 'neutral' });

  // Score tallies
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [testErrors, setTestErrors] = useState(0);

  // Build sorted question lists for front and back hooks
  const frontQuestions = useMemo<HookQuestion[]>(() => {
    if (!data) return [];
    return data.frontHooks
      .map(h => ({ type: 'FRONT' as const, char: h.char, definition: h.definition }))
      .sort((a, b) => a.char.localeCompare(b.char));
  }, [data]);

  const backQuestions = useMemo<HookQuestion[]>(() => {
    if (!data) return [];
    return data.backHooks
      .map(h => ({ type: 'BACK' as const, char: h.char, definition: h.definition }))
      .sort((a, b) => a.char.localeCompare(b.char));
  }, [data]);

  // Active list changes per stage (alphabetical for learn, shuffled for test)
  const [activeList, setActiveList] = useState<HookQuestion[]>([]);

  const isLearnStage = stage === 'LEARN_FRONT' || stage === 'LEARN_BACK';
  const isFrontStage = stage === 'LEARN_FRONT' || stage === 'TEST_FRONT';

  // Valid hooks for the current side (for highlighting in Learn stages)
  const validForCurrentSide = useMemo(() => {
    if (!data) return new Set<string>();
    const source = isFrontStage ? data.frontHooks : data.backHooks;
    return new Set(source.map(h => h.char));
  }, [data, isFrontStage]);

  // Reset when data changes (new word)
  useEffect(() => {
    setQIndex(0);
    setTestErrors(0);
    setFeedback({ msg: '', type: 'neutral' });

    if (frontQuestions.length > 0) {
      setStage('LEARN_FRONT');
      setActiveList(frontQuestions);
    } else if (backQuestions.length > 0) {
      setStage('LEARN_BACK');
      setActiveList(backQuestions);
    }
  }, [data]); // frontQuestions/backQuestions derived from data

  const currentQ = activeList[qIndex];

  const startStage = (newStage: Stage) => {
    let list: HookQuestion[] = [];
    switch (newStage) {
      case 'LEARN_FRONT': list = frontQuestions; break;
      case 'TEST_FRONT': list = shuffle(frontQuestions); break;
      case 'LEARN_BACK': list = backQuestions; break;
      case 'TEST_BACK': list = shuffle(backQuestions); break;
    }
    setActiveList(list);
    setStage(newStage);
    setQIndex(0);
    setTestErrors(0);

    const isLearn = newStage === 'LEARN_FRONT' || newStage === 'LEARN_BACK';
    const side = newStage.includes('FRONT') ? 'Front' : 'Back';
    setFeedback({
      msg: isLearn ? `Learn ${side} Hooks` : `Test ${side} Hooks — No hints!`,
      type: 'neutral'
    });
  };

  const getNextStage = (): Stage | 'DONE' => {
    switch (stage) {
      case 'LEARN_FRONT': return 'TEST_FRONT';
      case 'TEST_FRONT':
        return backQuestions.length > 0 ? 'LEARN_BACK' : 'DONE';
      case 'LEARN_BACK': return 'TEST_BACK';
      case 'TEST_BACK': return 'DONE';
    }
  };

  // Which learn stage to reset to on 3 errors
  const getLearnStageForCurrentTest = (): Stage => {
    return stage === 'TEST_FRONT' ? 'LEARN_FRONT' : 'LEARN_BACK';
  };

  const handlePress = (char: string) => {
    if (!currentQ || feedback.type === 'success') return;

    if (char === currentQ.char) {
      setFeedback({ msg: 'Correct!', type: 'success' });

      if (!isLearnStage) {
        const newCorrect = correct + 1;
        setCorrect(newCorrect);
        onScoreUpdate?.(newCorrect, incorrect);
      }

      setTimeout(() => {
        advance();
      }, 400);
    } else {
      if (!isLearnStage) {
        const newIncorrect = incorrect + 1;
        const newTestErrors = testErrors + 1;
        setIncorrect(newIncorrect);
        setTestErrors(newTestErrors);
        onScoreUpdate?.(correct, newIncorrect);

        if (newTestErrors >= 3) {
          setFeedback({ msg: 'Back to Learning...', type: 'error' });
          setTimeout(() => {
            startStage(getLearnStageForCurrentTest());
          }, 1500);
          return;
        }

        setFeedback({ msg: 'Incorrect', type: 'error' });
      } else {
        setFeedback({ msg: 'Try again', type: 'warning' });
      }

      setTimeout(() => {
          setFeedback({ msg: '', type: 'neutral' });
      }, 600);
    }
  };

  const advance = () => {
    setFeedback({ msg: '', type: 'neutral' });

    if (qIndex < activeList.length - 1) {
      setQIndex(prev => prev + 1);
    } else {
      // End of current stage
      const next = getNextStage();
      if (next === 'DONE') {
        if (currentIndex >= totalCount - 1) {
          onAllComplete?.(incorrect);
        }
        onMastery();
      } else {
        startStage(next);
      }
    }
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

  if (!currentQ && activeList.length > 0) return <div>Loading...</div>;
  if (activeList.length === 0 && data) {
    // No hooks at all for this word — skip
    if (frontQuestions.length === 0 && backQuestions.length === 0) {
      setTimeout(onMastery, 100);
      return <div>No Hooks</div>;
    }
    return <div>Loading...</div>;
  }

  const stageLabel = isLearnStage
    ? `Learn ${isFrontStage ? 'Front' : 'Back'} Hooks`
    : `Test ${isFrontStage ? 'Front' : 'Back'} Hooks`;

  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
       {/* Header */}
       <div className="flex items-center justify-between p-3 bg-white shadow-sm z-10 shrink-0 h-16">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={24} />
         </button>
         <div className="flex flex-col items-center">
           <span className={`text-[10px] font-black uppercase tracking-widest ${
             !isLearnStage ? 'text-amber-500' : 'text-slate-400'
           }`}>
               {stageLabel}
           </span>
           <div className="flex items-center gap-3">
             <span className="text-lg font-black text-indigo-600">{currentIndex + 1} / {totalCount}</span>
             <span className="text-xs font-bold">
               <span className="text-emerald-500">✓ {correct}</span>
               {' '}
               <span className="text-rose-400">✗ {incorrect}</span>
             </span>
           </div>
         </div>
         <div className="w-12" />
       </div>

       {/* Game Area */}
       <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
          <div className={`bg-white rounded-[1.5rem] p-3 shadow-xl w-full max-w-xs relative overflow-hidden border-2 flex flex-col items-center justify-center max-h-full transition-colors duration-500 ${
              !isLearnStage ? 'border-amber-100 shadow-amber-100/50' : 'border-slate-100'
          }`}>

             <div className={`absolute top-3 font-black text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full ${
                 !isLearnStage ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-400'
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
                    className={`h-full transition-all duration-300 ${!isLearnStage ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${((qIndex) / activeList.length) * 100}%` }}
                />
             </div>
          </div>
       </div>

       {/* Keyboard */}
       <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-7 gap-1">
           {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={isLearnStage && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['H', 'I', 'J', 'K', 'L', 'M', 'N'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={isLearnStage && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={isLearnStage && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
           {['V', 'W', 'X', 'Y', 'Z'].map(k => (
              <LetterButton key={k} k={k} isHighlighted={isLearnStage && validForCurrentSide.has(k)} onPress={handlePress} />
           ))}
        </div>
      </div>
    </div>
  );
};

export default HookView;
