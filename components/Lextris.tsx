import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { WordEntry } from '../types';
import threeLetterHooksData from '../data/three-letter-hooks.json';
import fourLetterHooksData from '../data/four-letter-hooks.json';
import fiveLetterHooksData from '../data/five-letter-hooks.json';
import definitions3 from '../data/definitions_3.json';
import definitions4 from '../data/definitions_4.json';
import definitions5 from '../data/definitions_5.json';

// Pre-built lookups from complete CSW24: word → { f?: "ABC...", b?: "XYZ..." }
type HookEntry = { f?: string; b?: string };
const THREE_LETTER_HOOKS: Record<string, HookEntry> = threeLetterHooksData;
const FOUR_LETTER_HOOKS: Record<string, HookEntry> = fourLetterHooksData;
const FIVE_LETTER_HOOKS: Record<string, HookEntry> = fiveLetterHooksData;

interface LextrisProps {
  fullDictionary: WordEntry[];
  onExit: () => void;
  onHighScore?: (score: number) => void;
  highScore?: number;
}

interface Cell {
  letter: string | null;
  isGreyedOut: boolean;
  id: number;
}

type HookPhase = 'none' | 'hook2to3' | 'hook3to4' | 'hook4to5';

// SOURCE OF TRUTH: Complete 2-letter word dictionary for CSW24 (127 words)
// ANCHOR-NEUTRAL: Any letter can be the anchor. Word is valid if it exists in this list.
const LEXTRIS_DICTIONARY = ['AA','AB','AD','AE','AG','AH','AI','AL','AM','AN','AR','AS','AT','AW','AX','AY','BA','BE','BI','BO','BY','CH','DA','DE','DI','DO','EA','ED','EE','EF','EH','EL','EM','EN','ER','ES','ET','EW','EX','FA','FE','FY','GI','GO','GU','HA','HE','HI','HM','HO','ID','IF','IN','IO','IS','IT','JA','JO','KA','KI','KO','KY','LA','LI','LO','MA','ME','MI','MM','MO','MU','MY','NA','NE','NO','NU','NY','OB','OD','OE','OF','OH','OI','OK','OM','ON','OO','OP','OR','OS','OT','OW','OX','OY','PA','PE','PI','PO','QI','RE','SH','SI','SO','ST','TA','TE','TI','TO','UG','UH','UM','UN','UP','UR','US','UT','WE','WO','XI','XU','YA','YE','YO','YU','ZA','ZE','ZO'];

// For quick lookup
const DICTIONARY_SET = new Set(LEXTRIS_DICTIONARY);

const BASE_COLS = 3;
const ROWS = 13;
const TOTAL_WORDS = LEXTRIS_DICTIONARY.length; // 127 words

function makeEmptyGrid(cols: number): Cell[][] {
  return Array(ROWS).fill(null).map(() =>
    Array(cols).fill(null).map(() => ({ letter: null, isGreyedOut: false, id: 0 }))
  );
}

