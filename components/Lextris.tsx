import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WordEntry } from '../types';
import { ArrowLeft, Pause, Play, RotateCcw, FlipVertical, ChevronDown, ChevronLeft, ChevronRight, Bomb, Sparkles, Zap, Flame, RefreshCw } from 'lucide-react';

interface LextrisProps {
  fullDictionary: WordEntry[];
  onExit: () => void;
}

// Grid dimensions
const COLS = 8;
const ROWS = 11;

// Minimum word length to clear (FLOW MODE: 3+ letters)
const MIN_WORD_LENGTH = 3;

// 4-way orientation for multi-letter blocks
type Orientation = 'horizontal' | 'vertical' | 'horizontal-reversed' | 'vertical-reversed';

// Block type
type BlockType = 'normal' | 'lexical-bomb' | 'destroyer-bomb';

// Cell type for the grid
interface Cell {
  letter: string | null;
  isWildcard: boolean;
  id: number;
}

// Falling block - can be 1, 2, or 3 letters, or a bomb
interface FallingBlock {
  letters: string[];
  col: number;
  row: number;
  orientation: Orientation;
  isWildcard: boolean[];
  id: number;
  blockType: BlockType;
}

// Rack state: 6 letters total distributed across 3 fixed block bins
// [0] = Block A (1 letter)
// [1,2] = Block B (2 letters)
// [3,4,5] = Block C (3 letters)
interface RackState {
  letters: string[];      // always 6 letters
  isWildcard: boolean[];  // always 6 booleans
}

// Letter frequency for Scrabble-like distribution
const LETTER_BAG = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ';
const VOWELS = 'AEIOU';
const COMMON_VOWELS = ['E', 'A', 'I'];

const getRandomLetter = (): string => {
  return LETTER_BAG[Math.floor(Math.random() * LETTER_BAG.length)];
};

const getRandomVowel = (): string => {
  return VOWELS[Math.floor(Math.random() * VOWELS.length)];
};

const getRandomCommonVowel = (): string => {
  return COMMON_VOWELS[Math.floor(Math.random() * COMMON_VOWELS.length)];
};

const createEmptyGrid = (): Cell[][] => {
  return Array(ROWS).fill(null).map(() =>
    Array(COLS).fill(null).map(() => ({ letter: null, isWildcard: false, id: 0 }))
  );
};

// Max charges for Vertical Scan
const MAX_VERTICAL_SCAN_CHARGES = 3;

// Flash Clear duration
const FLASH_CLEAR_DURATION = 10;

