import React, { useState, useEffect, useMemo } from 'react';
import { WordEntry } from '../types';
import { ArrowLeft, Delete, FastForward } from 'lucide-react';

interface TrainingViewProps {
  pool: WordEntry[];
  initialIndex: number;
  currentLetter: string;
  fullDictionary: WordEntry[];
  onSuccess: (word: WordEntry) => void;
  onComplete: (totalErrors: number) => void;
  onSkipToLetter: (letter: string) => void;
  onExit: () => void;
  onScoreUpdate?: (correct: number, incorrect: number) => void;
}

const LetterButton: React.FC<{ k: string, highlightedKeys: Set<string>, onPress: (k: string) => void }> = ({ k, highlightedKeys, onPress }) => {
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

// Group words by their prefix (all chars except last)
function groupByPrefix(words: WordEntry[]): WordEntry[][] {
  const groups: Record<string, WordEntry[]> = {};
  const order: string[] = [];
  words.forEach(w => {
    const prefix = w.w.substring(0, w.w.length - 1);
    if (!groups[prefix]) {
      groups[prefix] = [];
      order.push(prefix);
    }
    groups[prefix].push(w);
  });
  return order.map(p => groups[p]);
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const TrainingView: React.FC<TrainingViewProps> = ({
  pool,
  initialIndex,
  currentLetter,
  fullDictionary,
  onSuccess,
  onComplete,
  onSkipToLetter,
  onExit,
  onScoreUpdate
}) => {
  const [phase, setPhase] = useState<'TRAIN' | 'TEST'>('TRAIN');
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'neutral' | 'success' | 'error' | 'warning' }>({ msg: 'Type the missing letter', type: 'neutral' });
  const [showLetterSkip, setShowLetterSkip] = useState(false);

  // Score tallies (running across all test attempts)
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);

  // Errors in current test batch (resets each test attempt)
  const [testErrors, setTestErrors] = useState(0);

  // Split pool into prefix-based batches (e.g. AA_, AB_, AC_...)
  const batches = useMemo(() => groupByPrefix(pool), [pool]);

  // Track which batch we're on, and position within it
  const [batchIndex, setBatchIndex] = useState(0);
  const [internalIndex, setInternalIndex] = useState(0);

  // The active word list for the current phase (alphabetical for TRAIN, shuffled for TEST)
  const [activeList, setActiveList] = useState<WordEntry[]>([]);

  // Initialize / sync when pool changes
  useEffect(() => {
    setBatchIndex(0);
    setInternalIndex(0);
    setPhase('TRAIN');
    setTestErrors(0);
    setInputValue('');
    setFeedback({ msg: 'Type the missing letter', type: 'neutral' });
    if (batches.length > 0) {
      setActiveList(batches[0]);
    }
  }, [pool]); // batches is derived from pool

  // Keep activeList in sync when batchIndex changes
  useEffect(() => {
    if (batches.length > 0 && batchIndex < batches.length) {
      setActiveList(batches[batchIndex]);
    }
  }, [batchIndex, batches]);

  const currentWord = activeList[internalIndex];
  const currentPrefix = currentWord ? currentWord.w.substring(0, currentWord.w.length - 1) : '';

  // Always guess 1 letter
  const prefixLength = currentWord ? currentWord.w.length - 1 : 0;
  const prefix = currentPrefix;
  const targetSuffix = currentWord ? currentWord.w.substring(prefixLength) : '';

  // Valid alternatives for this prefix
  const validAlternatives = useMemo(() => {
    if (!currentWord) return new Set<string>();
    return new Set(
      fullDictionary
        .filter(w => w.w.length === currentWord.w.length && w.w.startsWith(prefix))
        .map(w => w.w)
    );
  }, [currentWord, fullDictionary, prefix]);

  // Highlights only in TRAIN phase
  const highlightedKeys = useMemo(() => {
    if (phase !== 'TRAIN' || !currentWord) return new Set<string>();
    const validNextChars = new Set<string>();
    const currentInputLen = inputValue.length;
    validAlternatives.forEach(word => {
        const wordSuffix = word.substring(prefixLength);
        if (wordSuffix.startsWith(inputValue)) {
            const nextChar = wordSuffix[currentInputLen];
            if (nextChar) validNextChars.add(nextChar);
        }
    });
    return validNextChars;
  }, [phase, currentWord, inputValue, validAlternatives, prefixLength]);

  const startBatch = (idx: number, startPhase: 'TRAIN' | 'TEST' = 'TRAIN') => {
    const batch = batches[idx];
    if (!batch) return;
    const list = startPhase === 'TEST' ? shuffle(batch) : batch;
    setActiveList(list);
    setBatchIndex(idx);
    setInternalIndex(0);
    setPhase(startPhase);
    setTestErrors(0);
    setInputValue('');
    setFeedback({ msg: startPhase === 'TRAIN' ? 'Type the missing letter' : 'No hints!', type: 'neutral' });
  };

  const advanceToNext = () => {
    if (internalIndex < activeList.length - 1) {
      setInternalIndex(i => i + 1);
      setInputValue('');
      setFeedback({ msg: phase === 'TRAIN' ? 'Type the missing letter' : 'No hints!', type: 'neutral' });
    } else {
      // Completed all words in this batch for this phase
      if (phase === 'TRAIN') {
        // Switch to TEST for same batch — shuffled
        const shuffled = shuffle(batches[batchIndex]);
        setActiveList(shuffled);
        setPhase('TEST');
        setInternalIndex(0);
        setTestErrors(0);
        setInputValue('');
        setFeedback({ msg: 'No hints!', type: 'neutral' });
      } else {
        // TEST passed for this batch — advance to next batch or complete
        if (batchIndex < batches.length - 1) {
          startBatch(batchIndex + 1, 'TRAIN');
        } else {
          // All batches done
          onComplete(incorrect);
        }
      }
    }
  };

  const validateInput = (fullInput: string) => {
      const fullAttempt = prefix + fullInput;

      if (fullAttempt === currentWord.w) {
        setFeedback({ msg: 'Correct!', type: 'success' });

        if (phase === 'TEST') {
          const newCorrect = correct + 1;
          setCorrect(newCorrect);
          onScoreUpdate?.(newCorrect, incorrect);
          onSuccess(currentWord);
        }

        setTimeout(() => {
          advanceToNext();
        }, 600);
      } else {
        // INCORRECT
        if (phase === 'TRAIN') {
          // Train: just retry, no penalty
          if (validAlternatives.has(fullAttempt)) {
            setFeedback({ msg: 'Valid word, but not this one!', type: 'warning' });
          } else {
            setFeedback({ msg: 'Try again', type: 'error' });
          }
          setTimeout(() => {
            setInputValue('');
            setFeedback({ msg: 'Type the missing letter', type: 'neutral' });
          }, 800);
        } else {
          // TEST: increment errors
          const newIncorrect = incorrect + 1;
          const newTestErrors = testErrors + 1;
          setIncorrect(newIncorrect);
          setTestErrors(newTestErrors);
          onScoreUpdate?.(correct, newIncorrect);

          if (newTestErrors >= 3) {
            // Back to training for same batch
            setFeedback({ msg: 'Back to Training...', type: 'error' });
            setTimeout(() => {
              startBatch(batchIndex, 'TRAIN');
            }, 1500);
          } else {
            if (validAlternatives.has(fullAttempt)) {
              setFeedback({ msg: 'Valid word, but not this one!', type: 'warning' });
            } else {
              setFeedback({ msg: 'Incorrect', type: 'error' });
            }
            setTimeout(() => {
              setInputValue('');
              setFeedback({ msg: 'No hints!', type: 'neutral' });
            }, 800);
          }
        }
      }
  };

  const handleKeyPress = (key: string) => {
    if (!currentWord || feedback.type === 'success') return;
    if (inputValue.length >= targetSuffix.length) return;

    const newVal = inputValue + key;
    setInputValue(newVal);

    // Auto-validate when full length reached
    if (newVal.length === targetSuffix.length) {
       validateInput(newVal);
    }
  };

  const handleDelete = () => {
    setInputValue(prev => prev.slice(0, -1));
  };

  if (!currentWord) return <div>Loading...</div>;

  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white shadow-sm z-10 shrink-0 h-16">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={24} />
         </button>
         <div className="flex flex-col items-center">
            <span className={`text-sm font-bold uppercase tracking-wide ${
              phase === 'TEST' ? 'text-amber-500' : 'text-slate-400'
            }`}>
              {phase === 'TRAIN' ? 'TRAIN' : 'TEST'} {prefix}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-indigo-600">{internalIndex + 1} / {activeList.length}</span>
              <span className="text-xs font-bold">
                <span className="text-emerald-500">✓ {correct}</span>
                {' '}
                <span className="text-rose-400">✗ {incorrect}</span>
              </span>
            </div>
         </div>
         <button
           onClick={() => setShowLetterSkip(true)}
           className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg flex items-center gap-1 font-bold text-sm hover:bg-indigo-100 active:scale-95 transition-all"
         >
           <span>SKIP</span>
           <FastForward size={16} fill="currentColor" />
         </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
         <div className="bg-white rounded-[1.5rem] p-3 shadow-xl w-full max-w-xs relative overflow-hidden border-2 border-slate-100 flex flex-col items-center justify-center max-h-full">
            {phase === 'TEST' && (
              <div className="absolute top-3 bg-amber-100 text-amber-600 font-black text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full">
                TEST MODE
              </div>
            )}

            <div className="text-center mb-4 mt-2 min-h-[3rem] flex items-center justify-center max-h-[35%] overflow-y-auto no-scrollbar">
               <p className="text-xl font-medium text-slate-700 leading-snug px-2">{currentWord.d}</p>
            </div>

            <div className="flex justify-center gap-1 mb-4 shrink-0">
               {prefix.length > 0 && (
                 <div className="h-16 px-4 bg-slate-800 rounded-xl flex items-center justify-center text-4xl font-black text-white select-none shadow-md">
                   {prefix}
                 </div>
               )}

               {targetSuffix.split('').map((_, i) => (
                  <div key={`i-${i}`} className={`w-12 h-16 border-b-4 rounded-xl flex items-center justify-center text-4xl font-black transition-colors ${
                     feedback.type === 'error' ? 'border-rose-400 text-rose-500 bg-rose-50' :
                     feedback.type === 'warning' ? 'border-amber-400 text-amber-500 bg-amber-50' :
                     feedback.type === 'success' ? 'border-emerald-400 text-emerald-500 bg-emerald-50' :
                     'border-indigo-200 text-slate-800'
                  }`}>
                    {inputValue[i] || ''}
                  </div>
               ))}
            </div>

            <div className={`text-center font-bold h-6 transition-all shrink-0 ${
                feedback.type === 'error' ? 'text-rose-500' :
                feedback.type === 'warning' ? 'text-amber-500' :
                feedback.type === 'success' ? 'text-emerald-500' : 'text-slate-300'
            }`}>
               {feedback.msg}
            </div>
         </div>
      </div>

      {/* Keyboard */}
      <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-7 gap-1">
          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(k => (
             <LetterButton key={k} k={k} highlightedKeys={highlightedKeys} onPress={handleKeyPress} />
          ))}
          {['H', 'I', 'J', 'K', 'L', 'M', 'N'].map(k => (
             <LetterButton key={k} k={k} highlightedKeys={highlightedKeys} onPress={handleKeyPress} />
          ))}
          {['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map(k => (
             <LetterButton key={k} k={k} highlightedKeys={highlightedKeys} onPress={handleKeyPress} />
          ))}
          {['V', 'W', 'X', 'Y', 'Z'].map(k => (
             <LetterButton key={k} k={k} highlightedKeys={highlightedKeys} onPress={handleKeyPress} />
          ))}

          <button
             onClick={handleDelete}
             className="col-span-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-black text-xs hover:bg-slate-200 active:scale-95 flex flex-col items-center justify-center transition-all aspect-auto"
             aria-label="Delete"
           >
             <Delete size={20} />
             <span className="text-[10px] mt-0.5">DEL</span>
           </button>
        </div>
      </div>

      {/* Skip Menu Overlay */}
      {showLetterSkip && (
        <div className="fixed inset-0 bg-slate-100 z-50 p-3 flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-black text-slate-800">Jump to Letter</h2>
                <button onClick={() => setShowLetterSkip(false)} className="p-1.5 bg-white rounded-full shadow-sm">
                  <ArrowLeft size={18}/>
                </button>
            </div>
            <div className="grid grid-cols-8 gap-1.5 overflow-y-auto pb-4">
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').map(L => (
                    <button
                      key={L}
                      onClick={() => { onSkipToLetter(L); setShowLetterSkip(false); }}
                      className="aspect-square bg-white rounded-lg shadow-sm border-2 border-slate-200 font-black text-sm text-slate-700 hover:border-indigo-600 active:scale-95 transition-all"
                    >
                      {L}
                    </button>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default TrainingView;
