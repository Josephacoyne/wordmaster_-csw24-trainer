import React, { useState, useEffect } from 'react';
import { WordEntry, WordLength, ChallengeItem } from '../types';
import { X, Trophy, ArrowLeft, ArrowRight, Gamepad2, AlertTriangle } from 'lucide-react';

interface ChallengeViewProps {
  onIncorrectReal: (word: WordEntry) => void;
  fullDictionary: WordEntry[];
  fakes: Record<number, string[]>;
  onExit: () => void;
  autoStartLength?: WordLength | null;
  onDeckComplete?: (length: WordLength, totalErrors: number) => void;
}

const ChallengeView: React.FC<ChallengeViewProps> = ({
  onIncorrectReal,
  fullDictionary = [],
  fakes,
  onExit,
  autoStartLength,
  onDeckComplete
}) => {
  // Setup State
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetLength, setTargetLength] = useState<WordLength | null>(null);

  // Game State
  const [deck, setDeck] = useState<ChallengeItem[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [result, setResult] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [flashDefinition, setFlashDefinition] = useState<string | null>(null);

  // Score tallies
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);

  // Redemption Mode
  const [missedWords, setMissedWords] = useState<ChallengeItem[]>([]);
  const [isRedemption, setIsRedemption] = useState(false);
  const [savedMainIndex, setSavedMainIndex] = useState(0);
  const [savedMainDeck, setSavedMainDeck] = useState<ChallengeItem[]>([]);

  // Redemption notice/results screens
  const [showRedemptionNotice, setShowRedemptionNotice] = useState(false);
  const [pendingRedemptionWords, setPendingRedemptionWords] = useState<ChallengeItem[]>([]);
  const [showRedemptionResults, setShowRedemptionResults] = useState(false);
  const [redemptionCorrect, setRedemptionCorrect] = useState(0);
  const [redemptionTotal, setRedemptionTotal] = useState(0);

  // Derived
  const currentItem = deck[deckIndex];

  // Auto Start Effect
  useEffect(() => {
    if (autoStartLength) {
        handleStart(autoStartLength, true);
    }
  }, [autoStartLength]);

  const buildDeck = (len: WordLength): ChallengeItem[] => {
    let reals: WordEntry[] = [];
    let fakeWords: string[] = [];

    if (len === 'ALL') {
      reals = fullDictionary.filter(w => w.w.length >= 2 && w.w.length <= 4);
      fakeWords = [...(fakes[2] || []), ...(fakes[3] || []), ...(fakes[4] || [])];
    } else {
      reals = fullDictionary.filter(w => w.w.length === len);
      fakeWords = fakes[len] || [];
    }

    const realItems: ChallengeItem[] = reals.map(r => ({ word: r.w, isReal: true, data: r }));
    const fakeItems: ChallengeItem[] = fakeWords.map(f => ({ word: f, isReal: false }));

    const combined = [...realItems, ...fakeItems];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    return combined;
  };

  const handleStart = (len: WordLength, forceRestart: boolean = false) => {
    const items = buildDeck(len);
    setDeck(items);
    setDeckIndex(0);
    setTargetLength(len);
    setCorrect(0);
    setIncorrect(0);
    setMissedWords([]);
    setIsRedemption(false);
    setIsPlaying(true);
    setIsComplete(false);
    setResult(null);
    setShowRedemptionNotice(false);
    setShowRedemptionResults(false);
    setRedemptionCorrect(0);
  };

  const nextWord = () => {
    setResult(null);
    setFlashDefinition(null);

    if (deckIndex >= deck.length - 1) {
      if (isRedemption) {
        // Redemption complete — show results
        setRedemptionTotal(deck.length);
        setShowRedemptionResults(true);
      } else {
        if (targetLength) {
          onDeckComplete?.(targetLength, incorrect);
        }
        setIsComplete(true);
      }
    } else {
      setDeckIndex(prev => prev + 1);
    }
  };

  const resumeFromRedemption = () => {
    setShowRedemptionResults(false);
    setDeck(savedMainDeck);
    setDeckIndex(savedMainIndex);
    setMissedWords([]);
    setIsRedemption(false);
    setRedemptionCorrect(0);
    setResult(null);
  };

  const enterRedemption = (currentMissed: ChallengeItem[]) => {
    setSavedMainIndex(deckIndex + 1);
    setSavedMainDeck(deck);

    const missedItems = [...currentMissed];
    const numFakes = missedItems.length;

    let fakePool: string[] = [];
    if (targetLength === 'ALL') {
      fakePool = [...(fakes[2] || []), ...(fakes[3] || []), ...(fakes[4] || [])];
    } else if (targetLength) {
      fakePool = fakes[targetLength] || [];
    }

    const shuffledFakes = [...fakePool].sort(() => 0.5 - Math.random()).slice(0, numFakes);
    const fakeItems: ChallengeItem[] = shuffledFakes.map(f => ({ word: f, isReal: false }));

    const redemptionDeck = [...missedItems, ...fakeItems];
    for (let i = redemptionDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [redemptionDeck[i], redemptionDeck[j]] = [redemptionDeck[j], redemptionDeck[i]];
    }

    setDeck(redemptionDeck);
    setDeckIndex(0);
    setIsRedemption(true);
    setRedemptionCorrect(0);
    setResult(null);
    setFlashDefinition(null);
    setShowRedemptionNotice(false);
  };

  const handleGuess = (userGuessedReal: boolean) => {
    if (!currentItem) return;

    const isCorrect = userGuessedReal === currentItem.isReal;

    if (isCorrect) {
      setResult('CORRECT');
      setCorrect(prev => prev + 1);
      if (isRedemption) {
        setRedemptionCorrect(prev => prev + 1);
      }

      if (currentItem.isReal && currentItem.data?.d) {
        setFlashDefinition(currentItem.data.d);
        setTimeout(nextWord, 1500);
      } else {
        setTimeout(nextWord, 600);
      }
    } else {
      setResult('WRONG');
      setIncorrect(prev => prev + 1);

      if (currentItem.isReal && currentItem.data) {
        const newMissed = [...missedWords, currentItem];

        if (!isRedemption) {
          setMissedWords(newMissed);
        }

        setTimeout(() => {
          onIncorrectReal(currentItem.data!);

          if (!isRedemption && newMissed.length >= 10) {
            // Show redemption notice instead of immediately entering
            setPendingRedemptionWords(newMissed);
            setShowRedemptionNotice(true);
          } else {
            nextWord();
          }
        }, 800);
      } else {
        setTimeout(nextWord, 800);
      }
    }
  };

  // --- SETUP SCREEN ---
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
          <div className="text-center mb-6">
            <h3 className="text-3xl font-black text-indigo-600 mb-2">Choose your Arena</h3>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Pick a word length to begin</p>
          </div>

          <div className="flex flex-col gap-3">
            {[2, 3, 4].map((len) => (
               <button
                 key={len}
                 onClick={() => handleStart(len as WordLength, true)}
                 className="py-5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm font-black text-xl transition-all flex items-center justify-between px-6 group hover:border-indigo-500 hover:text-indigo-600 text-slate-700"
               >
                 <span>{len} Letters</span>
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                    <ArrowRight className="text-slate-400 group-hover:text-indigo-600" size={16} />
                 </div>
               </button>
            ))}

            <div className="mt-2">
                <button
                   onClick={() => handleStart('ALL', true)}
                   className="w-full py-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl shadow-lg hover:shadow-xl font-black text-xl transition-all flex items-center justify-between px-6 group"
                 >
                   <div className="flex items-center gap-3">
                      <Gamepad2 size={24} className="text-yellow-400" />
                      <span>Free For All</span>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <ArrowRight className="text-white" size={16} />
                   </div>
                 </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- REDEMPTION NOTICE ---
  if (showRedemptionNotice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <AlertTriangle size={40} />
            </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Retest Bogey Words</h2>
           <p className="text-slate-500 font-medium mb-6">
              You've missed {pendingRedemptionWords.length} real words. Time to review them before continuing.
           </p>
           <button
             onClick={() => enterRedemption(pendingRedemptionWords)}
             className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-lg hover:bg-amber-600 active:scale-95 transition-all shadow-lg"
           >
             Next
           </button>
         </div>
      </div>
    );
  }

  // --- REDEMPTION RESULTS ---
  if (showRedemptionResults) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <Trophy size={40} fill="currentColor" />
            </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Redemption Complete!</h2>
           <p className="text-slate-500 font-medium mb-6">
              You got <span className="text-emerald-500 font-black">{redemptionCorrect}</span> out of <span className="font-black">{redemptionTotal}</span> correct.
           </p>
           <div className="flex flex-col gap-3">
             <button
               onClick={resumeFromRedemption}
               className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg"
             >
               Resume Challenge
             </button>
             <button
               onClick={onExit}
               className="w-full py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all"
             >
               Exit
             </button>
           </div>
         </div>
      </div>
    );
  }

  // --- COMPLETION MODAL ---
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <Trophy size={40} fill="currentColor" />
            </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight">
              {targetLength === 'ALL' ? 'Free For All' : `${targetLength}L`} Challenge Complete!
           </h2>
           <p className="text-slate-500 font-medium mb-4">
              Final Score: <span className="text-emerald-500 font-black">✓ {correct}</span> / <span className="text-rose-400 font-black">✗ {incorrect}</span>
           </p>

           <div className="flex flex-col gap-3">
              {targetLength !== 'ALL' && targetLength !== 4 && (
                <button
                  onClick={() => handleStart(((targetLength as number) + 1) as WordLength, true)}
                  className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
                >
                  Continue to {(targetLength as number) + 1}L
                </button>
              )}

              <button onClick={onExit} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                 Return Home
              </button>
            </div>
         </div>
      </div>
    );
  }

  // --- GAME PLAY ---
  return (
    <div className="fixed inset-0 flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 z-10 shrink-0">
        <button onClick={onExit} className="p-2 bg-white/50 backdrop-blur rounded-full text-slate-500 hover:bg-white transition-all">
          <X size={20} />
        </button>
        <div className="flex flex-col items-center">
          <span className={`text-[9px] font-black uppercase tracking-widest ${isRedemption ? 'text-amber-500' : 'text-slate-400'}`}>
            {isRedemption ? 'Redemption' : 'Challenge'}
          </span>
          <div className="flex items-baseline gap-2">
             <span className="text-sm font-bold">
               <span className="text-emerald-500">✓ {correct}</span>
               {' '}
               <span className="text-rose-400">✗ {incorrect}</span>
             </span>
          </div>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-6 shrink-0 mb-2">
          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isRedemption ? 'bg-amber-500' : 'bg-indigo-500'}`}
                style={{ width: `${((deckIndex) / deck.length) * 100}%` }}
              />
          </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-0">
        <div className={`w-full aspect-[4/3] max-w-xs bg-white rounded-[2rem] shadow-2xl flex items-center justify-center border-4 transition-all duration-300 max-h-full ${
           result === 'CORRECT' ? 'border-emerald-400 scale-105' :
           result === 'WRONG' ? 'border-rose-400 rotate-1' : 'border-white'
        }`}>
           <span className="text-5xl font-black text-slate-800 tracking-wider text-center break-words px-4">
             {currentItem?.word}
           </span>
        </div>

        <div className="flex flex-col items-center justify-center mt-4 shrink-0 min-h-[4rem]">
           {result === 'CORRECT' && (
             <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-bottom-2">
               <span className="text-emerald-500 font-black text-lg tracking-widest uppercase">Correct!</span>
               {flashDefinition && (
                 <p className="text-slate-600 text-xl font-medium text-center px-4 max-w-md leading-snug">
                   {flashDefinition}
                 </p>
               )}
             </div>
           )}
           {result === 'WRONG' && <span className="text-rose-500 font-black text-lg tracking-widest uppercase animate-in fade-in slide-in-from-bottom-2">Wrong!</span>}
        </div>
      </div>

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