const Lextris: React.FC<LextrisProps> = ({ fullDictionary, onExit }) => {
  // Build valid words set for quick lookup (3+ letters for clearing)
  const validWords = useMemo(() => {
    const words = new Set<string>();
    fullDictionary.forEach(entry => {
      if (entry.w.length >= MIN_WORD_LENGTH && entry.w.length <= COLS) {
        words.add(entry.w.toUpperCase());
      }
    });
    return words;
  }, [fullDictionary]);

  // Build 2-letter words set for Flash Clear
  const twoLetterValidWords = useMemo(() => {
    const words = new Set<string>();
    fullDictionary.forEach(entry => {
      if (entry.w.length === 2) {
        words.add(entry.w.toUpperCase());
      }
    });
    return words;
  }, [fullDictionary]);

  // Game state
  const [grid, setGrid] = useState<Cell[][]>(createEmptyGrid);
  const [fallingBlock, setFallingBlock] = useState<FallingBlock | null>(null);
  const [levelScore, setLevelScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [blocksPlaced, setBlocksPlaced] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastClearedWords, setLastClearedWords] = useState<string[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [comboCount, setComboCount] = useState(0);

  // Word Ledger: track cleared words with scores
  const [wordLedger, setWordLedger] = useState<{word: string, points: number, id: number}[]>([]);

  // Vertical Scan power-up charges
  const [verticalScanCharges, setVerticalScanCharges] = useState(MAX_VERTICAL_SCAN_CHARGES);

  // CONVEYOR BELT RACK: 3 blocks in sequence (Active, Next, On-Deck)
  const [blockQueue, setBlockQueue] = useState<{letters: string[], isWildcard: boolean[]}[]>([]);
  // Current block type sequence: 0=1-letter, 1=2-letter, 2=3-letter
  const [blockTypeSequence, setBlockTypeSequence] = useState(0);

  // Swap state: selected from rack or selected on board
  const [selectedRackIndex, setSelectedRackIndex] = useState<{blockIndex: number, letterIndex: number} | null>(null);
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [swappedCell, setSwappedCell] = useState<{row: number, col: number} | null>(null);

  // Flash Clear power-up state
  const [isFlashClearActive, setIsFlashClearActive] = useState(false);
  const [flashClearTimeLeft, setFlashClearTimeLeft] = useState(0);

  // Processing state for cascade/combo
  const [isProcessing, setIsProcessing] = useState(false);

  // Drop speed (decreases with milestones) - ZEN START: 1500ms, speeds up gradually
  const dropSpeed = useMemo(() => {
    const speedTier = Math.floor(totalScore / 500);
    return Math.max(200, 1500 * Math.pow(0.95, speedTier));
  }, [totalScore]);

  // Unique ID counter
  const idCounter = useRef(0);
  const getNextId = () => ++idCounter.current;

  // Check if top rows have blocks (for vowel/blank boost)
  const hasBlocksInTopRows = useCallback(() => {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < COLS; col++) {
        if (grid[row][col].letter !== null) {
          return true;
        }
      }
    }
    return false;
  }, [grid]);

  // Draw a single letter from the bag
  const drawLetter = useCallback((forceVowelChance: boolean = false): { letter: string, isWildcard: boolean } => {
    // Small chance for wildcard
    if (Math.random() < 0.05) {
      return { letter: '?', isWildcard: true };
    }
    // Boost vowels if board is filling up
    if (forceVowelChance && Math.random() < 0.4) {
      return { letter: getRandomVowel(), isWildcard: false };
    }
    return { letter: getRandomLetter(), isWildcard: false };
  }, []);

  // Generate a single block based on type (0=1L, 1=2L, 2=3L)
  const generateBlock = useCallback((blockType: number): {letters: string[], isWildcard: boolean[]} => {
    const topRowsHaveBlocks = hasBlocksInTopRows();
    const size = blockType === 0 ? 1 : blockType === 1 ? 2 : 3;
    const letters: string[] = [];
    const isWildcard: boolean[] = [];

    for (let i = 0; i < size; i++) {
      const drawn = drawLetter(topRowsHaveBlocks);
      letters.push(drawn.letter);
      isWildcard.push(drawn.isWildcard);
    }

    return { letters, isWildcard };
  }, [drawLetter, hasBlocksInTopRows]);

  // Initialize block queue with 3 blocks in sequence (1L, 2L, 3L)
  const initializeBlockQueue = useCallback(() => {
    const queue = [
      generateBlock(0), // 1-letter
      generateBlock(1), // 2-letter
      generateBlock(2)  // 3-letter
    ];
    setBlockQueue(queue);
    setBlockTypeSequence(0);
  }, [generateBlock]);

  // VISUAL SHUFFLE: Randomize letters across all 3 blocks WITHOUT drawing new ones
  const shuffleRack = useCallback(() => {
    setBlockQueue(prev => {
      // Flatten all letters
      const allPairs: {letter: string, isWildcard: boolean}[] = [];
      prev.forEach(block => {
        block.letters.forEach((letter, i) => {
          allPairs.push({ letter, isWildcard: block.isWildcard[i] });
        });
      });

      // Fisher-Yates shuffle
      for (let i = allPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
      }

      // Rebuild blocks (1L, 2L, 3L)
      const newQueue = [
        { letters: [allPairs[0].letter], isWildcard: [allPairs[0].isWildcard] },
        { letters: [allPairs[1].letter, allPairs[2].letter], isWildcard: [allPairs[1].isWildcard, allPairs[2].isWildcard] },
        { letters: [allPairs[3].letter, allPairs[4].letter, allPairs[5].letter], isWildcard: [allPairs[3].isWildcard, allPairs[4].isWildcard, allPairs[5].isWildcard] }
      ];

      return newQueue;
    });
  }, []);

  // Spawn the next block from queue
  const spawnBlock = useCallback(() => {
    if (blockQueue.length === 0) return;

    // Get the active block (first in queue)
    const activeBlock = blockQueue[0];
    const newBlocksPlaced = blocksPlaced + 1;

    // Determine starting column based on block size
    let col: number;
    if (activeBlock.letters.length === 3) {
      // PROPELLER: reference position is CENTER
      const minCol = 1;
      const maxCol = COLS - 2;
      col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
    } else {
      const blockWidth = activeBlock.letters.length;
      const maxCol = COLS - blockWidth;
      col = Math.floor(Math.random() * (maxCol + 1));
    }

    // Check if spawn position is blocked
    const spawnCells = activeBlock.letters.length === 3
      ? [col - 1, col, col + 1]
      : activeBlock.letters.length === 2
        ? [col, col + 1]
        : [col];

    for (const c of spawnCells) {
      if (grid[0][c]?.letter !== null) {
        setIsGameOver(true);
        return;
      }
    }

    setFallingBlock({
      letters: activeBlock.letters,
      col,
      row: 0,
      orientation: 'horizontal',
      isWildcard: activeBlock.isWildcard,
      id: getNextId(),
      blockType: 'normal'
    });

    // Slide queue left and add new block to the end
    const nextBlockType = (blockTypeSequence + 3) % 3; // Next in sequence (1L→2L→3L)
    const newBlock = generateBlock(nextBlockType);
    setBlockQueue(prev => [...prev.slice(1), newBlock]);
    setBlockTypeSequence(prev => (prev + 1) % 3);
    setBlocksPlaced(newBlocksPlaced);
  }, [blockQueue, blocksPlaced, grid, blockTypeSequence, generateBlock]);

  // Get block cells based on orientation (PROPELLER rotation for 3-letter blocks)
  const getBlockCells = useCallback((block: FallingBlock): {row: number, col: number}[] => {
    const cells: {row: number, col: number}[] = [];
    const isHorizontal = block.orientation === 'horizontal' || block.orientation === 'horizontal-reversed';

    if (block.letters.length === 1) {
      cells.push({ row: block.row, col: block.col });
    } else if (block.letters.length === 2) {
      if (isHorizontal) {
        cells.push({ row: block.row, col: block.col });
        cells.push({ row: block.row, col: block.col + 1 });
      } else {
        cells.push({ row: block.row, col: block.col });
        cells.push({ row: block.row + 1, col: block.col });
      }
    } else if (block.letters.length === 3) {
      // PROPELLER: Middle letter (index 1) stays at block.row, block.col
      if (isHorizontal) {
        cells.push({ row: block.row, col: block.col - 1 });
        cells.push({ row: block.row, col: block.col });
        cells.push({ row: block.row, col: block.col + 1 });
      } else {
        cells.push({ row: block.row - 1, col: block.col });
        cells.push({ row: block.row, col: block.col });
        cells.push({ row: block.row + 1, col: block.col });
      }
    }

    return cells;
  }, []);

  // Check if block can be placed at position
  const canPlaceBlock = useCallback((block: FallingBlock, row: number, col: number, orientation: Orientation): boolean => {
    const testBlock = { ...block, row, col, orientation };
    const cells = getBlockCells(testBlock);

    for (const cell of cells) {
      if (cell.row < 0 || cell.row >= ROWS || cell.col < 0 || cell.col >= COLS) {
        return false;
      }
      if (grid[cell.row][cell.col].letter !== null) {
        return false;
      }
    }

    return true;
  }, [grid, getBlockCells]);

  // Check if block can move down
  const canMoveDown = useCallback((block: FallingBlock): boolean => {
    const nextRow = block.row + 1;
    return canPlaceBlock(block, nextRow, block.col, block.orientation);
  }, [canPlaceBlock]);

  // Calculate ghost position (where block will land)
  const getGhostPosition = useCallback((block: FallingBlock): number => {
    let ghostRow = block.row;
    while (canPlaceBlock(block, ghostRow + 1, block.col, block.orientation)) {
      ghostRow++;
    }
    return ghostRow;
  }, [canPlaceBlock]);

  // Find best letter for wildcard
  const findBestWildcardLetter = useCallback((row: number, col: number, currentGrid: Cell[][]): string => {
    let bestLetter = 'E';
    let longestWord = 0;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (const testLetter of alphabet) {
      // Check horizontal
      let startCol = col;
      while (startCol > 0 && currentGrid[row][startCol - 1].letter !== null) startCol--;
      let endCol = col;
      while (endCol < COLS - 1 && currentGrid[row][endCol + 1].letter !== null) endCol++;

      let horizontalWord = '';
      for (let c = startCol; c <= endCol; c++) {
        horizontalWord += c === col ? testLetter : currentGrid[row][c].letter;
      }

      if (horizontalWord.length >= MIN_WORD_LENGTH && validWords.has(horizontalWord) && horizontalWord.length > longestWord) {
        longestWord = horizontalWord.length;
        bestLetter = testLetter;
      }

      // Check vertical
      let startRow = row;
      while (startRow > 0 && currentGrid[startRow - 1][col].letter !== null) startRow--;
      let endRow = row;
      while (endRow < ROWS - 1 && currentGrid[endRow + 1][col].letter !== null) endRow++;

      let verticalWord = '';
      for (let r = startRow; r <= endRow; r++) {
        verticalWord += r === row ? testLetter : currentGrid[r][col].letter;
      }

      if (verticalWord.length >= MIN_WORD_LENGTH && validWords.has(verticalWord) && verticalWord.length > longestWord) {
        longestWord = verticalWord.length;
        bestLetter = testLetter;
      }
    }

    return bestLetter;
  }, [validWords]);

  // Add points and check for level up
  const addPoints = useCallback((points: number, combo: number = 0) => {
    const comboMultiplier = combo > 1 ? 1 + (combo - 1) * 0.5 : 1;
    const finalPoints = Math.floor(points * comboMultiplier);

    setTotalScore(prev => prev + finalPoints);
    setLevelScore(prev => {
      const newScore = prev + finalPoints;
      return newScore;
    });
  }, []);

  // Check and trigger level up
  useEffect(() => {
    if (levelScore >= 500 && !showLevelUp) {
      setShowLevelUp(true);
      setLevel(prev => prev + 1);
      setGrid(createEmptyGrid());
      setFallingBlock(null);
      setVerticalScanCharges(MAX_VERTICAL_SCAN_CHARGES);
      setLevelScore(0);

      setTimeout(() => {
        setShowLevelUp(false);
      }, 2000);
    }
  }, [levelScore, showLevelUp, level]);

  // Handle Lexical Bomb explosion
  const handleLexicalBomb = useCallback((row: number, col: number) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
      if (newGrid[row][col].letter !== null) {
        newGrid[row][col].letter = getRandomCommonVowel();
      }
      return newGrid;
    });
    setLastClearedWords(['💎 LEXICAL BOMB!']);
    setTimeout(() => setLastClearedWords([]), 1500);
  }, []);

  // Handle Destroyer Bomb explosion
  const handleDestroyerBomb = useCallback((row: number, col: number) => {
    let clearedCount = 0;
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            if (newGrid[r][c].letter !== null) {
              newGrid[r][c] = { letter: null, isWildcard: false, id: 0 };
              clearedCount++;
            }
          }
        }
      }
      return newGrid;
    });
    if (clearedCount > 0) {
      addPoints(clearedCount * 2, 0);
    }
    setLastClearedWords([`💥 DESTROYER! (${clearedCount} cleared)`]);
    setTimeout(() => setLastClearedWords([]), 1500);
    setIsProcessing(true);
  }, [addPoints]);

  // Land block on grid
  const landBlock = useCallback((block: FallingBlock) => {
    if (block.blockType === 'lexical-bomb') {
      const targetRow = block.row + 1 < ROWS && grid[block.row + 1][block.col].letter !== null
        ? block.row : Math.min(block.row, ROWS - 1);
      handleLexicalBomb(targetRow, block.col);
      setFallingBlock(null);
      setIsProcessing(true);
      return;
    }

    if (block.blockType === 'destroyer-bomb') {
      handleDestroyerBomb(block.row, block.col);
      setFallingBlock(null);
      return;
    }

    const isReversed = block.orientation === 'horizontal-reversed' || block.orientation === 'vertical-reversed';
    const orderedLetters = isReversed ? [...block.letters].reverse() : block.letters;
    const orderedWildcards = isReversed ? [...block.isWildcard].reverse() : block.isWildcard;
    const cells = getBlockCells(block);

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      cells.forEach((cell, i) => {
        if (cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS) {
          newGrid[cell.row][cell.col] = {
            letter: orderedLetters[i],
            isWildcard: orderedWildcards[i],
            id: block.id + i * 0.1
          };
        }
      });
      return newGrid;
    });

    setFallingBlock(null);
    setComboCount(0);
    setIsProcessing(true);
  }, [grid, getBlockCells, findBestWildcardLetter, handleLexicalBomb, handleDestroyerBomb]);

  // Cascade gravity
  const applyCascadeGravity = useCallback((): boolean => {
    let moved = false;
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      for (let col = 0; col < COLS; col++) {
        for (let row = ROWS - 2; row >= 0; row--) {
          if (newGrid[row][col].letter !== null && newGrid[row + 1][col].letter === null) {
            let targetRow = row + 1;
            while (targetRow < ROWS - 1 && newGrid[targetRow + 1][col].letter === null) {
              targetRow++;
            }
            newGrid[targetRow][col] = { ...newGrid[row][col] };
            newGrid[row][col] = { letter: null, isWildcard: false, id: 0 };
            moved = true;
          }
        }
      }
      return newGrid;
    });
    return moved;
  }, []);

  // Check and clear completed lines
  const checkAndClearCompletedLines = useCallback((): number => {
    let pointsScored = 0;
    const wordsFound: {word: string, points: number}[] = [];
    const minLength = isFlashClearActive ? 2 : MIN_WORD_LENGTH;
    const wordsToCheck = isFlashClearActive ? new Set([...Array.from(validWords), ...Array.from(twoLetterValidWords)]) : validWords;

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));

      for (let row = 0; row < ROWS; row++) {
        let isRowComplete = true;
        for (let col = 0; col < COLS; col++) {
          if (newGrid[row][col].letter === null) {
            isRowComplete = false;
            break;
          }
        }

        if (!isRowComplete) continue;

        const rowLetters = newGrid[row].map(cell => cell.letter).join('');
        const cellsToClearInRow = new Set<number>();

        for (let startCol = 0; startCol < COLS; startCol++) {
          for (let endCol = startCol + minLength; endCol <= COLS; endCol++) {
            const word = rowLetters.substring(startCol, endCol);
            if (wordsToCheck.has(word)) {
              const wordPoints = word.length * word.length;
              wordsFound.push({word, points: wordPoints});
              pointsScored += wordPoints;
              for (let c = startCol; c < endCol; c++) {
                cellsToClearInRow.add(c);
              }
            }
          }
        }

        cellsToClearInRow.forEach(col => {
          newGrid[row][col] = { letter: null, isWildcard: false, id: 0 };
        });
      }

      if (wordsFound.length > 0) {
        const prefix = isFlashClearActive ? '⚡ ' : '';
        setLastClearedWords(wordsFound.map(w => prefix + w.word));
        setTimeout(() => setLastClearedWords([]), 1500);

        // Add to Word Ledger (deduplicate by word, keep first occurrence)
        setWordLedger(prev => {
          const uniqueWords = new Map<string, {word: string, points: number}>();
          wordsFound.forEach(w => {
            if (!uniqueWords.has(w.word)) {
              uniqueWords.set(w.word, w);
            }
          });

          const newEntries = Array.from(uniqueWords.values()).map(w => ({
            word: w.word,
            points: w.points,
            id: getNextId()
          }));
          return [...newEntries, ...prev].slice(0, 12); // Keep last 12 words
        });
      }

      return newGrid;
    });

    return pointsScored;
  }, [validWords, twoLetterValidWords, isFlashClearActive]);

  // Vertical Scan power-up
  const activateVerticalScan = useCallback(() => {
    if (verticalScanCharges <= 0 || isProcessing || isGameOver || isPaused) return;

    let pointsScored = 0;
    const wordsFound: {word: string, points: number}[] = [];

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      const cellsToClear = new Set<string>();

      for (let col = 0; col < COLS; col++) {
        let row = 0;
        while (row < ROWS) {
          if (newGrid[row][col].letter === null) {
            row++;
            continue;
          }

          let word = '';
          let startRow = row;
          while (row < ROWS && newGrid[row][col].letter !== null) {
            word += newGrid[row][col].letter;
            row++;
          }

          if (word.length >= MIN_WORD_LENGTH && validWords.has(word)) {
            const wordPoints = word.length * word.length;
            wordsFound.push({word, points: wordPoints});
            pointsScored += wordPoints;
            for (let r = startRow; r < row; r++) {
              cellsToClear.add(`${r},${col}`);
            }
          }
        }
      }

      cellsToClear.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        newGrid[r][c] = { letter: null, isWildcard: false, id: 0 };
      });

      return newGrid;
    });

    setVerticalScanCharges(prev => prev - 1);

    if (pointsScored > 0) {
      addPoints(pointsScored, 0);
      setLastClearedWords([`⚡ V-SCAN! ${wordsFound.map(w => w.word).join(', ')}`]);

      // Add to Word Ledger (deduplicate by word, keep first occurrence)
      setWordLedger(prev => {
        const uniqueWords = new Map<string, {word: string, points: number}>();
        wordsFound.forEach(w => {
          if (!uniqueWords.has(w.word)) {
            uniqueWords.set(w.word, w);
          }
        });

        const newEntries = Array.from(uniqueWords.values()).map(w => ({
          word: w.word,
          points: w.points,
          id: getNextId()
        }));
        return [...newEntries, ...prev].slice(0, 12); // Keep last 12 words
      });
    } else {
      setLastClearedWords(['⚡ V-SCAN - No words found']);
    }
    setTimeout(() => setLastClearedWords([]), 1500);
    setIsProcessing(true);
  }, [verticalScanCharges, isProcessing, isGameOver, isPaused, validWords, addPoints]);

  // Flash Clear power-up
  const activateFlashClear = useCallback(() => {
    if (isFlashClearActive || isGameOver || isPaused) return;
    setIsFlashClearActive(true);
    setFlashClearTimeLeft(FLASH_CLEAR_DURATION);
  }, [isFlashClearActive, isGameOver, isPaused]);

  // Flash Clear timer
  useEffect(() => {
    if (!isFlashClearActive) return;
    const timer = setInterval(() => {
      setFlashClearTimeLeft(prev => {
        if (prev <= 1) {
          setIsFlashClearActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFlashClearActive]);

  // Process cascade and line-completion
  useEffect(() => {
    if (!isProcessing || isGameOver || isPaused || showLevelUp) return;

    const processTimer = setTimeout(() => {
      applyCascadeGravity();
      setTimeout(() => {
        const points = checkAndClearCompletedLines();
        if (points > 0) {
          const newCombo = comboCount + 1;
          setComboCount(newCombo);
          addPoints(points, newCombo);
          setIsProcessing(true);
        } else {
          setIsProcessing(false);
          setComboCount(0);
        }
      }, 150);
    }, 100);

    return () => clearTimeout(processTimer);
  }, [isProcessing, isGameOver, isPaused, showLevelUp, applyCascadeGravity, checkAndClearCompletedLines, comboCount, addPoints]);

  // 4-Way Flip block orientation
  const flipBlock = useCallback(() => {
    if (!fallingBlock || fallingBlock.letters.length === 1 || fallingBlock.blockType !== 'normal') return;

    const orientationCycle: Orientation[] = ['horizontal', 'vertical', 'horizontal-reversed', 'vertical-reversed'];
    const currentIndex = orientationCycle.indexOf(fallingBlock.orientation);
    const nextIndex = (currentIndex + 1) % 4;
    const newOrientation = orientationCycle[nextIndex];

    const testBlock = { ...fallingBlock, orientation: newOrientation };
    const testCells = getBlockCells(testBlock);

    for (const cell of testCells) {
      if (cell.row < 0 || cell.row >= ROWS || cell.col < 0 || cell.col >= COLS) return;
      if (grid[cell.row][cell.col].letter !== null) return;
    }

    setFallingBlock(prev => prev ? { ...prev, orientation: newOrientation } : null);
  }, [fallingBlock, grid, getBlockCells]);

  // Move block
  const moveBlock = useCallback((direction: 'left' | 'right' | 'down') => {
    if (!fallingBlock || isGameOver || isPaused || isProcessing) return;

    if (direction === 'left') {
      const newCol = fallingBlock.col - 1;
      if (canPlaceBlock(fallingBlock, fallingBlock.row, newCol, fallingBlock.orientation)) {
        setFallingBlock(prev => prev ? { ...prev, col: newCol } : null);
      }
    } else if (direction === 'right') {
      const newCol = fallingBlock.col + 1;
      if (canPlaceBlock(fallingBlock, fallingBlock.row, newCol, fallingBlock.orientation)) {
        setFallingBlock(prev => prev ? { ...prev, col: newCol } : null);
      }
    } else if (direction === 'down') {
      let targetRow = fallingBlock.row;
      while (canPlaceBlock(fallingBlock, targetRow + 1, fallingBlock.col, fallingBlock.orientation)) {
        targetRow++;
      }
      setFallingBlock(prev => prev ? { ...prev, row: targetRow } : null);
    }
  }, [fallingBlock, isGameOver, isPaused, isProcessing, canPlaceBlock]);

  // Game loop
  useEffect(() => {
    if (isGameOver || isPaused || showLevelUp || isProcessing) return;

    const gameLoop = setInterval(() => {
      if (fallingBlock) {
        if (canMoveDown(fallingBlock)) {
          setFallingBlock(prev => prev ? { ...prev, row: prev.row + 1 } : null);
        } else {
          landBlock(fallingBlock);
        }
      } else if (blockQueue.length === 3) {
        setTimeout(spawnBlock, 100);
      }
    }, dropSpeed);

    return () => clearInterval(gameLoop);
  }, [fallingBlock, isGameOver, isPaused, showLevelUp, isProcessing, dropSpeed, canMoveDown, landBlock, spawnBlock, blockQueue.length]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shuffle works even during pause
      if (e.key === 's' || e.key === 'S') {
        if (!isGameOver) shuffleRack();
        return;
      }

      if (isGameOver || isPaused || isProcessing) return;

      if (e.key === 'ArrowLeft' && fallingBlock) {
        moveBlock('left');
      } else if (e.key === 'ArrowRight' && fallingBlock) {
        moveBlock('right');
      } else if (e.key === 'ArrowDown' && fallingBlock) {
        moveBlock('down');
      } else if ((e.key === 'ArrowUp' || e.key === ' ') && fallingBlock) {
        flipBlock();
      } else if (e.key === 'v' || e.key === 'V') {
        activateVerticalScan();
      } else if (e.key === 'f' || e.key === 'F') {
        activateFlashClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fallingBlock, isGameOver, isPaused, isProcessing, moveBlock, flipBlock, activateVerticalScan, activateFlashClear, shuffleRack]);

  // Rack letter selection
  const handleRackLetterClick = (blockIndex: number, letterIndex: number) => {
    if (isGameOver) return;
    
    // Clear board selection if any
    setSelectedCell(null);
    
    if (selectedRackIndex?.blockIndex === blockIndex && selectedRackIndex?.letterIndex === letterIndex) {
      setSelectedRackIndex(null);
    } else {
      setSelectedRackIndex({ blockIndex, letterIndex });
      setIsPaused(true); // Pause when selecting from rack
    }
  };

  // Real-time swap
  const handleCellClick = (row: number, col: number) => {
    if (isGameOver || grid[row][col].letter === null) return;

    // Handle Rack-to-Board swap (Bottom Row Only)
    if (selectedRackIndex !== null) {
      if (row !== ROWS - 1) return; // RESTRICT TO BOTTOM ROW

      setGrid(prevGrid => {
        const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
        const boardCell = newGrid[row][col];
        const boardLetter = boardCell.letter;
        const boardIsWildcard = boardCell.isWildcard;
        
        setBlockQueue(prevQueue => {
          const newQueue = [...prevQueue];
          const rackBlock = { ...newQueue[selectedRackIndex.blockIndex] };
          const rackLetters = [...rackBlock.letters];
          const rackWildcards = [...rackBlock.isWildcard];
          
          const rackLetter = rackLetters[selectedRackIndex.letterIndex];
          const rackIsWildcard = rackWildcards[selectedRackIndex.letterIndex];
          
          // Swap: board to rack
          rackLetters[selectedRackIndex.letterIndex] = boardLetter || '';
          rackWildcards[selectedRackIndex.letterIndex] = boardIsWildcard;
          
          newQueue[selectedRackIndex.blockIndex] = {
            letters: rackLetters,
            isWildcard: rackWildcards
          };
          return newQueue;
        });

        // Swap: rack to board
        const rackBlock = blockQueue[selectedRackIndex.blockIndex];
        const rackLetter = rackBlock.letters[selectedRackIndex.letterIndex];
        const rackIsWildcard = rackBlock.isWildcard[selectedRackIndex.letterIndex];

        newGrid[row][col] = {
          letter: rackLetter,
          isWildcard: rackIsWildcard,
          id: getNextId()
        };
        
        return newGrid;
      });
      
      // Visual feedback: flash
      setSwappedCell({ row, col });
      setTimeout(() => setSwappedCell(null), 300);
      
      setSelectedRackIndex(null);
      setIsPaused(false); // Unpause after swap
      setIsProcessing(true);
      return;
    }

    // Handle Board-to-Board swap (Only if not paused by other means)
    if (isPaused) return;

    if (selectedCell === null) {
      setSelectedCell({ row, col });
    } else {
      if (selectedCell.row === row && selectedCell.col === col) {
        setSelectedCell(null);
        return;
      }
      if (grid[row][col].letter !== null) {
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
          const temp = { ...newGrid[selectedCell.row][selectedCell.col] };
          newGrid[selectedCell.row][selectedCell.col] = { ...newGrid[row][col] };
          newGrid[row][col] = temp;
          return newGrid;
        });
        
        // Visual feedback: flash
        setSwappedCell({ row, col });
        setTimeout(() => setSwappedCell(null), 300);
        
        setIsProcessing(true);
      }
      setSelectedCell(null);
    }
  };

  // Reset game
  const resetGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setFallingBlock(null);
    setLevelScore(0);
    setTotalScore(0);
    setLevel(1);
    setBlocksPlaced(0);
    setIsGameOver(false);
    setIsPaused(false);
    setSelectedCell(null);
    setLastClearedWords([]);
    setShowLevelUp(false);
    setComboCount(0);
    setIsProcessing(false);
    setVerticalScanCharges(MAX_VERTICAL_SCAN_CHARGES);
    setIsFlashClearActive(false);
    setFlashClearTimeLeft(0);
    setBlockTypeSequence(0);
    setWordLedger([]);
    idCounter.current = 0;
    initializeBlockQueue();
  }, [initializeBlockQueue]);

  // Start game - initialize block queue
  useEffect(() => {
    if (blockQueue.length === 0 && !isGameOver && blocksPlaced === 0) {
      initializeBlockQueue();
    }
  }, [blockQueue.length, isGameOver, blocksPlaced, initializeBlockQueue]);

  // Get orientation indicator
  const getOrientationIndicator = (): string => {
    if (!fallingBlock || fallingBlock.letters.length < 2) return '';
    const letters = fallingBlock.letters;
    const isReversed = fallingBlock.orientation === 'horizontal-reversed' || fallingBlock.orientation === 'vertical-reversed';
    const isHorizontal = fallingBlock.orientation === 'horizontal' || fallingBlock.orientation === 'horizontal-reversed';
    const orderedLetters = isReversed ? [...letters].reverse() : letters;
    return isHorizontal ? orderedLetters.join('-') : orderedLetters.join('/');
  };

  // Render falling block cells
  const getFallingBlockCells = (): {row: number, col: number, letter: string, isWildcard: boolean, isBomb: BlockType}[] => {
    if (!fallingBlock) return [];
    const cells = getBlockCells(fallingBlock);
    const isReversed = fallingBlock.orientation === 'horizontal-reversed' || fallingBlock.orientation === 'vertical-reversed';
    const orderedLetters = isReversed ? [...fallingBlock.letters].reverse() : fallingBlock.letters;
    const orderedWildcards = isReversed ? [...fallingBlock.isWildcard].reverse() : fallingBlock.isWildcard;
    return cells.map((cell, i) => ({
      row: cell.row,
      col: cell.col,
      letter: orderedLetters[i],
      isWildcard: orderedWildcards[i],
      isBomb: fallingBlock.blockType
    }));
  };

  // Get ghost cells
  const getGhostCells = (): {row: number, col: number}[] => {
    if (!fallingBlock || fallingBlock.blockType !== 'normal') return [];
    const ghostRow = getGhostPosition(fallingBlock);
    if (ghostRow === fallingBlock.row) return [];
    const ghostBlock = { ...fallingBlock, row: ghostRow };
    return getBlockCells(ghostBlock);
  };

  const fallingCells = getFallingBlockCells();
  const ghostCells = getGhostCells();

  // Block labels for the rack
  // const blockLabels = ['A', 'B', 'C']; // Unused

  return (
    <div className="h-[100svh] w-full flex flex-col overflow-hidden bg-stone-900">
      {/* ===== HEADER ===== */}
      <header className="h-14 shrink-0 flex items-center justify-between px-3 bg-stone-800 border-b border-stone-700">
        <button onClick={onExit} className="p-2 text-stone-400 hover:text-stone-200 transition-colors">
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider block leading-none">Level</span>
            <span className="text-lg font-black text-amber-500 leading-none">{level}</span>
          </div>
          <div className="text-center">
            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider block leading-none">Score</span>
            <span className="text-lg font-black text-white tabular-nums leading-none">{totalScore.toLocaleString()}</span>
          </div>
          <div className="text-center">
            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider block leading-none">Next</span>
            <span className="text-lg font-black text-emerald-400 tabular-nums leading-none">{Math.max(0, 500 - levelScore)}</span>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_VERTICAL_SCAN_CHARGES }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                  i < verticalScanCharges ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : 'bg-stone-700'
                }`}
              >
                {i < verticalScanCharges && <Zap size={10} className="text-white" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setIsPaused(!isPaused)}
            disabled={isGameOver}
            className={`px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-stone-900'
            }`}
          >
            {isPaused ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button onClick={resetGame} className="p-2 text-stone-400 hover:text-stone-200 transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-start gap-3 p-2 pb-40 min-h-0 overflow-y-auto overflow-x-hidden relative">
        {/* Board Container - Scaled to fit 60vh max */}
        <div className="relative w-[calc(60vh*8/11)] h-[60vh] max-w-[320px] flex items-center justify-center shrink-0">
          {/* Notifications */}
          {lastClearedWords.length > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-full flex justify-center">
              <div className={`px-2 py-1 rounded-lg font-black text-[10px] shadow-lg animate-pulse ${
                comboCount > 1 ? 'bg-purple-500 text-white' : isFlashClearActive ? 'bg-orange-500 text-white' : 'bg-amber-500 text-stone-900'
              }`}>
                {comboCount > 1 && <span className="mr-1">🔥 CHAIN x{comboCount}!</span>}
                {lastClearedWords.map((w, i) => <span key={i}>{w} </span>)}
              </div>
            </div>
          )}

          {showLevelUp && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg">
              <div className="text-center animate-pulse">
                <div className="text-3xl font-black text-amber-400 mb-1">LEVEL {level}!</div>
                <div className="text-xs text-stone-300">Speed up! Charges restored!</div>
              </div>
            </div>
          )}

          {/* Glass Pause Overlay */}
          {isPaused && !isGameOver && (
            <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm bg-black/20 rounded-lg">
              <div className="text-3xl font-black text-white drop-shadow-lg animate-pulse">PAUSED</div>
            </div>
          )}

          {/* The Board */}
          <div
            className="grid gap-[1px] bg-stone-800 p-1 rounded-lg shadow-2xl border border-stone-700 w-full h-full relative"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const fallingCell = fallingCells.find(fc => fc.row === rowIndex && fc.col === colIndex);
              const isGhostCell = ghostCells.some(gc => gc.row === rowIndex && gc.col === colIndex);
              const displayLetter = fallingCell ? fallingCell.letter : cell.letter;
              const isWildcard = fallingCell ? fallingCell.isWildcard : cell.isWildcard;
              const isFalling = !!fallingCell;
              const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
              const isSwapped = swappedCell?.row === rowIndex && swappedCell?.col === colIndex;
              const isLightSquare = (rowIndex + colIndex) % 2 === 0;
              const bombType = fallingCell?.isBomb || 'normal';
              const isRowComplete = grid[rowIndex].every(c => c.letter !== null);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`
                    flex items-center justify-center
                    text-[10px] sm:text-xs font-black select-none
                    transition-all duration-100 h-full w-full
                    ${isLightSquare ? 'bg-stone-700' : 'bg-stone-600'}
                    ${isRowComplete && !isFalling ? 'ring-1 ring-emerald-500/50' : ''}
                    ${displayLetter ? 'cursor-pointer' : ''}
                    ${cell.letter ? 'hover:ring-2 hover:ring-amber-400/50' : ''}
                    ${isSelected ? 'ring-2 ring-yellow-400 bg-amber-900/50 z-10 scale-105' : ''}
                    ${isSwapped ? 'animate-ping bg-white ring-4 ring-white z-20' : ''}
                    ${isGhostCell && !isFalling && !displayLetter ? 'bg-indigo-900/40 ring-1 ring-indigo-500/30' : ''}
                    ${isFalling && bombType === 'normal' ? 'bg-indigo-600 ring-1 ring-indigo-400' : ''}
                    ${isFalling && bombType === 'lexical-bomb' ? 'bg-blue-500 ring-2 ring-blue-300 animate-pulse' : ''}
                    ${isFalling && bombType === 'destroyer-bomb' ? 'bg-red-500 ring-2 ring-red-300 animate-pulse' : ''}
                  `}
                >
                  {displayLetter && (
                    <span className={`
                      ${isWildcard ? 'text-amber-400' : isFalling ? 'text-white' : 'text-stone-100'}
                      ${bombType !== 'normal' ? 'text-sm' : ''}
                      drop-shadow-md
                    `}>
                      {displayLetter}
                    </span>
                  )}
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* ===== CONVEYOR BELT RACK ===== */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Conveyor Belt Pipeline */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border-2 border-amber-900/60"
            style={{
              background: 'linear-gradient(180deg, #d4a574 0%, #c4956a 50%, #b38560 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)'
            }}
          >
            {/* Active Block (Far Left) */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold mb-0.5 text-amber-900 uppercase">Active</span>
              <div className="flex gap-0.5 p-1 rounded bg-amber-100/50 ring-1 ring-amber-600">
                {blockQueue[0]?.letters.map((letter, i) => {
                  const isSelected = selectedRackIndex?.blockIndex === 0 && selectedRackIndex?.letterIndex === i;
                  return (
                    <div
                      key={i}
                      onClick={() => handleRackLetterClick(0, i)}
                      className={`w-6 h-6 flex items-center justify-center rounded font-black text-xs shadow-md cursor-pointer transition-all touch-manipulation
                        ${blockQueue[0].isWildcard[i] ? 'bg-amber-200 text-amber-700' : 'bg-amber-50 text-stone-800'}
                        ${isSelected ? 'ring-2 ring-yellow-400 scale-110 z-10' : ''}
                      `}
                      style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.5)' }}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-8 bg-amber-800/40" />

            {/* Next Block (Middle) */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold mb-0.5 text-amber-800/70 uppercase">Next</span>
              <div className="flex gap-0.5 p-0.5 rounded bg-amber-200/30">
                {blockQueue[1]?.letters.map((letter, i) => {
                  const isSelected = selectedRackIndex?.blockIndex === 1 && selectedRackIndex?.letterIndex === i;
                  return (
                    <div
                      key={i}
                      onClick={() => handleRackLetterClick(1, i)}
                      className={`w-5 h-5 flex items-center justify-center rounded font-bold text-[10px] shadow-sm cursor-pointer transition-all touch-manipulation
                        ${blockQueue[1].isWildcard[i] ? 'bg-amber-200 text-amber-700' : 'bg-amber-50 text-stone-700'}
                        ${isSelected ? 'ring-1 ring-yellow-400 scale-110 z-10' : ''}
                      `}
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-8 bg-amber-800/40" />

            {/* On-Deck Block (Far Right) */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold mb-0.5 text-amber-800/60 uppercase">On-Deck</span>
              <div className="flex gap-0.5 p-0.5 rounded bg-amber-200/20">
                {blockQueue[2]?.letters.map((letter, i) => {
                  const isSelected = selectedRackIndex?.blockIndex === 2 && selectedRackIndex?.letterIndex === i;
                  return (
                    <div
                      key={i}
                      onClick={() => handleRackLetterClick(2, i)}
                      className={`w-4 h-4 flex items-center justify-center rounded font-bold text-[8px] shadow-sm cursor-pointer transition-all touch-manipulation
                        ${blockQueue[2].isWildcard[i] ? 'bg-amber-200 text-amber-700' : 'bg-amber-50 text-stone-600'}
                        ${isSelected ? 'ring-1 ring-yellow-400 scale-110 z-10' : ''}
                      `}
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Shuffle Button */}
          <button
            onClick={shuffleRack}
            disabled={isGameOver}
            className="p-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-400 text-white shadow-lg transition-all disabled:opacity-50 touch-manipulation"
            title="Shuffle letters [S]"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Word Ledger (Hidden on small mobile if no room, or absolute) */}
        <div className="absolute right-1 top-2 w-20 flex flex-col bg-stone-800/80 backdrop-blur-sm rounded-lg border border-stone-700 p-1 overflow-hidden max-h-[120px] pointer-events-none">
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {wordLedger.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-1 py-0.5 rounded text-[8px] transition-all ${
                  index === 0 ? 'bg-amber-900/60' : 'bg-stone-700/30'
                }`}
              >
                <span className="font-bold text-stone-200 truncate">{entry.word}</span>
                <span className="font-black text-amber-400">+{entry.points}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ===== CONTROL DECK ===== */}
      <footer className="shrink-0 bg-stone-950 border-t-2 border-stone-800 px-2 pt-2 pb-6 flex flex-col fixed bottom-0 left-0 right-0 z-40">
        {/* Status Bar */}
        <div className="flex items-center justify-center gap-2 mb-2 h-4">
          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-emerald-400">FLOW: 3+ Letters</span>
            {fallingBlock && fallingBlock.letters.length >= 2 && fallingBlock.blockType === 'normal' && (
              <span className="text-indigo-400">{getOrientationIndicator()}</span>
            )}
            {fallingBlock?.blockType === 'lexical-bomb' && (
              <span className="text-blue-400 flex items-center gap-1"><Sparkles size={10} /> Lexical</span>
            )}
            {fallingBlock?.blockType === 'destroyer-bomb' && (
              <span className="text-red-400 flex items-center gap-1"><Bomb size={10} /> Destroyer</span>
            )}
            {(selectedCell || selectedRackIndex) && <span className="text-yellow-400 animate-pulse">SWAP MODE</span>}
          </div>
        </div>

        {/* Control Buttons - EXACTLY 2 ROWS */}
        <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
          {/* Row 1: LEFT, TOGGLE, RIGHT */}
          <div className="flex gap-2 h-12">
            <button
              onClick={() => moveBlock('left')}
              disabled={!fallingBlock || isGameOver || isPaused || isProcessing}
              className="flex-1 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border border-stone-700 flex items-center justify-center touch-manipulation"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              onClick={flipBlock}
              disabled={!fallingBlock || fallingBlock.letters.length === 1 || fallingBlock.blockType !== 'normal' || isGameOver || isPaused || isProcessing}
              className={`flex-1 rounded-xl font-bold transition-all border flex items-center justify-center touch-manipulation ${
                fallingBlock && fallingBlock.letters.length >= 2 && fallingBlock.blockType === 'normal'
                  ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-white border-indigo-500'
                  : 'bg-stone-800 text-stone-600 border-stone-700'
              }`}
            >
              <FlipVertical size={20} />
            </button>

            <button
              onClick={() => moveBlock('right')}
              disabled={!fallingBlock || isGameOver || isPaused || isProcessing}
              className="flex-1 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border border-stone-700 flex items-center justify-center touch-manipulation"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Row 2: V SCAN, DOWN, FLASH CLEAR */}
          <div className="flex gap-2 h-12">
            <button
              onClick={activateVerticalScan}
              disabled={verticalScanCharges <= 0 || isGameOver || isPaused || isProcessing}
              className={`flex-1 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1 touch-manipulation ${
                verticalScanCharges > 0
                  ? 'bg-cyan-900/40 hover:bg-cyan-900/60 active:bg-cyan-900/80 text-cyan-400 border-cyan-900/50'
                  : 'bg-stone-800 text-stone-600 border-stone-700 opacity-40'
              }`}
            >
              <Zap size={16} />
              <span>V-SCAN</span>
            </button>

            <button
              onClick={() => moveBlock('down')}
              disabled={!fallingBlock || isGameOver || isPaused || isProcessing}
              className="flex-1 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 border border-stone-700 flex items-center justify-center touch-manipulation"
            >
              <ChevronDown size={24} />
            </button>

            <button
              onClick={activateFlashClear}
              disabled={isFlashClearActive || isGameOver || isPaused}
              className={`flex-1 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1 touch-manipulation ${
                isFlashClearActive
                  ? 'bg-orange-900/40 text-orange-400 border-orange-900/50'
                  : 'bg-orange-900/20 hover:bg-orange-900/40 active:bg-orange-900/60 text-orange-400 border-orange-900/30'
              } disabled:opacity-50`}
            >
              <Flame size={16} />
              <span>FLASH</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ===== MODALS ===== */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-stone-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center border border-stone-700">
            <h2 className="text-3xl font-black text-stone-100 mb-2">Game Over</h2>
            <p className="text-stone-400 mb-2">Level {level}</p>
            <div className="text-5xl font-black text-amber-500 mb-8">{totalScore.toLocaleString()}</div>
            <div className="flex flex-col gap-3">
              <button
                onClick={resetGame}
                className="py-4 bg-amber-600 hover:bg-amber-500 rounded-xl text-stone-900 font-black text-lg transition-all"
              >
                Play Again
              </button>
              <button
                onClick={onExit}
                className="py-4 bg-stone-700 hover:bg-stone-600 rounded-xl text-stone-300 font-bold text-lg transition-all"
              >
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
