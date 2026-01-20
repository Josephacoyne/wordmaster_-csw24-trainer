import React, { useState, useEffect, useMemo } from 'react';
import { generateHookData } from './utils/hookLogic';
import HookView from './components/HookView';
import TrainingView from './components/TrainingView';
import ChallengeView from './components/ChallengeView';
import BogeyPage from './components/BogeyPage';
import Lextris from './components/Lextris';
import { 
  AppMode, 
  WordEntry, 
  WordLength, 
  Difficulty, 
  HookData,
  ChallengeSnapshot
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
type ChallengeProgressMap = Record<string, ChallengeSnapshot>; // Key: "DIFFICULTY-LENGTH"

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

  // Challenge State
  const [suspendedChallenge, setSuspendedChallenge] = useState<ChallengeSnapshot | null>(null);
  const [savedChallengeProgress, setSavedChallengeProgress] = useState<ChallengeProgressMap>({});
  const [autoStartChallenge, setAutoStartChallenge] = useState<WordLength | null>(null);

  // Stats
  const [challengeHighScore, setChallengeHighScore] = useState(0);
  const [masteredWords, setMasteredWords] = useState<MasteryState>({
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

    // 4. Load Challenge Progress
    const savedChallenge = localStorage.getItem('endcap_challenge_progress');
    if (savedChallenge) {
        try {
            setSavedChallengeProgress(JSON.parse(savedChallenge));
        } catch (e) { console.error("Failed to load challenge progress", e); }
    }

    // 5. Load Hook Progress (Single Index)
    const savedHookIndex = localStorage.getItem('endcap_hook_index');
    if (savedHookIndex) {
        setActiveHookIndex(parseInt(savedHookIndex, 10));
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
    localStorage.setItem('endcap_highscore', challengeHighScore.toString());
  }, [challengeHighScore]);

  useEffect(() => {
    localStorage.setItem('endcap_training_progress', JSON.stringify(savedTrainingProgress));
  }, [savedTrainingProgress]);

  useEffect(() => {
    localStorage.setItem('endcap_challenge_progress', JSON.stringify(savedChallengeProgress));
  }, [savedChallengeProgress]);

  useEffect(() => {
    localStorage.setItem('endcap_hook_index', activeHookIndex.toString());
  }, [activeHookIndex]);

  // --- MODE SWITCHING EFFECT ---
  // When difficulty changes while in Training, update the position immediately
  useEffect(() => {
    if (mode === AppMode.TRAINING) {
        const key = `${difficulty}-${selectedLength}-${currentLetter}`;
        const savedIndex = savedTrainingProgress[key] || 0;
        
        // Safeguard: Ensure we don't restore an out-of-bounds index
        if (activeDeck.length > 0 && savedIndex >= activeDeck.length) {
            setDeckProgress(0);
        } else {
            setDeckProgress(savedIndex);
        }
    }
  }, [difficulty, mode, selectedLength, currentLetter, savedTrainingProgress, activeDeck]);


  // --- OPTIMIZATION: MEMOIZED DATA ---
  const dictionaryByLength = useMemo(() => ({
    2: CSW_DICTIONARY.filter(w => w.w.length === 2),
    3: CSW_DICTIONARY.filter(w => w.w.length === 3),
    4: CSW_DICTIONARY.filter(w => w.w.length === 4),
  }), []); 

  const totalCounts = useMemo(() => ({
    2: dictionaryByLength[2].length,
    3: dictionaryByLength[3].length,
    4: dictionaryByLength[4].length
  }), [dictionaryByLength]);

  const allHookData = useMemo(() => {
    return generateHookData(CSW_DICTIONARY);
  }, []); 

  // --- STATS HELPERS ---
  const getPercentage = (len: WordLength) => {
    if (len === 'ALL') return 0;
    const total = totalCounts[len];
    if (total === 0) return 0;
    let count = 0;
    masteredWords[difficulty].forEach(w => {
      if (w.length === len) count++;
    });
    return Math.round((count / total) * 100);
  };

  const getHookPercentage = () => {
    if (allHookData.length === 0) return 0;
    return Math.round((activeHookIndex / allHookData.length) * 100);
  };
  
  // Helper for Challenge Deck Percentage
  const getChallengePercentage = (len: WordLength) => {
      if (len === 'ALL') {
          const saved = savedChallengeProgress[`${difficulty}-ALL`];
          if (!saved || !saved.deck) return 0;
          return Math.round((saved.index / saved.deck.length) * 100);
      }
      
      const saved = savedChallengeProgress[`${difficulty}-${len}`];
      if (!saved || !saved.deck) return 0;
      return Math.round((saved.index / saved.deck.length) * 100);
  };

  // --- ACTIONS: TRAINING ---

  const handleStartTraining = (len: WordLength, startChar: string = 'A', overrideDifficulty?: Difficulty) => {
    if (len === 'ALL') return; // Should not happen for training currently
    
    const targetDiff = overrideDifficulty || difficulty;
    
    setSelectedLength(len);
    setCurrentLetter(startChar);
    
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

    const key = `${targetDiff}-${len}-${startChar}`;
    let savedIndex = savedTrainingProgress[key] || 0;
    
    if (savedIndex >= batch.length) {
       savedIndex = 0;
       setSavedTrainingProgress(prev => ({ ...prev, [key]: 0 }));
    }

    setDeckProgress(savedIndex);
    setActiveDeck(batch);
    setMode(AppMode.TRAINING);
  };

  const handleTrainingSuccess = (word: WordEntry) => {
    const key = `${difficulty}-${selectedLength}-${currentLetter}`;
    const nextIndex = deckProgress + 1;
    
    setSavedTrainingProgress(prev => ({ ...prev, [key]: nextIndex }));
    
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
      const key = `${difficulty}-${selectedLength}-${currentLetter}`;
      setSavedTrainingProgress(prev => ({ ...prev, [key]: 0 }));
      setDeckProgress(0);
      
      setMasteredWords(prev => {
        const newSet = new Set(prev[difficulty]);
        activeDeck.forEach(w => newSet.delete(w.w));
        return { ...prev, [difficulty]: newSet };
      });
    }
  };

  const handleTrainingDeckComplete = () => {
    setShowCompletionModal(true);
  };

  const handleCompletionAction = (action: 'REINFORCE' | 'CONTINUE') => {
      setShowCompletionModal(false);
      if (selectedLength === 'ALL') return;

      const nextCharCode = currentLetter.charCodeAt(0) + 1;
      const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;

      if (action === 'REINFORCE') {
          let nextDiff: Difficulty = difficulty;
          if (difficulty === 'EASY') nextDiff = 'MEDIUM';
          else if (difficulty === 'MEDIUM') nextDiff = 'HARD';
          
          setDifficulty(nextDiff);
          handleStartTraining(selectedLength, currentLetter, nextDiff);
      } else {
          if (selectedLength === 2) {
             handleStartTraining(3, 'A', 'EASY');
             return;
          }

          if (nextLetter) {
              handleStartTraining(selectedLength, nextLetter);
          } else {
              setMode(AppMode.HOME);
          }
      }
  };

  const handleHardCompletion = (nextDiff: Difficulty) => {
      setShowCompletionModal(false);
      if (selectedLength === 'ALL') return;

      const nextCharCode = currentLetter.charCodeAt(0) + 1;
      const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;
      
      setDifficulty(nextDiff);
      
      if (nextLetter) {
          handleStartTraining(selectedLength, nextLetter, nextDiff);
      } else {
          setMode(AppMode.HOME);
      }
  };

  // --- ACTIONS: CHALLENGE ---
  const handleStartChallenge = (len?: WordLength) => {
     setMode(AppMode.CHALLENGE);
  };

  // Helper to start a specific challenge level (used by completion logic)
  const handleStartNewLevel = (len: WordLength, diff: Difficulty) => {
      setDifficulty(diff);
      
      // Clear saved progress for the NEW level to ensure fresh start
      // Note: We MUST clear the key for the NEW difficulty.
      const key = `${diff}-${len}`;
      setSavedChallengeProgress(prev => {
         const next = { ...prev };
         delete next[key];
         return next;
      });
      // Also clear suspended to avoid immediate hydration from a previous unrelated session
      setSuspendedChallenge(null);
      
      setAutoStartChallenge(len);
      setMode(AppMode.CHALLENGE);
  };
  
  // --- ACTIONS: HOOKS ---

  const startHooks = () => {
    // Reset deck to all sorted data
    // activeHookIndex is already loaded from effect
    setHookDeck(allHookData);
    setMode(AppMode.HOOKS);
  };

  const handleHookMastery = () => {
    // Just advance. No need to track separate "Mastery" set as it's linear.
    advanceHook();
  };

  // No fail handler needed for App, handled internally in View or just doesn't advance
  
  const advanceHook = () => {
    if (activeHookIndex < allHookData.length - 1) {
      setActiveHookIndex(prev => prev + 1);
    } else {
      // Completed!
      // Stay on last index or show completion in View?
      // View will handle it via totalCount check
      setActiveHookIndex(prev => prev + 1); // Go to length (out of bounds) to signal completion
    }
  };

  // --- ACTIONS: OTHER ---

  const handleBogey = (word: WordEntry, source: AppMode, snapshot?: ChallengeSnapshot) => {
    setBogeyWord(word);
    setBogeySource(source);
    if (snapshot) {
      setSuspendedChallenge(snapshot); 
      if (snapshot.targetLength) { // ALL or 2/3/4
          let key = `${difficulty}-${snapshot.targetLength}`;
          if (snapshot.targetLength === 'ALL') {
              key = 'ALL';
          }
          setSavedChallengeProgress(prev => ({ ...prev, [key]: snapshot }));
      }
    }
    setMode(AppMode.BOGEY);
  };

  const handleChallengeHighScore = (score: number) => {
    if (score > challengeHighScore) {
      setChallengeHighScore(score);
    }
  };

  const handleHome = () => {
    setMode(AppMode.HOME);
    setSuspendedChallenge(null); 
    setAutoStartChallenge(null);
  }

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
                    <div className="text-xs font-medium text-slate-400">Learn then Test</div>
                 </div>
              </div>
              <div className="relative z-10 font-black text-2xl text-slate-600">
                {getHookPercentage()}<span className="text-sm">%</span>
              </div>
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
            </button>

            {/* CHALLENGE BUTTON */}
            <button
              onClick={() => handleStartChallenge()}
              className="mt-2 w-full py-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2"
            >
              <Trophy size={24} className="text-yellow-300" />
              <span>Challenge Arena</span>
            </button>

            {/* LEXTRIS BUTTON */}
            <button
              onClick={() => setMode(AppMode.LEXTRIS)}
              className="w-full py-6 bg-gradient-to-r from-stone-800 to-stone-900 text-white rounded-[2rem] font-black text-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 border border-stone-700"
            >
              <span className="text-2xl">🎮</span>
              <span>LEXTRIS</span>
              <span className="text-stone-500 text-sm font-bold">Word Tetris</span>
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
             onExit={handleHome}
           />
        )}

        {(mode === AppMode.CHALLENGE || (mode === AppMode.BOGEY && bogeySource === AppMode.CHALLENGE)) && (
          <ChallengeView 
            // Key is crucial for resetting state when context changes
            // We include autoStartChallenge in key to force fresh mount on changes, 
            // but EXCLUDE difficulty so we can switch difficulty without unmounting (for "Reenforce" logic).
            key={`${autoStartChallenge || 'menu'}`}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onIncorrectReal={(w, snapshot) => handleBogey(w, AppMode.CHALLENGE, snapshot)}
            fullDictionary={CSW_DICTIONARY}
            fakes={{
              2: FAKE_2_LETTERS,
              3: FAKE_3_LETTERS,
              4: FAKE_4_LETTERS
            }}
            topStreak={challengeHighScore}
            onUpdateHighScore={handleChallengeHighScore}
            onExit={handleHome}
            initialState={
                suspendedChallenge || 
                (autoStartChallenge ? null : savedChallengeProgress[`${difficulty}-2`] || savedChallengeProgress[`${difficulty}-3`] || savedChallengeProgress[`${difficulty}-4`] ? null : null)
            }
            savedProgress={savedChallengeProgress}
            onStartNewLevel={handleStartNewLevel}
            autoStartLength={autoStartChallenge}
            percentages={{
                2: getChallengePercentage(2),
                3: getChallengePercentage(3),
                4: getChallengePercentage(4)
            }}
          />
        )}

        {mode === AppMode.HOOKS && hookDeck.length > 0 && (
          <HookView 
             data={hookDeck[Math.min(activeHookIndex, hookDeck.length - 1)]}
             currentIndex={activeHookIndex}
             totalCount={hookDeck.length}
             onMastery={handleHookMastery} 
             onExit={handleHome}
          />
        )}

        {mode === AppMode.BOGEY && bogeyWord && (
          <BogeyPage
             word={bogeyWord}
             sourceMode={bogeySource}
             onContinue={(target) => setMode(target)}
          />
        )}

        {mode === AppMode.LEXTRIS && (
          <Lextris
            fullDictionary={CSW_DICTIONARY}
            onExit={handleHome}
          />
        )}

      </main>
    </div>
  );
};

export default App;