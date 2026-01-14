import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WordEntry, Difficulty } from '../types';
import { ArrowLeft, Grid, Delete, FastForward } from 'lucide-react';

interface TrainingViewProps {
  pool: WordEntry[];
  initialIndex: number;
  currentLetter: string;
  difficulty: Difficulty;
  fullDictionary: WordEntry[];
  onSuccess: (word: WordEntry) => void;
  onFail: (word: WordEntry) => void;
  onComplete: (failures: WordEntry[]) => void;
  onSkipToLetter: (letter: string) => void;
  onExit: () => void;
}

const TrainingView: React.FC<TrainingViewProps> = ({ 
  pool, 
  initialIndex,
  currentLetter,
  difficulty,
  fullDictionary,
  onSuccess,
  onFail,
  onComplete,
  onSkipToLetter,
  onExit
}) => {
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'neutral' | 'success' | 'error' | 'warning' }>({ msg: 'Type the missing letters', type: 'neutral' });
  const [showLetterSkip, setShowLetterSkip] = useState(false);
  
  // Use internal index to visually handle updates, but trust props for initial load
  const [internalIndex, setInternalIndex] = useState(initialIndex);

  // Sync when initialIndex changes (e.g. from restore or Hard reset)
  useEffect(() => {
    setInternalIndex(initialIndex);
    setInputValue('');
    setFeedback({ msg: 'Type the missing letters', type: 'neutral' });
  }, [initialIndex]);

  const currentWord = pool[internalIndex];

  // Masking
  const lettersToGuess = difficulty === 'HARD' ? 2 : 1;
  const prefixLength = currentWord ? Math.max(0, currentWord.w.length - lettersToGuess) : 0;
  const prefix = currentWord ? currentWord.w.substring(0, prefixLength) : '';
  const targetSuffix = currentWord ? currentWord.w.substring(prefixLength) : '';

  // Validation Logic
  const validAlternatives = useMemo(() => {
    if (!currentWord) return new Set<string>();
    return new Set(
      fullDictionary
        .filter(w => w.w.length === currentWord.w.length && w.w.startsWith(prefix))
        .map(w => w.w)
    );
  }, [currentWord, fullDictionary, prefix]);

  // Highlights (Easy Mode)
  const highlightedKeys = useMemo(() => {
    if (difficulty !== 'EASY' || !currentWord) return new Set<string>();
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
  }, [difficulty, currentWord, inputValue, validAlternatives, prefixLength]);


  const validateInput = (fullInput: string) => {
      const fullAttempt = prefix + fullInput;
      
      if (fullAttempt === currentWord.w) {
        setFeedback({ msg: 'Correct!', type: 'success' });
        setTimeout(() => {
           onSuccess(currentWord);
           // If we didn't just win the whole deck, move visually
           if (internalIndex < pool.length - 1) {
             setInternalIndex(i => i + 1);
             setInputValue('');
             setFeedback({ msg: 'Type the missing letters', type: 'neutral' });
           }
        }, 600);
      } else {
        // INCORRECT
        if (validAlternatives.has(fullAttempt)) {
           // Valid word but wrong def
           setFeedback({ msg: 'Valid word, but wrong definition!', type: 'warning' });
           // In Easy/Medium, allow retry. In Hard, Strict fail.
           if (difficulty === 'HARD') {
             strictFail();
           } else {
             setTimeout(() => setInputValue(''), 1000);
           }
        } else {
           // Invalid
           setFeedback({ msg: difficulty === 'HARD' ? 'Perfect Score Needed! Resetting...' : 'Incorrect', type: 'error' });
           if (difficulty === 'HARD') {
             strictFail();
           } else {
             onFail(currentWord);
             setTimeout(() => {
               setInputValue('');
               setFeedback({ msg: 'Try again', type: 'neutral' });
             }, 800);
           }
        }
      }
  };

  const handleKeyPress = (key: string) => {
    if (!currentWord || feedback.type === 'success') return;
    
    // Check if we are already full length
    if (inputValue.length >= targetSuffix.length) return;

    const newVal = inputValue + key;
    setInputValue(newVal);

    // Auto-validate ONLY if NOT Hard Mode
    if (difficulty !== 'HARD' && newVal.length === targetSuffix.length) {
       validateInput(newVal);
    }
  };

  const handleEnter = () => {
    if (inputValue.length === targetSuffix.length) {
       validateInput(inputValue);
    } else {
       // Optional: Shake or warn if not enough letters?
    }
  };

  const strictFail = () => {
    // Show feedback briefly then trigger reset
    setTimeout(() => {
      onFail(currentWord); 
      // Force local reset immediately to allow UI to update even if parent prop lag
      setInternalIndex(0);
      setInputValue('');
      setFeedback({ msg: 'Type the missing letters', type: 'neutral' });
    }, 1500);
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
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">TRAINING {currentLetter}</span>
            <span className="text-lg font-black text-indigo-600">{internalIndex + 1} / {pool.length}</span>
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
            <div className="text-center mb-4 mt-2 min-h-[3rem] flex items-center justify-center max-h-[35%] overflow-y-auto no-scrollbar">
               <p className="text-xl font-medium text-slate-700 leading-snug px-2">{currentWord.d}</p>
            </div>

            <div className="flex justify-center gap-1 mb-4 shrink-0">
               {/* Prefix as Single Dark Block (Master Hook Style) */}
               {prefix.length > 0 && (
                 <div className="h-16 px-4 bg-slate-800 rounded-xl flex items-center justify-center text-4xl font-black text-white select-none shadow-md">
                   {prefix}
                 </div>
               )}
               
               {/* Input as Bordered Blocks (Hook Style) */}
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

      {/* Keyboard with Easy Mode Highlights */}
      <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0">
        {/* DEL Button Row - Explicit spacing between word display and keyboard */}
        <div className="flex justify-between px-2 mb-2">
           {/* DELETE BUTTON (Left Aligned or Right?) - User asked for space above. Keeping right aligned as before unless we want split */}
           <div className="flex-1"></div> {/* Spacer to push buttons to right, or we can put ENTER on Left */}
           
           <div className="flex gap-2">
               <button 
                 onClick={handleDelete}
                 className="bg-slate-100 border border-slate-200 shadow-sm rounded-full px-4 py-2 text-slate-500 font-bold text-xs hover:bg-slate-200 active:scale-95 flex items-center gap-1"
                 aria-label="Delete"
               >
                 <Delete size={16} />
                 <span>DEL</span>
               </button>

               {difficulty === 'HARD' && (
                   <button 
                     onClick={handleEnter}
                     disabled={inputValue.length !== targetSuffix.length}
                     className={`border shadow-sm rounded-full px-4 py-2 font-bold text-xs flex items-center gap-1 transition-all ${
                        inputValue.length === targetSuffix.length 
                          ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200' 
                          : 'bg-slate-50 border-slate-200 text-slate-300'
                     }`}
                     aria-label="Enter"
                   >
                     <span>ENTER</span>
                   </button>
               )}
           </div>
        </div>

        <div className="max-w-md mx-auto flex flex-col gap-1">
          {[
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
            ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
            ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
          ].map((row, i) => (
            <div key={i} className="flex justify-center gap-0.5">
              {row.map(k => {
                const isPossible = highlightedKeys.has(k);
                return (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(k)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`aspect-[3/4] rounded font-bold text-base transition-all flex-1 max-w-[40px] select-none touch-manipulation relative overflow-hidden ${
                       isPossible 
                         ? 'bg-yellow-100 border border-yellow-300 text-yellow-800 shadow-sm hover:bg-yellow-200' 
                         : 'bg-slate-50 border border-slate-200 text-slate-600 active:bg-slate-200'
                    }`}
                  >
                    <span className="relative z-10">{k}</span>
                  </button>
                );
              })}
            </div>
          ))}
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