const Lextris: React.FC<LextrisProps> = ({ fullDictionary, onExit, onHighScore, highScore = 0 }) => {
  const [dictionaryLoaded, setDictionaryLoaded] = useState(true);

  // Dynamic column width
  const [activeCols, setActiveCols] = useState(BASE_COLS);

  // Lookup hooks from pre-built JSON files (complete CSW24 coverage)
  const lookupHooks = useCallback((word: string, phase: HookPhase): { front: string[]; back: string[] } => {
    const table = phase === 'hook2to3' ? THREE_LETTER_HOOKS
                : phase === 'hook3to4' ? FOUR_LETTER_HOOKS
                : FIVE_LETTER_HOOKS;
    const entry = table[word];
    if (!entry) return { front: [], back: [] };
    return {
      front: entry.f ? entry.f.split('') : [],
      back: entry.b ? entry.b.split('') : [],
    };
  }, []);

  useEffect(() => {
    console.log('✅ Using LEXTRIS_DICTIONARY with', LEXTRIS_DICTIONARY.length, '2-letter words');
    console.log('📚 Sample words:', LEXTRIS_DICTIONARY.slice(0, 10).join(', '));
    console.log('🎯 Goal: Find all', TOTAL_WORDS, 'words');
    console.log('🔍 Anchor-neutral logic enabled');
  }, []);

  // Game state
  const [grid, setGrid] = useState<Cell[][]>(() => makeEmptyGrid(BASE_COLS));
  const [score, setScore] = useState(0);
  const [wordHistory, setWordHistory] = useState<{word: string, points: number, id: number, definition?: string}[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Track words found (removed from pool once found)
  const [wordsFound, setWordsFound] = useState<Set<string>>(new Set());
  const [remainingWords, setRemainingWords] = useState<string[]>(() => [...LEXTRIS_DICTIONARY]);

  // Current game state
  const [anchorRow, setAnchorRow] = useState(ROWS - 1);
  const [anchorLetter, setAnchorLetter] = useState<string | null>(null);
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const [fallingLetter, setFallingLetter] = useState<string | null>(null);
  const [fallingCol, setFallingCol] = useState(1);
  const [fallingRow, setFallingRow] = useState(0);
  const [flashingCells, setFlashingCells] = useState<{row: number, col: number}[]>([]);

  // Hook phase state
  const [hookPhase, setHookPhase] = useState<HookPhase>('none');
  const [hookBaseWord, setHookBaseWord] = useState<string | null>(null);
  const [hookWordCols, setHookWordCols] = useState<number[]>([]);
  const [hookValidSides, setHookValidSides] = useState<Set<'front' | 'back'>>(new Set());
  const [hookBonusMessage, setHookBonusMessage] = useState<string | null>(null);

  // Hook variety: controls how deep the hook chain goes for this round
  // 'none' = skip hooks entirely, 'hook2to3' = stop after 3L, 'hook3to4' = stop after 4L, 'hook4to5' = full chain
  const hookMaxPhaseRef = useRef<HookPhase>('hook4to5');

  const idCounter = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState<number | null>(null);
  const getNextId = () => ++idCounter.current;

  // Lookup definition: try fullDictionary first, then fall back to definition JSON files
  const DEFINITION_MAPS: Record<string, string> = { ...(definitions3 as Record<string, string>), ...(definitions4 as Record<string, string>), ...(definitions5 as Record<string, string>) };
  const getDefinition = useCallback((word: string): string | undefined => {
    const entry = fullDictionary.find(e => e.w === word);
    if (entry?.d) return entry.d;
    return DEFINITION_MAPS[word.toUpperCase()] || DEFINITION_MAPS[word];
  }, [fullDictionary]);

  // ANCHOR-NEUTRAL: Pick a random word and randomly assign anchor/falling
  const pickRandomWord = useCallback((deck: string[]) => {
    if (!deck || deck.length === 0) {
      console.log('🎉 All words completed!');
      return null;
    }

    const validDeck = deck.filter(w => DICTIONARY_SET.has(w));
    if (validDeck.length === 0) {
      console.error('❌ No valid words in deck! Resetting to full list.');
      return pickRandomWord(LEXTRIS_DICTIONARY);
    }

    const randomIndex = Math.floor(Math.random() * validDeck.length);
    const word = validDeck[randomIndex];

    if (!DICTIONARY_SET.has(word)) {
      const filteredDeck = validDeck.filter(w => w !== word);
      if (filteredDeck.length > 0) {
        return pickRandomWord(filteredDeck);
      }
      return null;
    }

    const letter1 = word[0];
    const letter2 = word[1];
    const randomChoice = Math.random() < 0.5;

    const anchor = randomChoice ? letter1 : letter2;
    const falling = randomChoice ? letter2 : letter1;

    console.log(`🎲 Picked word: "${word}" from deck (${deck.length} remaining)`);

    return { word, anchor, falling };
  }, []);

  // Spawn new round with a random word from the deck
  const spawnNewRound = useCallback((row: number, clearRow: boolean = false, deck?: string[]) => {
    console.log('🎯 Spawning new round at row', row);

    if (row < 0) {
      console.log('❌ No more rows available');
      setIsGameOver(true);
      return;
    }

    const currentDeck = deck || remainingWords;
    console.log('📦 Current deck size:', currentDeck.length);

    if (currentDeck.length === 0) {
      console.log('🎊 All words completed!');
      setIsGameOver(true);
      return;
    }

    const pick = pickRandomWord(currentDeck);

    if (!pick) {
      console.error('❌ Failed to pick word! Attempting recovery...');
      if (currentDeck.length < LEXTRIS_DICTIONARY.length) {
        const fallbackPick = pickRandomWord(LEXTRIS_DICTIONARY);
        if (!fallbackPick) {
          console.error('❌ Complete failure - no words available');
          setIsGameOver(true);
          return;
        }
        const { word, anchor, falling } = fallbackPick;
        setTargetWord(word);
        setAnchorLetter(anchor);
        setAnchorRow(row);

        setGrid(prev => {
          const cols = prev[0]?.length || BASE_COLS;
          const newGrid = prev.map(r => r.map(c => ({ ...c })));
          if (clearRow) {
            for (let col = 0; col < cols; col++) {
              newGrid[row][col] = { letter: null, isGreyedOut: false, id: 0 };
            }
          }
          newGrid[row][1] = { letter: anchor, isGreyedOut: false, id: getNextId() };
          return newGrid;
        });

        setFallingLetter(falling);
        setFallingCol(1);
        setFallingRow(0);

        console.log(`⚠️ FALLBACK: Using word "${word}"`);
        return;
      }
      console.error('❌ Cannot spawn block - game over');
      setIsGameOver(true);
      return;
    }

    const { word, anchor, falling } = pick;

    setTargetWord(word);
    setAnchorLetter(anchor);
    setAnchorRow(row);

    setGrid(prev => {
      const cols = prev[0]?.length || BASE_COLS;
      const newGrid = prev.map(r => r.map(c => ({ ...c })));

      if (clearRow) {
        for (let col = 0; col < cols; col++) {
          newGrid[row][col] = { letter: null, isGreyedOut: false, id: 0 };
        }
      }

      // Place anchor at center column (col 1 for 3-col grid)
      newGrid[row][1] = { letter: anchor, isGreyedOut: false, id: getNextId() };
      return newGrid;
    });

    setFallingLetter(falling);
    setFallingCol(1);
    setFallingRow(0);

    console.log(`✨ SPAWNED: word="${word}" anchor='${anchor}' falling='${falling}'`);
  }, [pickRandomWord, remainingWords]);

  // Resize grid to new column count, preserving existing cells
  const resizeGrid = useCallback((newCols: number, currentGrid: Cell[][]): Cell[][] => {
    const oldCols = currentGrid[0]?.length || BASE_COLS;
    if (newCols === oldCols) return currentGrid;

    return currentGrid.map(row => {
      const newRow: Cell[] = Array(newCols).fill(null).map(() => ({ letter: null, isGreyedOut: false, id: 0 }));
      // Copy existing cells into center of new row
      // For expansion: old cells start at offset 1 if expanding from 3→4, etc.
      // For shrink: take center cells
      if (newCols > oldCols) {
        // Expanding: place old cells starting at col 1
        const offset = 1;
        for (let c = 0; c < oldCols; c++) {
          if (c + offset < newCols) {
            newRow[c + offset] = { ...row[c] };
          }
        }
        // Preserve greyed-out state on new empty cells in greyed rows
        if (row.some(cell => cell.isGreyedOut)) {
          for (let c = 0; c < newCols; c++) {
            newRow[c].isGreyedOut = true;
          }
        }
      } else {
        // Shrinking: take from offset 1 for `newCols` cells
        const offset = 1;
        for (let c = 0; c < newCols; c++) {
          if (c + offset < oldCols) {
            newRow[c] = { ...row[c + offset] };
          }
        }
      }
      return newRow;
    });
  }, []);

  // Enter hook phase after a valid 2, 3, or 4-letter word
  const enterHookPhase = useCallback((baseWord: string, baseRow: number, phase: HookPhase, currentGrid: Cell[][]) => {
    const hooks = lookupHooks(baseWord, phase);

    // Build a map of unique hook letters to their valid sides
    const hookLetterMap = new Map<string, Set<'front' | 'back'>>();
    for (const ch of hooks.front) {
      if (!hookLetterMap.has(ch)) hookLetterMap.set(ch, new Set());
      hookLetterMap.get(ch)!.add('front');
    }
    for (const ch of hooks.back) {
      if (!hookLetterMap.has(ch)) hookLetterMap.set(ch, new Set());
      hookLetterMap.get(ch)!.add('back');
    }

    const uniqueLetters = Array.from(hookLetterMap.keys());
    if (uniqueLetters.length === 0) return false; // No hooks available

    // Pick a random hook letter
    const chosenLetter = uniqueLetters[Math.floor(Math.random() * uniqueLetters.length)];
    const validSides = hookLetterMap.get(chosenLetter)!;

    const newCols = phase === 'hook2to3' ? 4 : phase === 'hook3to4' ? 5 : 6;
    const resized = resizeGrid(newCols, currentGrid);

    // Clear the anchor row first to avoid duplicated letters from the resize offset
    for (let c = 0; c < newCols; c++) {
      resized[baseRow][c] = { letter: null, isGreyedOut: false, id: 0 };
    }

    // Place base word centered in the new grid
    // For 4-col: base word at cols [1,2]
    // For 5-col: base word at cols [1,2,3]
    const wordStartCol = 1;
    const wordCols: number[] = [];
    for (let i = 0; i < baseWord.length; i++) {
      const col = wordStartCol + i;
      wordCols.push(col);
      resized[baseRow][col] = { letter: baseWord[i], isGreyedOut: false, id: getNextId() };
    }

    setActiveCols(newCols);
    setGrid(resized);
    setHookPhase(phase);
    setHookBaseWord(baseWord);
    setHookWordCols(wordCols);
    setHookValidSides(validSides);
    setHookBonusMessage(`HOOK BONUS! Place ${chosenLetter} to extend: ${baseWord}`);

    // Drop the hook letter from center
    const centerCol = Math.floor(newCols / 2);
    setFallingLetter(chosenLetter);
    setFallingCol(centerCol);
    setFallingRow(0);

    console.log(`🪝 HOOK PHASE: ${phase}, base="${baseWord}", hook letter='${chosenLetter}', valid sides=[${Array.from(validSides)}]`);
    return true;
  }, [lookupHooks, resizeGrid]);

  // Reset hook state variables (does NOT touch grid or activeCols)
  const resetHookState = useCallback(() => {
    setHookPhase('none');
    setHookBaseWord(null);
    setHookWordCols([]);
    setHookValidSides(new Set());
    setHookBonusMessage(null);
  }, []);

  // Initialize game when dictionary loads
  useEffect(() => {
    console.log('🎮 Init effect running', {
      dictionaryLoaded,
      hasAnchorLetter: !!anchorLetter,
      isGameOver
    });
    if (dictionaryLoaded && !anchorLetter && !isGameOver) {
      console.log('🚀 Starting game with', remainingWords.length, 'words in deck');
      spawnNewRound(ROWS - 1);
    }
  }, [dictionaryLoaded, anchorLetter, isGameOver, spawnNewRound, remainingWords]);

  // Report high score when game ends
  useEffect(() => {
    if (isGameOver && score > 0) {
      onHighScore?.(score);
    }
  }, [isGameOver]);

  // Move falling letter
  const moveLeft = useCallback(() => {
    if (!fallingLetter || isPaused || isGameOver) return;
    if (fallingCol > 0) {
      setFallingCol(prev => prev - 1);
    }
  }, [fallingLetter, isPaused, isGameOver, fallingCol]);

  const moveRight = useCallback(() => {
    if (!fallingLetter || isPaused || isGameOver) return;
    if (fallingCol < activeCols - 1) {
      setFallingCol(prev => prev + 1);
    }
  }, [fallingLetter, isPaused, isGameOver, fallingCol, activeCols]);

  const moveDown = useCallback(() => {
    if (!fallingLetter || isPaused || isGameOver) return;

    // Check if we've reached the anchor row
    if (fallingRow >= anchorRow - 1) {
      console.log('💥 Landing at row', anchorRow, 'col', fallingCol, 'letter', fallingLetter);

      // ==========================================
      // HOOK PHASE LANDING
      // ==========================================
      if (hookPhase !== 'none') {
        const currentHookBase = hookBaseWord!;
        const currentHookLetter = fallingLetter;
        const currentValidSides = hookValidSides;
        const currentActiveCols = activeCols;

        setFallingLetter(null);

        // Determine placement side
        let placedSide: 'front' | 'back' | 'middle';
        if (fallingCol === 0) {
          placedSide = 'front';
        } else if (fallingCol === currentActiveCols - 1) {
          placedSide = 'back';
        } else {
          placedSide = 'middle';
        }

        console.log(`🪝 Hook landing: placed='${placedSide}', valid sides=[${Array.from(currentValidSides)}]`);

        if (placedSide !== 'middle' && currentValidSides.has(placedSide)) {
          // CORRECT hook placement!
          const extendedWord = placedSide === 'front'
            ? currentHookLetter + currentHookBase
            : currentHookBase + currentHookLetter;

          console.log(`✅ HOOK SUCCESS! Extended word: "${extendedWord}"`);

          // Place the letter in the grid
          setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            newGrid[anchorRow][fallingCol] = { letter: currentHookLetter, isGreyedOut: false, id: getNextId() };
            return newGrid;
          });

          // Flash the whole extended word
          const allWordCols = placedSide === 'front'
            ? [0, ...hookWordCols]
            : [...hookWordCols, currentActiveCols - 1];
          setFlashingCells(allWordCols.map(c => ({ row: anchorRow, col: c })));
          setTimeout(() => setFlashingCells([]), 400);

          // Award bonus points
          const bonusPoints = hookPhase === 'hook2to3' ? 2 : hookPhase === 'hook3to4' ? 3 : 5;
          setScore(s => s + bonusPoints);
          setWordHistory(h => [{
            word: extendedWord,
            points: bonusPoints,
            id: getNextId(),
            definition: getDefinition(extendedWord)
          }, ...h]);

          // Try to chain to the next hook level, respecting hookMaxPhase
          const capturedAnchorRow = anchorRow;
          const currentMaxPhase = hookMaxPhaseRef.current;
          let nextPhase: HookPhase | null = null;
          if (hookPhase === 'hook2to3') {
            // Only continue if maxPhase allows beyond hook2to3
            if (currentMaxPhase !== 'hook2to3') {
              nextPhase = 'hook3to4';
            }
          } else if (hookPhase === 'hook3to4') {
            // 50/50 chance to continue to hook4to5 within full chain
            if (currentMaxPhase === 'hook4to5' && Math.random() < 0.5) {
              nextPhase = 'hook4to5';
            }
          }

          if (nextPhase) {
            const capturedNextPhase = nextPhase;
            const capturedExtended = extendedWord;
            setTimeout(() => {
              setGrid(prev => {
                const currentGrid = prev.map(r => r.map(c => ({ ...c })));
                // Check if hooks exist at the next level
                const nextHooks = lookupHooks(capturedExtended, capturedNextPhase);
                const hasNext = nextHooks.front.length > 0 || nextHooks.back.length > 0;

                if (hasNext) {
                  enterHookPhase(capturedExtended, capturedAnchorRow, capturedNextPhase, currentGrid);
                  return prev;
                } else {
                  console.log(`🪝 No ${capturedNextPhase} hooks available, returning to normal play`);
                  const shrunk = resizeGrid(BASE_COLS, currentGrid);
                  for (let col = 0; col < BASE_COLS; col++) {
                    shrunk[capturedAnchorRow][col] = { letter: null, isGreyedOut: false, id: 0 };
                  }
                  setActiveCols(BASE_COLS);
                  resetHookState();
                  setTimeout(() => spawnNewRound(capturedAnchorRow, true), 350);
                  return shrunk;
                }
              });
            }, 500);
          } else {
            // hook4to5 complete (or end of chain), exit hook phase
            setTimeout(() => {
              setGrid(prev => {
                const currentGrid = prev.map(r => r.map(c => ({ ...c })));
                const shrunk = resizeGrid(BASE_COLS, currentGrid);
                for (let col = 0; col < BASE_COLS; col++) {
                  shrunk[capturedAnchorRow][col] = { letter: null, isGreyedOut: false, id: 0 };
                }
                setActiveCols(BASE_COLS);
                resetHookState();
                setTimeout(() => spawnNewRound(capturedAnchorRow, true), 350);
                return shrunk;
              });
            }, 500);
          }
        } else {
          // WRONG hook placement (wrong side or middle)
          console.log('❌ HOOK FAIL! Wrong side or middle placement');

          const capturedAnchorRow = anchorRow;
          // Grey out the entire row, then shrink grid
          setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            for (let col = 0; col < currentActiveCols; col++) {
              newGrid[capturedAnchorRow][col].isGreyedOut = true;
              if (col === fallingCol) {
                newGrid[capturedAnchorRow][col] = { letter: currentHookLetter, isGreyedOut: true, id: getNextId() };
              }
            }
            const shrunk = resizeGrid(BASE_COLS, newGrid);
            setActiveCols(BASE_COLS);
            resetHookState();
            return shrunk;
          });

          // Spawn new word one row up (lose a life)
          setTimeout(() => spawnNewRound(capturedAnchorRow - 1), 350);
        }

        return;
      }

      // ==========================================
      // NORMAL 2-LETTER WORD LANDING
      // ==========================================
      let formedWord = '';
      let wordCells: {row: number, col: number}[] = [];
      const currentAnchor = anchorLetter;
      const currentFalling = fallingLetter;
      const currentTarget = targetWord;

      if (fallingCol === 0) {
        formedWord = currentFalling + currentAnchor;
        wordCells = [{row: anchorRow, col: 0}, {row: anchorRow, col: 1}];
      } else if (fallingCol === 2) {
        formedWord = currentAnchor + currentFalling;
        wordCells = [{row: anchorRow, col: 1}, {row: anchorRow, col: 2}];
      }

      const isInDictionary = DICTIONARY_SET.has(formedWord);

      console.log(`🔍 Formed: "${formedWord}", in dictionary: ${isInDictionary}`);

      if (isInDictionary) {
        console.log('✅ SUCCESS! Correct word formed:', formedWord);

        setFallingLetter(null);

        setFlashingCells(wordCells);
        setTimeout(() => setFlashingCells([]), 300);

        const alreadyFound = wordsFound.has(formedWord);
        const newDeck = remainingWords.filter(w => w !== formedWord);

        if (!alreadyFound) {
          setWordsFound(prev => new Set([...prev, formedWord]));
          setScore(s => s + 1);
          setWordHistory(h => [{
            word: formedWord,
            points: 1,
            id: getNextId(),
            definition: getDefinition(formedWord)
          }, ...h]);
          setRemainingWords(newDeck);
          console.log(`📊 NEW WORD FOUND! "${formedWord}". Progress: ${wordsFound.size + 1}/${TOTAL_WORDS}`);
        }

        if (newDeck.length === 0) {
          console.log('🎊 ALL WORDS COMPLETED!');
          // Clear the row first
          setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            for (let col = 0; col < activeCols; col++) {
              newGrid[anchorRow][col] = { letter: null, isGreyedOut: false, id: 0 };
            }
            return newGrid;
          });
          setTimeout(() => setIsGameOver(true), 350);
          return;
        }

        // Randomize hook depth for variety:
        // 30% skip hooks, 30% one hook only (2→3), 40% full chain
        const hookRoll = Math.random();
        let maxPhase: HookPhase;
        if (hookRoll < 0.3) {
          maxPhase = 'none';
        } else if (hookRoll < 0.6) {
          maxPhase = 'hook2to3';
        } else {
          maxPhase = 'hook4to5'; // full chain (will be further limited at hook3to4)
        }
        hookMaxPhaseRef.current = maxPhase;
        console.log(`🎲 Hook variety roll: ${hookRoll.toFixed(2)} → maxPhase=${maxPhase}`);

        // Check for hooks on this 2-letter word
        const hooks = lookupHooks(formedWord, 'hook2to3');
        const hasHooks = hooks.front.length > 0 || hooks.back.length > 0;

        if (hasHooks && maxPhase !== 'none') {
          console.log(`🪝 Hooks found for "${formedWord}": front=[${hooks.front}], back=[${hooks.back}]`);
          // Place the falling letter in the grid for the base word
          setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            newGrid[anchorRow][fallingCol] = { letter: currentFalling, isGreyedOut: false, id: getNextId() };
            return newGrid;
          });

          // Enter hook phase after a brief delay
          const capturedAnchorRow = anchorRow;
          const capturedFormedWord = formedWord;
          setTimeout(() => {
            setGrid(prev => {
              const currentGrid = prev.map(r => r.map(c => ({ ...c })));
              // enterHookPhase will call setGrid itself
              enterHookPhase(capturedFormedWord, capturedAnchorRow, 'hook2to3', currentGrid);
              return prev;
            });
          }, 400);
        } else {
          // No hooks or skipping hooks - normal clear and spawn
          setGrid(prev => {
            const newGrid = prev.map(r => r.map(c => ({ ...c })));
            for (let col = 0; col < activeCols; col++) {
              newGrid[anchorRow][col] = { letter: null, isGreyedOut: false, id: 0 };
            }
            return newGrid;
          });
          setTimeout(() => spawnNewRound(anchorRow, true, newDeck), 350);
        }
      } else {
        console.log('❌ FAILURE - Wrong word:', formedWord);

        setFallingLetter(null);

        setGrid(prev => {
          const newGrid = prev.map(r => r.map(c => ({ ...c })));
          for (let col = 0; col < activeCols; col++) {
            if (col === 1) {
              newGrid[anchorRow][1] = { letter: currentAnchor, isGreyedOut: true, id: getNextId() };
            } else if (col === fallingCol) {
              newGrid[anchorRow][col] = { letter: currentFalling, isGreyedOut: true, id: getNextId() };
            } else {
              newGrid[anchorRow][col].isGreyedOut = true;
            }
          }
          return newGrid;
        });

        setTimeout(() => spawnNewRound(anchorRow - 1), 350);
      }

      setFallingLetter(null);
      return;
    }

    // Continue falling
    setFallingRow(prev => prev + 1);
  }, [fallingLetter, isPaused, isGameOver, fallingRow, anchorRow, fallingCol, anchorLetter, targetWord, remainingWords, spawnNewRound, hookPhase, hookBaseWord, hookValidSides, hookWordCols, activeCols, wordsFound, lookupHooks, enterHookPhase, resizeGrid, resetHookState]);

  // Gravity speed: starts at 500ms, gets subtly faster as score increases
  // Every 10 points shaves 15ms off, floor at 250ms
  const gravitySpeed = Math.max(250, 500 - Math.floor(score / 10) * 15);

  // Measure grid height to size scoreboard
  useEffect(() => {
    if (gridRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setGridHeight(entry.contentRect.height);
        }
      });
      observer.observe(gridRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Gravity loop
  useEffect(() => {
    if (!fallingLetter || isPaused || isGameOver) return;

    const interval = setInterval(() => {
      moveDown();
    }, gravitySpeed);

    return () => clearInterval(interval);
  }, [fallingLetter, isPaused, isGameOver, moveDown, gravitySpeed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver || isPaused) return;

      if (e.key === 'ArrowLeft') {
        moveLeft();
      } else if (e.key === 'ArrowRight') {
        moveRight();
      } else if (e.key === 'ArrowDown') {
        moveDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, isPaused, moveLeft, moveRight, moveDown]);

  // Reset game
  const resetGame = () => {
    setActiveCols(BASE_COLS);
    setGrid(makeEmptyGrid(BASE_COLS));
    setScore(0);
    setWordHistory([]);
    setWordsFound(new Set());
    setIsGameOver(false);
    setIsPaused(false);
    setAnchorLetter(null);
    setTargetWord(null);
    setFallingLetter(null);
    setRemainingWords([...LEXTRIS_DICTIONARY]);
    setHookPhase('none');
    setHookBaseWord(null);
    setHookWordCols([]);
    setHookValidSides(new Set());
    setHookBonusMessage(null);
    idCounter.current = 0;
  };

  // Fixed cell size keeps the grid stable — extra lanes widen the grid without resizing cells
  const cellSize = '2.25rem';
  // Max grid width: 6 cols × 2.25rem + 5 gaps × 2px + padding 1rem + border 4px
  const maxCols = 6;
  const gridWrapperWidth = `calc(${maxCols} * ${cellSize} + ${maxCols - 1} * 2px + 1rem + 4px)`;

  return (
    <div className="h-[100svh] w-full bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white flex flex-col overflow-hidden">
      {/* BACK button */}
      <div className="shrink-0 px-3 pt-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button onClick={onExit} className="px-4 py-1.5 rounded-lg font-bold text-sm bg-stone-700 hover:bg-stone-600 text-stone-300 transition-all">
          BACK
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-end p-2 md:p-4 overflow-hidden">
        {/* Hook bonus indicator */}
        {hookBonusMessage && (
          <div className="px-4 py-2 mb-2 bg-amber-600/90 rounded-lg text-stone-900 font-black text-sm animate-pulse">
            {hookBonusMessage}
          </div>
        )}

        {/* Grid + Scoreboard side by side */}
        <div className="flex items-end justify-center gap-2 pl-6">
          {/* Grid column */}
          <div className="flex items-center justify-center" style={{ width: gridWrapperWidth }}>
          <div
            ref={gridRef}
            className="grid gap-[2px] bg-stone-800 p-2 rounded-lg shadow-2xl border-2 border-stone-700 transition-all duration-300"
            style={{
              gridTemplateColumns: `repeat(${activeCols}, ${cellSize})`,
              gridTemplateRows: `repeat(${ROWS}, ${cellSize})`,
            }}
          >
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isFalling = fallingLetter && fallingRow === rowIndex && fallingCol === colIndex;
                const displayLetter = isFalling ? fallingLetter : cell.letter;

                const isBaseWordCell = hookPhase !== 'none' && rowIndex === anchorRow && hookWordCols.includes(colIndex);
                const isAnchor = hookPhase === 'none' && anchorLetter && rowIndex === anchorRow && colIndex === 1 && cell.letter === anchorLetter;
                const isFlashing = flashingCells.some(fc => fc.row === rowIndex && fc.col === colIndex);
                const isDropZone = hookPhase !== 'none' && rowIndex === anchorRow && (colIndex === 0 || colIndex === activeCols - 1) && !cell.letter;

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      flex items-center justify-center text-xl font-black transition-all duration-200 rounded
                      ${cell.isGreyedOut ? 'bg-stone-700 opacity-30' : 'bg-stone-600'}
                      ${isAnchor ? 'ring-2 ring-emerald-500 bg-emerald-900' : ''}
                      ${isBaseWordCell ? 'ring-2 ring-amber-500 bg-amber-900' : ''}
                      ${isFalling ? 'bg-indigo-600 ring-2 ring-indigo-400 animate-pulse' : ''}
                      ${isFlashing ? 'bg-amber-400 text-amber-950 scale-110 z-10' : ''}
                      ${isDropZone ? 'ring-2 ring-dashed ring-amber-400/50 bg-stone-500' : ''}
                    `}
                  >
                    {displayLetter && (
                      <span className={`drop-shadow-md ${isFalling ? 'text-white' : isAnchor ? 'text-emerald-300' : isBaseWordCell ? 'text-amber-300' : isFlashing ? 'text-amber-950' : 'text-stone-100'}`}>
                        {displayLetter}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          </div>

          {/* Scoreboard to the right */}
          <div
            className="w-48 md:w-64 flex flex-col bg-stone-800/90 rounded-lg border-2 border-stone-700 p-3 shadow-xl"
            style={gridHeight ? { height: gridHeight } : { alignSelf: 'stretch' }}
          >
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Pts</span>
              <span className="text-lg font-black text-amber-400">{score}</span>
            </div>
            <div className="flex-1 overflow-hidden min-h-0 space-y-1 md:space-y-2">
            {wordHistory.length === 0 ? (
              <div className="text-center text-stone-500 text-sm py-8">No words yet</div>
            ) : (
              wordHistory.slice(0, 8).map((entry, index) => (
                <div key={entry.id}
                  className={`px-2 md:px-3 py-1 md:py-2 rounded transition-all ${
                    index === 0 ? 'bg-amber-900/70 ring-2 ring-amber-600' : 'bg-stone-700/40'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-stone-100 text-sm md:text-lg">{entry.word}</span>
                    <span className="font-black text-amber-400 text-xs md:text-sm">+{entry.points}</span>
                  </div>
                  {entry.definition && (
                    <div className="text-xs text-stone-400 mt-0.5 leading-tight">{entry.definition}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        </div>

        {/* Controls under the grid */}
        <div className="flex items-center gap-2 mt-2">
          <button onClick={moveLeft} disabled={!fallingLetter || isGameOver || isPaused}
            className="w-14 h-14 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border-2 border-stone-700 flex items-center justify-center disabled:opacity-30">
            <ChevronLeft size={28} />
          </button>
          <button onClick={moveDown} disabled={!fallingLetter || isGameOver || isPaused}
            className="w-14 h-14 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border-2 border-stone-700 flex items-center justify-center disabled:opacity-30">
            <ChevronDown size={28} />
          </button>
          <button onClick={moveRight} disabled={!fallingLetter || isGameOver || isPaused}
            className="w-14 h-14 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border-2 border-stone-700 flex items-center justify-center disabled:opacity-30">
            <ChevronRight size={28} />
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            disabled={isGameOver}
            className="ml-2 px-4 h-14 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-500 text-stone-900 transition-all disabled:opacity-50"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </main>

      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-stone-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center border-2 border-stone-700">
            <h2 className="text-3xl font-black text-stone-100 mb-2">Game Over!</h2>
            <p className="text-xl text-stone-300 mb-2">Points:</p>
            <div className="text-5xl font-black text-amber-500 mb-2">{score}</div>
            {score > highScore ? (
              <div className="text-lg font-black text-yellow-300 mb-4 animate-pulse">New High Score!</div>
            ) : highScore > 0 ? (
              <div className="text-sm font-bold text-stone-400 mb-4">Best: {highScore}</div>
            ) : <div className="mb-4" />}
            <div className="flex flex-col gap-3">
              <button onClick={resetGame}
                className="py-4 bg-amber-600 hover:bg-amber-500 rounded-xl text-stone-900 font-black text-lg transition-all">
                Play Again
              </button>
              <button onClick={onExit}
                className="py-3 bg-stone-700 hover:bg-stone-600 rounded-xl text-stone-300 font-bold transition-all">
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lextris;
