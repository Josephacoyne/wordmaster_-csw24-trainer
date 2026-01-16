import React, { useState, useEffect } from 'react';
import { WordEntry, WordLength, Difficulty, ChallengeItem, ChallengeOrder, ChallengeSnapshot } from '../types';
import { X, Trophy, ArrowLeft, ArrowRight, Star, Gamepad2, PlayCircle, RotateCcw } from 'lucide-react';

interface ChallengeViewProps {
  difficulty: Difficulty;
  setDifficulty: (diff: Difficulty) => void;
  onIncorrectReal: (word: WordEntry, snapshot: ChallengeSnapshot) => void;
  fullDictionary: WordEntry[];
  fakes: Record<number, string[]>;
  onExit: () => void;
  topStreak: number;
  onUpdateHighScore: (score: number) => void;
  initialState?: ChallengeSnapshot | null;
  onStartNewLevel: (len: WordLength, diff: Difficulty) => void;
  savedProgress?: Record<string, ChallengeSnapshot>; // Key: "DIFFICULTY-LENGTH"
  autoStartLength?: WordLength | null;
  percentages: Record<number, number>;
}

const ChallengeView: React.FC<ChallengeViewProps> = ({ 
  difficulty,
  setDifficulty,
  onIncorrectReal, 
  fullDictionary = [], 
  fakes,
  onExit,
  topStreak,
  onUpdateHighScore,
  initialState,
  onStartNewLevel,
  savedProgress = {},
  autoStartLength,
  percentages
}) => {
  // Setup State
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetLength, setTargetLength] = useState<WordLength | null>(null);
  const [order, setOrder] = useState<ChallengeOrder>('ALPHA');

  // Game State
  const [deck, setDeck] = useState<ChallengeItem[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  // Letter Progression State
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [completedLetter, setCompletedLetter] = useState<string | null>(null);

  // Derived
  const currentItem = deck[deckIndex];

  // Hydrate from initial state if provided
  useEffect(() => {
    if (initialState) {
      setDeck(initialState.deck);
      setDeckIndex(initialState.index);
      setStreak(initialState.streak);
      setTargetLength(initialState.targetLength);
      setOrder(initialState.order || 'ALPHA');
      setIsPlaying(true);
      setResult(null);
      setIsComplete(false);
    }
  }, [initialState]);

  // Auto Start Effect
  useEffect(() => {
    if (autoStartLength) {
        handleStart(autoStartLength, true);
    }
  }, [autoStartLength]);

  const buildDeck = (len: WordLength): { items: ChallengeItem[], mode: ChallengeOrder } => {
    let mode: ChallengeOrder = 'ALPHA';
    
    let reals: WordEntry[] = [];
    let fakeWords: string[] = [];

    if (len === 'ALL') {
      mode = 'RANDOM';
      reals = fullDictionary.filter(w => w.w.length >= 2 && w.w.length <= 4);
      fakeWords = [...(fakes[2] || []), ...(fakes[3] || []), ...(fakes[4] || [])];
    } else {
      reals = fullDictionary.filter(w => w.w.length === len);
      fakeWords = fakes[len] || [];
    }
    
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
    
    return { items: combined, mode };
  };

  const handleStart = (len: WordLength, forceRestart: boolean = false) => {
    // Check for saved progress first
    const saveKey = len === 'ALL' ? 'ALL' : `${difficulty}-${len}`;
    const saved = savedProgress[saveKey];

    if (saved && !forceRestart) {
       // Resume
       setDeck(saved.deck);
       setDeckIndex(saved.index);
       setStreak(saved.streak);
       setTargetLength(saved.targetLength);
       setOrder(saved.order);
       setIsPlaying(true);
       setResult(null);
       setIsComplete(false);
    } else {
       // Start New
       const { items, mode } = buildDeck(len);
       setDeck(items);
       setDeckIndex(0);
       setTargetLength(len);
       setOrder(mode);
       setStreak(0);
       setIsPlaying(true);
       setIsComplete(false);
       setResult(null);
    }
  };

  const nextWord = () => {
    setResult(null);

    // Check Letter Boundary for 3L/4L Alpha
    if (order === 'ALPHA' && (targetLength === 3 || targetLength === 4) && deckIndex < deck.length - 1) {
        const currentLetter = deck[deckIndex].word[0];
        const nextLetter = deck[deckIndex + 1].word[0];
        
        if (currentLetter !== nextLetter) {
            setCompletedLetter(currentLetter);
            setShowLetterModal(true);
            return;
        }
    }

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
        const wordData = currentItem.data;
        
        // --- FAILURE PENALTY LOGIC ---
        setTimeout(() => {
           let nextIndex = deckIndex;
           let nextStreak = 0;

           if (order === 'ALPHA') {
              if (difficulty === 'MEDIUM') {
                 if (targetLength === 2) {
                     // 2L Medium -> Acts like Easy (Resume)
                 } else {
                     // 3L/4L Medium -> Reset to Start of Letter
                     const currentLetter = currentItem.word[0];
                     const startIndexOfLetter = deck.findIndex(item => item.word.startsWith(currentLetter));
                     if (startIndexOfLetter !== -1) {
                        nextIndex = startIndexOfLetter;
                     }
                 }
              } else if (difficulty === 'HARD') {
                 // Reset to Beginning
                 nextIndex = 0;
              }
              // EASY: Do nothing (Resume from current spot = deckIndex)
           } else {
              // RANDOM (Free For All)
              if (targetLength === 'ALL') {
                  // Resume (do nothing)
              } else {
                  if (difficulty === 'HARD') {
                     nextIndex = 0;
                  }
              }
           }

           // Create snapshot for resumption
           const snapshot: ChallengeSnapshot = {
               deck,
               index: nextIndex,
               streak: nextStreak,
               targetLength,
               order
           };

           onIncorrectReal(wordData, snapshot);
        }, 800);
      } else {
        setTimeout(() => {
           // Check if we need to apply penalty (Medium/Hard) for fake words too
           let shouldPenalize = false;
           let nextIndex = deckIndex;
           
           // Universal Hard Mode Rule: Always reset to 0
           if (difficulty === 'HARD') {
               nextIndex = 0;
               shouldPenalize = true;
           } 
           // Medium Mode Rule (3L/4L Alpha): Reset to start of letter
           else if (difficulty === 'MEDIUM' && order === 'ALPHA' && targetLength !== 2) {
                const currentLetter = currentItem.word[0];
                const startIndexOfLetter = deck.findIndex(item => item.word.startsWith(currentLetter));
                if (startIndexOfLetter !== -1) {
                   nextIndex = startIndexOfLetter;
                }
                shouldPenalize = true;
           }
           
           if (shouldPenalize) {
               // Create snapshot
               const snapshot: ChallengeSnapshot = {
                   deck,
                   index: nextIndex,
                   streak: 0,
                   targetLength,
                   order
               };
               
               // Mock WordEntry for Fake Word
               const fakeEntry: WordEntry = {
                   w: currentItem.word,
                   d: "This is not a valid CSW24 word.",
                   m: "Phony!"
               };
               
               onIncorrectReal(fakeEntry, snapshot);
           } else {
               setStreak(0);
               nextWord();
           }
        }, 800);
      }
    }
  };

  const handleCompletionAction = (targetLen: WordLength, targetDiff: Difficulty) => {
    onStartNewLevel(targetLen, targetDiff);
  };

  const handleLetterCompletionAction = (action: 'REINFORCE' | 'CONTINUE') => {
      setShowLetterModal(false);
      
      if (action === 'REINFORCE') {
          // Stay on current letter, increase difficulty
          let nextDiff: Difficulty = difficulty;
          if (difficulty === 'EASY') nextDiff = 'MEDIUM';
          else if (difficulty === 'MEDIUM') nextDiff = 'HARD';
          
          setDifficulty(nextDiff);
          
          if (completedLetter) {
            // Find start of current letter
            const start = deck.findIndex(i => i.word.startsWith(completedLetter));
            // Find end of current letter
            let end = start;
            while(end < deck.length && deck[end].word.startsWith(completedLetter)) {
                end++;
            }
            
            // Shuffle this segment
            const group = deck.slice(start, end);
            for (let i = group.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [group[i], group[j]] = [group[j], group[i]];
            }
            
            // Insert back into deck
            const newDeck = [...deck];
            newDeck.splice(start, group.length, ...group);
            setDeck(newDeck);
            
            // Reset index to start of this letter
            setDeckIndex(start);
            // Don't reset streak? Or maybe do? Usually reinforce implies new attempt.
            // Streak is global for challenge though. Let's keep it unless it feels wrong.
          }
      } else {
          // Continue to next letter, reset difficulty to EASY
          setDifficulty('EASY');
          setDeckIndex(prev => prev + 1);
      }
  };

  const hasSavedProgress = (len: WordLength) => {
      const saveKey = len === 'ALL' ? 'ALL' : `${difficulty}-${len}`;
      return !!savedProgress[saveKey];
  };

  if (!isPlaying) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4">
        {/* Header - Now shows standard title */}
        <div className="flex items-center justify-between mb-4">
           <button onClick={onExit} className="p-2 bg-white rounded-full shadow-sm text-slate-400">
             <ArrowLeft size={20} />
           </button>
           <h2 className="font-black text-lg text-slate-700">CHALLENGE SETUP</h2>
           <div className="w-10" /> 
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-center mb-6">
            <h3 className="text-3xl font-black text-indigo-600 mb-4">Choose your Arena</h3>
            
            {/* Large Difficulty Toggle (Replaces Trophy) */}
             <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1 mx-auto w-full max-w-xs mb-2">
              {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${
                        difficulty === d ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {d}
                  </button>
              ))}
           </div>
           
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Current Difficulty</p>
          </div>

          <div className="flex flex-col gap-3">
            {[2, 3, 4].map((len) => {
               const saved = hasSavedProgress(len as WordLength);
               const pct = percentages[len as number] || 0;
               return (
               <div key={len} className="flex gap-2">
                 <button
                   onClick={() => handleStart(len as WordLength, false)}
                   className={`flex-1 py-5 bg-white border-2 rounded-2xl shadow-sm font-black text-xl transition-all flex items-center justify-between px-6 group ${saved ? 'border-indigo-200 text-indigo-700' : 'border-slate-100 text-slate-700 hover:border-indigo-500 hover:text-indigo-600'}`}
                 >
                   <div className="flex items-center gap-3">
                       <span>{len} Letters</span>
                       {/* Show percentage if progress exists, otherwise just if saved */}
                       {saved && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full uppercase tracking-wider">{pct}%</span>}
                   </div>
                   <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      {saved ? <PlayCircle className="text-indigo-500" size={20} /> : <ArrowRight className="text-slate-400 group-hover:text-indigo-600" size={16} />}
                   </div>
                 </button>
                 
                 {saved && (
                    <button 
                        onClick={() => {
                            if (confirm("Are you sure you want to restart? Current progress will be lost.")) {
                                handleStart(len as WordLength, true);
                            }
                        }}
                        className="w-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                        <RotateCcw size={20} />
                    </button>
                 )}
               </div>
            )})}
            
            {/* Free For All Button */}
            <div className="mt-2">
                 {(() => {
                    const savedAll = hasSavedProgress('ALL');
                    return (
                        <div className="flex gap-2">
                            <button
                               onClick={() => handleStart('ALL', false)}
                               className={`flex-1 py-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl shadow-lg hover:shadow-xl font-black text-xl transition-all flex items-center justify-between px-6 group`}
                             >
                               <div className="flex items-center gap-3">
                                  <Gamepad2 size={24} className="text-yellow-400" />
                                  <span>Free For All</span>
                                  {savedAll && <span className="text-[10px] bg-white/20 text-white px-2 py-1 rounded-full uppercase tracking-wider">Resume</span>}
                               </div>
                               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                  {savedAll ? <PlayCircle className="text-white" size={20} /> : <ArrowRight className="text-white" size={16} />}
                               </div>
                             </button>
                             {savedAll && (
                                <button 
                                    onClick={() => {
                                        if (confirm("Are you sure you want to restart? Current progress will be lost.")) {
                                            handleStart('ALL', true);
                                        }
                                    }}
                                    className="w-20 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                >
                                    <RotateCcw size={20} />
                                </button>
                             )}
                        </div>
                    );
                 })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completion Modal
  if (isComplete) {
    let title = `${targetLength}L Challenge Complete!`;
    let sub = `You've mastered the ${difficulty} deck.`;
    
    // Custom Titles/Messages
    if (targetLength === 2 && difficulty === 'EASY') {
       title = "2L Challenge Mode (Easy) is completed!";
    } else if (targetLength === 4 && difficulty === 'HARD') {
       title = "Brilliant! You're a 4L Champion!";
       sub = "You have conquered the ultimate challenge.";
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
               {targetLength === 4 && difficulty === 'HARD' ? (
                   <Star size={40} fill="currentColor" />
               ) : (
                   <Trophy size={40} fill="currentColor" />
               )}
            </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight">
              {title}
           </h2>
           <p className="text-slate-500 font-medium mb-8">
              {sub}
           </p>
           
           <div className="flex flex-col gap-3">
              {/* PROGRESSION LOGIC */}
              
              {/* 2L EASY -> 3L EASY or 2L HARD */}
              {targetLength === 2 && difficulty === 'EASY' && (
                 <>
                    <button onClick={() => handleCompletionAction(2, 'HARD')} className="py-4 rounded-xl bg-slate-800 text-white font-bold text-lg hover:bg-slate-900 active:scale-95 transition-all shadow-lg">
                       Reenforce with Hard
                    </button>
                    <button onClick={() => handleCompletionAction(3, 'EASY')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                       Continue with 3L (Easy)
                    </button>
                 </>
              )}

              {/* 3L EASY -> 3L MEDIUM or 4L EASY */}
              {targetLength === 3 && difficulty === 'EASY' && (
                 <>
                    <button onClick={() => handleCompletionAction(3, 'MEDIUM')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                       Reenforce with Medium
                    </button>
                    <button onClick={() => handleCompletionAction(4, 'EASY')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                       Continue to 4L (Easy)
                    </button>
                 </>
              )}

              {/* 3L MEDIUM -> 3L HARD or 4L EASY */}
              {targetLength === 3 && difficulty === 'MEDIUM' && (
                 <>
                    <button onClick={() => handleCompletionAction(3, 'HARD')} className="py-4 rounded-xl bg-rose-600 text-white font-bold text-lg hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-200">
                       Challenge 3L Hard
                    </button>
                    <button onClick={() => handleCompletionAction(4, 'EASY')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                       Continue to 4L (Easy)
                    </button>
                 </>
              )}

              {/* 4L EASY -> 4L MEDIUM */}
              {targetLength === 4 && difficulty === 'EASY' && (
                 <button onClick={() => handleCompletionAction(4, 'MEDIUM')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                    Reenforce with Medium
                 </button>
              )}

              {/* 4L MEDIUM -> 4L HARD */}
              {targetLength === 4 && difficulty === 'MEDIUM' && (
                 <button onClick={() => handleCompletionAction(4, 'HARD')} className="py-4 rounded-xl bg-rose-600 text-white font-bold text-lg hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-200">
                    Face 4L Hard
                 </button>
              )}
              
              {/* DEFAULT / FALLBACK / CHAMPION EXIT */}
              {((targetLength === 2 && difficulty !== 'EASY') || 
                (targetLength === 3 && difficulty === 'HARD') ||
                (targetLength === 4 && difficulty === 'HARD') ||
                targetLength === 'ALL') && (
                 <button onClick={onExit} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                    Return Home
                 </button>
              )}
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

      </div>

      {/* Letter Completion Modal */}
      {showLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trophy size={32} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">
                 '{completedLetter}' Complete!
              </h2>
              <p className="text-slate-500 font-medium mb-6">
                 Excellent work. How would you like to proceed?
              </p>
              
              <div className="flex flex-col gap-3">
                 {difficulty === 'EASY' && (
                    <>
                       <button onClick={() => handleLetterCompletionAction('REINFORCE')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                          Reenforce with Medium
                       </button>
                       <button onClick={() => handleLetterCompletionAction('CONTINUE')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                          Continue with Next Letter (Easy)
                       </button>
                    </>
                 )}

                 {difficulty === 'MEDIUM' && (
                    <>
                       <button onClick={() => handleLetterCompletionAction('REINFORCE')} className="py-4 rounded-xl bg-rose-600 text-white font-bold text-lg hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-200">
                          Reenforce with Hard
                       </button>
                       <button onClick={() => handleLetterCompletionAction('CONTINUE')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                          Continue with Next Letter (Easy)
                       </button>
                    </>
                 )}
                 
                 {difficulty === 'HARD' && (
                    <button onClick={() => handleLetterCompletionAction('CONTINUE')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                       Continue with Next Letter (Easy)
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Main Card */}
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