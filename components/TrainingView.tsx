import React, { useState, useEffect, useMemo } from 'react';
import { WordEntry, Difficulty } from '../types';
import { ArrowLeft, Grid, Delete } from 'lucide-react';

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


  const handleKeyPress = (key: string) => {
    if (!currentWord || feedback.type === 'success') return;

    const newVal = inputValue + key;
    setInputValue(newVal);

    if (newVal.length === targetSuffix.length) {
      const fullAttempt = prefix + newVal;
      
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
      <div className="flex items-center justify-between p-3 bg-white shadow-sm z-10 shrink-0 h-14">
         <button onClick={onExit} className="p-2 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={20} />
         </button>
         <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-400">TRAINING {currentLetter}</span>
            <span className="text-[10px] font-black text-indigo-600">{internalIndex + 1} / {pool.length}</span>
         </div>
         <button onClick={() => setShowLetterSkip(true)} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg">
           <Grid size={20} />
         </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
         <div className="bg-white rounded-[1.5rem] p-3 shadow-xl w-full max-w-xs relative overflow-hidden border-2 border-slate-100 flex flex-col items-center justify-center max-h-full">
            <div className="text-center mb-4 mt-2 min-h-[3rem] flex items-center justify-center max-h-[30%] overflow-y-auto no-scrollbar">
               <p className="text-lg font-medium text-slate-700 leading-snug px-2">{currentWord.d}</p>
            </div>

            <div className="flex justify-center gap-1 mb-4 shrink-0">
               {prefix.split('').map((char, i) => (
                  <div key={`p-${i}`} className="w-10 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl font-black text-slate-400 select-none">
                    {char}
                  </div>
               ))}
               {targetSuffix.split('').map((_, i) => (
                  <div key={`i-${i}`} className={`w-10 h-12 border-b-4 flex items-center justify-center text-2xl font-black transition-colors ${
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
      <div className="bg-white p-2 pb-4 border-t border-slate-100 shrink-0 relative">
        {/* DEL Button positioned absolute top-right of keyboard area */}
        <button 
          onClick={handleDelete}
          className="absolute top-[-10px] right-2 bg-white border border-slate-200 shadow-sm rounded-full p-2 text-slate-500 hover:text-rose-500 active:bg-slate-50 z-20"
          aria-label="Delete"
        >
          <Delete size={18} />
        </button>

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
                    className={`aspect-[3/4] rounded font-bold text-base transition-all flex-1 max-w-[40px] ${
                       isPossible 
                         ? 'bg-yellow-100 border border-yellow-300 text-yellow-800 shadow-sm hover:bg-yellow-200' 
                         : 'bg-slate-50 border border-slate-200 text-slate-600 active:bg-slate-200'
                    }`}
                  >
                    {k}
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