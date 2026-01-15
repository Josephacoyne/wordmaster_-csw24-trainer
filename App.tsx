import React, { useState, useEffect, useMemo } from 'react';
import { generateHookData } from './utils/hookLogic';
import HookView from './components/HookView';
import TrainingView from './components/TrainingView';
import ChallengeView from './components/ChallengeView';
import BogeyPage from './components/BogeyPage';
import { 
  AppMode, 
  WordEntry, 
  WordLength, 
  Difficulty, 
  HookData 
} from './types';
import { 
  CSW_DICTIONARY, 
  FAKE_2_LETTERS, 
  FAKE_3_LETTERS, 
  FAKE_4_LETTERS 
} from './data';
import { Trophy, Zap } from 'lucide-react';

// --- TYPE DEFINITIONS FOR SAVED STATE ---
type MasteryState = Record<Difficulty, Set<string>>;
type ProgressMap = Record<string, number>; // Key: "DIFFICULTY-LENGTH-LETTER", Value: Index

const App: React.FC = () => {
  // --- STATE ---
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [selectedLength, setSelectedLength] = useState<WordLength>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');

  // Bogey/Error State
  const [bogeyWord, setBogeyWord] = useState<WordEntry | null>(null);
  const [bogeySource, setBogeySource] = useState<AppMode>(AppMode.TRAINING);

  // Training State
  const [currentLetter, setCurrentLetter] = useState<string>('A');
  const [activeDeck, setActiveDeck] = useState<WordEntry[]>([]);
  const [deckProgress, setDeckProgress] = useState(0);
  
  // Persistence for Training
  const [savedTrainingProgress, setSavedTrainingProgress] = useState<ProgressMap>({});
  
  // New State: Completion Modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Hook State
  const [hookDeck, setHookDeck] = useState<HookData[]>([]);
  const [activeHookIndex, setActiveHookIndex] = useState(0);

  // Stats
  const [challengeHighScore, setChallengeHighScore] = useState(0);
  const [masteredWords, setMasteredWords] = useState<MasteryState>({
    EASY: new Set(),
    MEDIUM: new Set(),
    HARD: new Set()
  });
  
  const [hookMastery, setHookMastery] = useState<MasteryState>({
    EASY: new Set(),
    MEDIUM: new Set(),
    HARD: new Set()
  });

  // --- INITIAL LOAD & SAVE ---
  useEffect(() => {
    // 1. Load Mastery
    const loadSet = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
          EASY: new Set(parsed.EASY),
          MEDIUM: new Set(parsed.MEDIUM),
          HARD: new Set(parsed.HARD),
        } as MasteryState;
      } catch (e) { console.error(e); return null; }
    };

    const mWords = loadSet('endcap_mastery_words');
    if (mWords) setMasteredWords(mWords);

    const mHooks = loadSet('endcap_mastery_hooks');
    if (mHooks) setHookMastery(mHooks);

    // 2. Load High Score
    const savedScore = localStorage.getItem('endcap_highscore');
    if (savedScore) setChallengeHighScore(parseInt(savedScore, 10));
    
    // 3. Load Training Progress
    const savedProgress = localStorage.getItem('endcap_training_progress');
    if (savedProgress) {
        try {
            setSavedTrainingProgress(JSON.parse(savedProgress));
        } catch (e) { console.error("Failed to load progress", e); }
    }
  }, []);

  // --- PERSISTENCE: SAVE EFFECTS ---
  useEffect(() => {
    const data = {
      EASY: Array.from(masteredWords.EASY),
      MEDIUM: Array.from(masteredWords.MEDIUM),
      HARD: Array.from(masteredWords.HARD)
    };
    localStorage.setItem('endcap_mastery_words', JSON.stringify(data));
  }, [masteredWords]);

  useEffect(() => {
    const data = {
      EASY: Array.from(hookMastery.EASY),
      MEDIUM: Array.from(hookMastery.MEDIUM),
      HARD: Array.from(hookMastery.HARD)
    };
    localStorage.setItem('endcap_mastery_hooks', JSON.stringify(data));
  }, [hookMastery]);

  useEffect(() => {
    localStorage.setItem('endcap_highscore', challengeHighScore.toString());
  }, [challengeHighScore]);

  useEffect(() => {
    localStorage.setItem('endcap_training_progress', JSON.stringify(savedTrainingProgress));
  }, [savedTrainingProgress]);

  // --- MODE SWITCHING EFFECT ---
  // When difficulty changes while in Training, update the position immediately
  useEffect(() => {
    if (mode === AppMode.TRAINING) {
        const key = `${difficulty}-${selectedLength}-${currentLetter}`;
        const savedIndex = savedTrainingProgress[key] || 0;
        setDeckProgress(savedIndex);
    }
  }, [difficulty, mode, selectedLength, currentLetter, savedTrainingProgress]);


  // --- OPTIMIZATION: MEMOIZED DATA ---
  // 1. Split dictionary once (Pre-computation)
  const dictionaryByLength = useMemo(() => ({
    2: CSW_DICTIONARY.filter(w => w.w.length === 2),
    3: CSW_DICTIONARY.filter(w => w.w.length === 3),
    4: CSW_DICTIONARY.filter(w => w.w.length === 4),
  }), []); // Empty deps = runs once on mount

  // 2. Count totals once
  const totalCounts = useMemo(() => ({
    2: dictionaryByLength[2].length,
    3: dictionaryByLength[3].length,
    4: dictionaryByLength[4].length
  }), [dictionaryByLength]);

  // 3. Pre-calculate Hook Data
  // This is expensive (iterates whole dictionary), so we strictly memoize it.
  const allHookData = useMemo(() => {
    return generateHookData(CSW_DICTIONARY);
  }, []); // Runs once on mount

  // --- STATS HELPERS ---
  const getPercentage = (len: WordLength) => {
    const total = totalCounts[len];
    if (total === 0) return 0;
    let count = 0;
    masteredWords[difficulty].forEach(w => {
      if (w.length === len) count++;
    });
    return Math.round((count / total) * 100);
  };

  const getHookPercentage = () => {
    const total = totalCounts[2]; 
    if (total === 0) return 0;
    const count = hookMastery[difficulty].size;
    return Math.round((count / total) * 100);
  };

  // --- ACTIONS: TRAINING ---

  const handleStartTraining = (len: WordLength, startChar: string = 'A') => {
    setSelectedLength(len);
    setCurrentLetter(startChar);
    
    // 1. Generate Deck FIRST
    let batch: WordEntry[];
    if (len === 2) {
      batch = dictionaryByLength[2];
    } else {
      batch = dictionaryByLength[len].filter(w => w.w.startsWith(startChar));
    }

    if (batch.length === 0) {
      alert(`No ${len}-letter words starting with ${startChar}`);
      return;
    }

    // 2. Determine Start Index
    const key = `${difficulty}-${len}-${startChar}`;
    let savedIndex = savedTrainingProgress[key] || 0;
    
    // FIX: If savedIndex is invalid (completed or out of bounds), reset to 0
    // This allows replaying a completed deck ("Loading..." fix)
    if (savedIndex >= batch.length) {
       savedIndex = 0;
       // Update persistence immediately to keep state consistent
       setSavedTrainingProgress(prev => ({ ...prev, [key]: 0 }));
    }

    // 3. Set State
    setDeckProgress(savedIndex);
    setActiveDeck(batch);
    setMode(AppMode.TRAINING);
  };

  const handleTrainingSuccess = (word: WordEntry) => {
    // 1. Save Position
    const key = `${difficulty}-${selectedLength}-${currentLetter}`;
    const nextIndex = deckProgress + 1;
    
    setSavedTrainingProgress(prev => ({ ...prev, [key]: nextIndex }));
    
    // 2. Incremental Mastery
    setMasteredWords(prev => {
        const newSet = new Set(prev[difficulty]);
        newSet.add(word.w);
        return { ...prev, [difficulty]: newSet };
    });

    if (nextIndex < activeDeck.length) {
      setDeckProgress(nextIndex);
    } else {
      handleTrainingDeckComplete();
    }
  };

  const handleTrainingFail = (word: WordEntry) => {
    if (difficulty === 'HARD') {
      // STRICT MODE: Reset
      const key = `${difficulty}-${selectedLength}-${currentLetter}`;
      setSavedTrainingProgress(prev => ({ ...prev, [key]: 0 }));
      setDeckProgress(0);
      
      // Remove progress for this specific letter
      setMasteredWords(prev => {
        const newSet = new Set(prev[difficulty]);
        activeDeck.forEach(w => newSet.delete(w.w));
        return { ...prev, [difficulty]: newSet };
      });
    }
  };

  const handleTrainingDeckComplete = () => {
    // Show modal instead of auto-advancing
    setShowCompletionModal(true);
  };

  const handleCompletionAction = (action: 'REINFORCE' | 'CONTINUE') => {
      setShowCompletionModal(false);
      
      const nextCharCode = currentLetter.charCodeAt(0) + 1;
      const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;

      if (action === 'REINFORCE') {
          // Increase difficulty, RESTART SAME DECK
          let nextDiff: Difficulty = difficulty;
          if (difficulty === 'EASY') nextDiff = 'MEDIUM';
          else if (difficulty === 'MEDIUM') nextDiff = 'HARD';
          
          setDifficulty(nextDiff);
          handleStartTraining(selectedLength, currentLetter);
      } else {
          // CONTINUE
          // Logic: 
          // If Easy/Medium -> Stay same difficulty, Go Next Letter
          // If Hard -> User chose between "Next (Easy)" or "Next (Hard)" 
          // (This simple handler assumes the UI passes the Desired Difficulty or we handle it here)
          
          // Actually, let's make the handler smarter or split the logic in the UI call
          if (nextLetter) {
              handleStartTraining(selectedLength, nextLetter);
          } else {
              setMode(AppMode.HOME);
          }
      }
  };

  // Helper for Specific Hard Mode Options
  const handleHardCompletion = (nextDiff: Difficulty) => {
      setShowCompletionModal(false);
      const nextCharCode = currentLetter.charCodeAt(0) + 1;
      const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;
      
      setDifficulty(nextDiff);
      
      if (nextLetter) {
          handleStartTraining(selectedLength, nextLetter);
      } else {
          setMode(AppMode.HOME);
      }
  };

  // --- ACTIONS: HOOKS ---

  const startHooks = () => {
    // If we have an active deck AND we haven't reached the end, resume it.
    if (hookDeck.length > 0 && activeHookIndex < hookDeck.length) {
       setMode(AppMode.HOOKS);
       return;
    }

    // Start Fresh: Use PRE-CALCULATED data
    const shuffled = [...allHookData].sort(() => 0.5 - Math.random());
    setHookDeck(shuffled);
    setActiveHookIndex(0);
    setMode(AppMode.HOOKS);
  };

  const handleHookMastery = (baseWord: string) => {
    setHookMastery(prev => {
      const currentSet = new Set(prev[difficulty]);
      currentSet.add(baseWord);
      return { ...prev, [difficulty]: currentSet };
    });
    advanceHook();
  };

  const handleHookFail = () => {
     if (difficulty === 'HARD') {
        setActiveHookIndex(0);
     }
  };

  const advanceHook = () => {
    if (activeHookIndex < hookDeck.length - 1) {
      setActiveHookIndex(prev => prev + 1);
    } else {
      // Completed! Clear deck so next time we start fresh.
      setHookDeck([]); 
      setActiveHookIndex(0); // Explicitly reset index to 0
      setMode(AppMode.HOME);
    }
  };

  // --- ACTIONS: OTHER ---

  const handleBogey = (word: WordEntry, source: AppMode) => {
    setBogeyWord(word);
    setBogeySource(source);
    setMode(AppMode.BOGEY);
  };

  const handleChallengeHighScore = (score: number) => {
    if (score > challengeHighScore) {
      setChallengeHighScore(score);
    }
  };

  const DifficultyButton = ({ level }: { level: Difficulty }) => (
    <button
      onClick={() => setDifficulty(level)}
      className={`flex-1 py-3 rounded-xl font-black text-sm tracking-wider transition-all ${
        difficulty === level 
          ? 'bg-slate-800 text-white shadow-lg scale-105' 
          : 'bg-white text-slate-400 hover:bg-slate-50'
      }`}
    >
      {level}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col">
      {/* HEADER */}
      {mode === AppMode.HOME && (
        <div className="pt-12 pb-6 px-6 bg-slate-100 sticky top-0 z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-1">
              End<span className="text-indigo-600">Cap</span>
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">CSW24 Lexicon Trainer</p>
          </div>

          <div className="bg-white p-1 rounded-2xl shadow-sm flex gap-1 mb-2">
            <DifficultyButton level="EASY" />
            <DifficultyButton level="MEDIUM" />
            <DifficultyButton level="HARD" />
          </div>
        </div>
      )}

      {/* COMPLETION MODAL */}
      {showCompletionModal && mode === AppMode.TRAINING && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trophy size={32} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">
                 {selectedLength}L '{currentLetter}' Complete!
              </h2>
              <p className="text-slate-500 font-medium mb-6">
                 Excellent work. How would you like to proceed?
              </p>
              
              <div className="flex flex-col gap-3">
                 {difficulty === 'EASY' && (
                    <>
                       <button onClick={() => handleCompletionAction('REINFORCE')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">
                          Reenforce with MEDIUM
                       </button>
                       <button onClick={() => handleCompletionAction('CONTINUE')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                          Continue to Next Letter
                       </button>
                    </>
                 )}

                 {difficulty === 'MEDIUM' && (
                    <>
                       <button onClick={() => handleCompletionAction('REINFORCE')} className="py-4 rounded-xl bg-rose-600 text-white font-bold text-lg hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-200">
                          Reenforce with HARD
                       </button>
                       <button onClick={() => handleCompletionAction('CONTINUE')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                          Continue to Next Letter
                       </button>
                    </>
                 )}

                 {difficulty === 'HARD' && (
                    <>
                       <button onClick={() => handleHardCompletion('EASY')} className="py-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all">
                          Continue (Easy)
                       </button>
                       <button onClick={() => handleHardCompletion('HARD')} className="py-4 rounded-xl bg-slate-800 text-white font-bold text-lg hover:bg-slate-900 active:scale-95 transition-all shadow-lg">
                          Continue (Hard)
                       </button>
                    </>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className={`flex-1 max-w-lg mx-auto w-full ${mode !== AppMode.HOME ? 'h-screen' : ''}`}>
        
        {mode === AppMode.HOME && (
          <div className="px-6 pb-12 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            {/* TRAINING CARDS */}
            <div className="grid grid-cols-1 gap-4">
              {[2, 3, 4].map((len) => (
                <button
                  key={len}
                  onClick={() => handleStartTraining(len as WordLength)}
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-md hover:scale-[1.01] transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {len}L
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800 text-lg">{len}-Letter Words</div>
                      <div className="text-xs font-medium text-slate-400">Mastery: {getPercentage(len as WordLength)}%</div>
                    </div>
                  </div>
                  
                  {/* Circular Progress Indicator */}
                  <div className="relative w-12 h-12 flex items-center justify-center">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="text-emerald-500" strokeDasharray={`${getPercentage(len as WordLength)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                     </svg>
                     <div className="absolute text-[10px] font-bold text-slate-600">{getPercentage(len as WordLength)}%</div>
                  </div>
                </button>
              ))}
            </div>

            {/* HOOKS CARD */}
            <button 
              onClick={startHooks}
              className="bg-slate-800 p-5 rounded-[2rem] shadow-xl hover:bg-slate-700 transition-all flex items-center justify-between text-white relative overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-4">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Zap size={24} className="text-yellow-400" />
                 </div>
                 <div className="text-left">
                    <div className="font-bold text-xl">Master Hooks</div>
                    <div className="text-xs font-medium text-slate-400">2L to 3L Connections</div>
                 </div>
              </div>
              <div className="relative z-10 font-black text-2xl text-slate-600">
                {getHookPercentage()}<span className="text-sm">%</span>
              </div>
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
            </button>

            {/* CHALLENGE BUTTON */}
            <button 
              onClick={() => setMode(AppMode.CHALLENGE)}
              className="mt-2 w-full py-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2"
            >
              <Trophy size={24} className="text-yellow-300" />
              <span>Challenge Arena</span>
            </button>
          </div>
        )}

        {/* MODE VIEWS */}
        {mode === AppMode.TRAINING && (
           <TrainingView 
             pool={activeDeck}
             initialIndex={deckProgress}
             currentLetter={currentLetter}
             difficulty={difficulty}
             fullDictionary={CSW_DICTIONARY}
             onSuccess={handleTrainingSuccess}
             onFail={handleTrainingFail}
             onComplete={handleTrainingDeckComplete}
             onSkipToLetter={(char) => handleStartTraining(selectedLength, char)}
             onExit={() => setMode(AppMode.HOME)}
           />
        )}

        {mode === AppMode.CHALLENGE && (
          <ChallengeView 
            difficulty={difficulty}
            onIncorrectReal={(w) => handleBogey(w, AppMode.CHALLENGE)}
            fullDictionary={CSW_DICTIONARY}
            fakes={{
              2: FAKE_2_LETTERS,
              3: FAKE_3_LETTERS,
              4: FAKE_4_LETTERS
            }}
            topStreak={challengeHighScore}
            onUpdateHighScore={handleChallengeHighScore}
            onExit={() => setMode(AppMode.HOME)}
          />
        )}

        {mode === AppMode.HOOKS && hookDeck.length > 0 && (
          <HookView 
             data={hookDeck[activeHookIndex]}
             difficulty={difficulty}
             currentIndex={activeHookIndex}
             totalCount={hookDeck.length}
             onMastery={handleHookMastery} 
             onFail={handleHookFail}
             onNext={advanceHook}
             onExit={() => setMode(AppMode.HOME)}
          />
        )}

        {mode === AppMode.BOGEY && bogeyWord && (
          <BogeyPage 
             word={bogeyWord}
             sourceMode={bogeySource}
             onContinue={(target) => setMode(target)}
          />
        )}

      </main>
    </div>
  );
};

export default App;