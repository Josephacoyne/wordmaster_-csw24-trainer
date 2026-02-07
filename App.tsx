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
  Medal,
  HookData
} from './types';
import {
  CSW_DICTIONARY,
  FAKE_2_LETTERS,
  FAKE_3_LETTERS,
  FAKE_4_LETTERS
} from './data';
import { Trophy, Zap, Star } from 'lucide-react';

// --- TYPE DEFINITIONS FOR SAVED STATE ---
type ProgressMap = Record<string, number>;
type MedalMap = Record<string, Medal>;

const MEDAL_RANK: Record<Medal, number> = { gold: 3, silver: 2, bronze: 1 };

const MedalIcon: React.FC<{ medal: Medal, size?: number }> = ({ medal, size = 20 }) => {
  const color = medal === 'gold' ? 'text-yellow-400' : medal === 'silver' ? 'text-slate-400' : 'text-amber-700';
  return <Star size={size} className={color} fill="currentColor" />;
};

const App: React.FC = () => {
  // --- STATE ---
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [selectedLength, setSelectedLength] = useState<WordLength>(2);

  // Bogey/Error State
  const [bogeyWord, setBogeyWord] = useState<WordEntry | null>(null);
  const [bogeySource, setBogeySource] = useState<AppMode>(AppMode.TRAINING);

  // Training State
  const [currentLetter, setCurrentLetter] = useState<string>('A');
  const [activeDeck, setActiveDeck] = useState<WordEntry[]>([]);
  const [deckProgress, setDeckProgress] = useState(0);

  // Persistence for Training
  const [savedTrainingProgress, setSavedTrainingProgress] = useState<ProgressMap>({});

  // Hook State
  const [hookDeck, setHookDeck] = useState<HookData[]>([]);
  const [activeHookIndex, setActiveHookIndex] = useState(0);

  // Challenge State
  const [autoStartChallenge, setAutoStartChallenge] = useState<WordLength | null>(null);

  // Medals
  const [medals, setMedals] = useState<MedalMap>({});

  // --- INITIAL LOAD & SAVE ---
  useEffect(() => {
    const savedProgress = localStorage.getItem('endcap_training_progress');
    if (savedProgress) {
        try {
            setSavedTrainingProgress(JSON.parse(savedProgress));
        } catch (e) { console.error("Failed to load progress", e); }
    }

    const savedHookIndex = localStorage.getItem('endcap_hook_index');
    if (savedHookIndex) {
        setActiveHookIndex(parseInt(savedHookIndex, 10));
    }

    const savedMedals = localStorage.getItem('endcap_medals');
    if (savedMedals) {
        try {
            setMedals(JSON.parse(savedMedals));
        } catch (e) { console.error("Failed to load medals", e); }
    }
  }, []);

  // --- PERSISTENCE: SAVE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('endcap_training_progress', JSON.stringify(savedTrainingProgress));
  }, [savedTrainingProgress]);

  useEffect(() => {
    localStorage.setItem('endcap_hook_index', activeHookIndex.toString());
  }, [activeHookIndex]);

  useEffect(() => {
    localStorage.setItem('endcap_medals', JSON.stringify(medals));
  }, [medals]);

  // --- MEDAL HELPER ---
  const saveMedal = (key: string, errors: number) => {
    const medal: Medal = errors === 0 ? 'gold' : errors <= 10 ? 'silver' : 'bronze';
    setMedals(prev => {
      const existing = prev[key];
      if (existing && MEDAL_RANK[existing] >= MEDAL_RANK[medal]) return prev;
      return { ...prev, [key]: medal };
    });
  };

  // --- OPTIMIZATION: MEMOIZED DATA ---
  const dictionaryByLength = useMemo(() => ({
    2: CSW_DICTIONARY.filter(w => w.w.length === 2),
    3: CSW_DICTIONARY.filter(w => w.w.length === 3),
    4: CSW_DICTIONARY.filter(w => w.w.length === 4),
  }), []);

  const allHookData = useMemo(() => {
    return generateHookData(CSW_DICTIONARY);
  }, []);

  // --- STATS HELPERS ---
  const getHookPercentage = () => {
    if (allHookData.length === 0) return 0;
    return Math.round((activeHookIndex / allHookData.length) * 100);
  };

  // --- ACTIONS: TRAINING ---
  const handleStartTraining = (len: WordLength, startChar: string = 'A') => {
    if (len === 'ALL') return;

    setSelectedLength(len);
    setCurrentLetter(startChar);

    const batch = dictionaryByLength[len].filter(w => w.w.startsWith(startChar));

    if (batch.length === 0) {
      // Skip empty letters
      const nextCharCode = startChar.charCodeAt(0) + 1;
      const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;
      if (nextLetter) {
        handleStartTraining(len, nextLetter);
      } else {
        setMode(AppMode.HOME);
      }
      return;
    }

    const key = `${len}-${startChar}`;
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
    const key = `${selectedLength}-${currentLetter}`;
    const nextIndex = deckProgress + 1;
    setSavedTrainingProgress(prev => ({ ...prev, [key]: nextIndex }));

    if (nextIndex < activeDeck.length) {
      setDeckProgress(nextIndex);
    }
  };

  const handleTrainingDeckComplete = (totalErrors: number) => {
    if (selectedLength === 'ALL') return;

    const nextCharCode = currentLetter.charCodeAt(0) + 1;
    const nextLetter = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : null;

    if (nextLetter) {
      handleStartTraining(selectedLength, nextLetter);
    } else {
      // All letters done — save medal
      saveMedal(`training-${selectedLength}`, totalErrors);
      setMode(AppMode.HOME);
    }
  };

  // --- ACTIONS: CHALLENGE ---
  const handleStartChallenge = () => {
     setMode(AppMode.CHALLENGE);
  };

  const handleChallengeComplete = (length: WordLength, totalErrors: number) => {
    saveMedal(`challenge-${length}`, totalErrors);
  };

  // --- ACTIONS: HOOKS ---
  const startHooks = () => {
    setHookDeck(allHookData);
    setMode(AppMode.HOOKS);
  };

  const handleHookMastery = () => {
    if (activeHookIndex < allHookData.length - 1) {
      setActiveHookIndex(prev => prev + 1);
    } else {
      setActiveHookIndex(prev => prev + 1);
    }
  };

  const handleHookAllComplete = (totalErrors: number) => {
    saveMedal('hooks', totalErrors);
  };

  // --- ACTIONS: OTHER ---
  const handleBogey = (word: WordEntry) => {
    setBogeyWord(word);
    setBogeySource(AppMode.CHALLENGE);
    setMode(AppMode.BOGEY);
  };

  const handleHome = () => {
    setMode(AppMode.HOME);
    setAutoStartChallenge(null);
  }

  // Best challenge medal for display
  const bestChallengeMedal = useMemo(() => {
    let best: Medal | null = null;
    ['challenge-2', 'challenge-3', 'challenge-4', 'challenge-ALL'].forEach(k => {
      const m = medals[k];
      if (m && (!best || MEDAL_RANK[m] > MEDAL_RANK[best])) best = m;
    });
    return best;
  }, [medals]);

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
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className={`flex-1 max-w-lg mx-auto w-full ${mode !== AppMode.HOME ? 'h-screen' : ''}`}>

        {mode === AppMode.HOME && (
          <div className="px-6 pb-12 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            {/* TRAINING CARDS */}
            <div className="grid grid-cols-1 gap-4">
              {[2, 3, 4].map((len) => {
                const medal = medals[`training-${len}`];
                return (
                <button
                  key={len}
                  onClick={() => handleStartTraining(len as WordLength)}
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-md hover:scale-[1.01] transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors relative">
                      {len}L
                      {medal && (
                        <div className="absolute -top-1 -right-1">
                          <MedalIcon medal={medal} size={16} />
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800 text-lg">{len}-Letter Words</div>
                    </div>
                  </div>
                </button>
              )})}
            </div>

            {/* HOOKS CARD */}
            <button
              onClick={startHooks}
              className="bg-slate-800 p-5 rounded-[2rem] shadow-xl hover:bg-slate-700 transition-all flex items-center justify-between text-white relative overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-4">
                 <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center relative">
                    <Zap size={24} className="text-yellow-400" />
                    {medals['hooks'] && (
                      <div className="absolute -top-1 -right-1">
                        <MedalIcon medal={medals['hooks']} size={16} />
                      </div>
                    )}
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
              className="mt-2 w-full py-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 relative"
            >
              <Trophy size={24} className="text-yellow-300" />
              <span>Challenge Arena</span>
              {bestChallengeMedal && (
                <div className="absolute top-3 right-4">
                  <MedalIcon medal={bestChallengeMedal} size={20} />
                </div>
              )}
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
             fullDictionary={CSW_DICTIONARY}
             onSuccess={handleTrainingSuccess}
             onComplete={handleTrainingDeckComplete}
             onSkipToLetter={(char) => handleStartTraining(selectedLength, char)}
             onExit={handleHome}
           />
        )}

        {(mode === AppMode.CHALLENGE || (mode === AppMode.BOGEY && bogeySource === AppMode.CHALLENGE)) && (
          <ChallengeView
            key={`${autoStartChallenge || 'menu'}`}
            onIncorrectReal={(w) => handleBogey(w)}
            fullDictionary={CSW_DICTIONARY}
            fakes={{
              2: FAKE_2_LETTERS,
              3: FAKE_3_LETTERS,
              4: FAKE_4_LETTERS
            }}
            onExit={handleHome}
            autoStartLength={autoStartChallenge}
            onDeckComplete={handleChallengeComplete}
          />
        )}

        {mode === AppMode.HOOKS && hookDeck.length > 0 && (
          <HookView
             data={hookDeck[Math.min(activeHookIndex, hookDeck.length - 1)]}
             currentIndex={activeHookIndex}
             totalCount={hookDeck.length}
             onMastery={handleHookMastery}
             onExit={handleHome}
             onAllComplete={handleHookAllComplete}
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
