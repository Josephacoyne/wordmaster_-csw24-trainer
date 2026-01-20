import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WordEntry } from '../types';
import { ArrowLeft, Shuffle, Pause, Play, RotateCcw, FlipVertical, ChevronDown, ChevronLeft, ChevronRight, Bomb, Sparkles } from 'lucide-react';

interface LextrisProps {
  fullDictionary: WordEntry[];
  onExit: () => void;
}

// Grid dimensions
const COLS = 8;
const ROWS = 15;

// 4-way orientation for 2-letter blocks
type Orientation = 'horizontal' | 'vertical' | 'horizontal-reversed' | 'vertical-reversed';

// Block type
type BlockType = 'normal' | 'lexical-bomb' | 'destroyer-bomb';

// Cell type for the grid
interface Cell {
  letter: string | null;
  isWildcard: boolean;
  id: number;
}

// Falling block - can be 1 or 2 letters, or a bomb
interface FallingBlock {
  letters: string[];
  col: number;
  row: number;
  orientation: Orientation;
  isWildcard: boolean[];
  id: number;
  blockType: BlockType;
}

// Letter frequency for Scrabble-like distribution
const LETTER_BAG = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ';
const VOWELS = 'AEIOU';
const COMMON_VOWELS = ['E', 'A', 'I']; // Most common vowels for Lexical Bomb

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

const Lextris: React.FC<LextrisProps> = ({ fullDictionary, onExit }) => {
  // Build valid words set for quick lookup
  const validWords = useMemo(() => {
    const words = new Set<string>();
    fullDictionary.forEach(entry => {
      if (entry.w.length >= 2 && entry.w.length <= COLS) {
        words.add(entry.w.toUpperCase());
      }
    });
    return words;
  }, [fullDictionary]);

  // Get 2-letter words for block generation
  const twoLetterWords = useMemo(() => {
    return fullDictionary
      .filter(entry => entry.w.length === 2)
      .map(entry => entry.w.toUpperCase());
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

  // Scramble mode state
  const [isScrambleMode, setIsScrambleMode] = useState(false);
  const [scrambleTimeLeft, setScrambleTimeLeft] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);

  // Processing state for cascade/combo
  const [isProcessing, setIsProcessing] = useState(false);

  // Drop speed (decreases with level)
  const baseDropSpeed = 600;
  const dropSpeed = useMemo(() => {
    return Math.max(150, baseDropSpeed * Math.pow(0.85, level - 1));
  }, [level]);

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

  // Spawn a new falling block
  const spawnBlock = useCallback(() => {
    const newBlocksPlaced = blocksPlaced + 1;
    const isEvery15th = newBlocksPlaced % 15 === 0;
    const isEvery20th = newBlocksPlaced % 20 === 0;
    const topRowsHaveBlocks = hasBlocksInTopRows();

    let blockType: BlockType = 'normal';
    let letters: string[];
    let isWildcard: boolean[];

    // Every 20th block is a bomb
    if (isEvery20th && newBlocksPlaced > 0) {
      blockType = Math.random() < 0.5 ? 'lexical-bomb' : 'destroyer-bomb';
      letters = [blockType === 'lexical-bomb' ? '💎' : '💥'];
      isWildcard = [false];
    } else {
      // Determine block type: 60% single letter, 40% two-letter word
      const isTwoLetterBlock = Math.random() < 0.4 && twoLetterWords.length > 0;

      if (isTwoLetterBlock) {
        // Pick a random 2-letter word
        const word = twoLetterWords[Math.floor(Math.random() * twoLetterWords.length)];
        letters = word.split('');
        isWildcard = [false, false];
      } else {
        // Single letter block
        let letter: string;

        if (isEvery15th) {
          letter = '?';
          isWildcard = [true];
        } else if (topRowsHaveBlocks && Math.random() < 0.3) {
          // 30% boost for vowel or blank when top rows have blocks
          if (Math.random() < 0.3) {
            letter = '?';
            isWildcard = [true];
          } else {
            letter = getRandomVowel();
            isWildcard = [false];
          }
        } else {
          letter = getRandomLetter();
          isWildcard = [false];
        }

        letters = [letter];
        if (!isWildcard) isWildcard = [false];
      }
    }

    // Determine starting column
    const isTwoLetter = letters.length === 2;
    const maxCol = isTwoLetter ? COLS - 2 : COLS - 1;
    const col = Math.floor(Math.random() * (maxCol + 1));

    // Check if spawn position is blocked
    if (grid[0][col].letter !== null) {
      setIsGameOver(true);
      return;
    }
    if (isTwoLetter && grid[0][col + 1]?.letter !== null) {
      setIsGameOver(true);
      return;
    }

    setFallingBlock({
      letters,
      col,
      row: 0,
      orientation: 'horizontal',
      isWildcard,
      id: getNextId(),
      blockType
    });
    setBlocksPlaced(newBlocksPlaced);
  }, [blocksPlaced, grid, twoLetterWords, hasBlocksInTopRows]);

  // Check if block can be placed at position
  const canPlaceBlock = useCallback((block: FallingBlock, row: number, col: number, orientation: Orientation): boolean => {
    if (block.letters.length === 1) {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
      return grid[row][col].letter === null;
    }

    // 2-letter block - check based on orientation
    const isHorizontal = orientation === 'horizontal' || orientation === 'horizontal-reversed';

    if (isHorizontal) {
      if (col < 0 || col + 1 >= COLS || row < 0 || row >= ROWS) return false;
      return grid[row][col].letter === null && grid[row][col + 1].letter === null;
    } else {
      // vertical
      if (col < 0 || col >= COLS || row < 0 || row + 1 >= ROWS) return false;
      return grid[row][col].letter === null && grid[row + 1][col].letter === null;
    }
  }, [grid]);

  // Check if block can move down
  const canMoveDown = useCallback((block: FallingBlock): boolean => {
    const nextRow = block.row + 1;
    const isHorizontal = block.orientation === 'horizontal' || block.orientation === 'horizontal-reversed';

    if (block.letters.length === 1) {
      if (nextRow >= ROWS) return false;
      return grid[nextRow][block.col].letter === null;
    }

    if (isHorizontal) {
      if (nextRow >= ROWS) return false;
      return grid[nextRow][block.col].letter === null &&
             grid[nextRow][block.col + 1].letter === null;
    } else {
      // vertical - check below the bottom letter
      if (block.row + 2 >= ROWS) return false;
      return grid[block.row + 2][block.col].letter === null;
    }
  }, [grid]);

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

      if (horizontalWord.length >= 2 && validWords.has(horizontalWord) && horizontalWord.length > longestWord) {
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

      if (verticalWord.length >= 2 && validWords.has(verticalWord) && verticalWord.length > longestWord) {
        longestWord = verticalWord.length;
        bestLetter = testLetter;
      }
    }

    return bestLetter;
  }, [validWords]);

  // Check if cells at positions are isolated (not touching other blocks)
  const isSolitaryBlock = useCallback((positions: {row: number, col: number}[], currentGrid: Cell[][]): boolean => {
    const posSet = new Set(positions.map(p => `${p.row},${p.col}`));

    for (const pos of positions) {
      // Check all 4 adjacent cells
      const adjacents = [
        { row: pos.row - 1, col: pos.col },
        { row: pos.row + 1, col: pos.col },
        { row: pos.row, col: pos.col - 1 },
        { row: pos.row, col: pos.col + 1 },
      ];

      for (const adj of adjacents) {
        // Skip if out of bounds
        if (adj.row < 0 || adj.row >= ROWS || adj.col < 0 || adj.col >= COLS) continue;
        // Skip if it's part of our own block
        if (posSet.has(`${adj.row},${adj.col}`)) continue;
        // If there's a letter here, we're not solitary
        if (currentGrid[adj.row][adj.col].letter !== null) return false;
      }
    }

    return true;
  }, []);

  // Add points and check for level up
  const addPoints = useCallback((points: number, combo: number = 0) => {
    const comboMultiplier = combo > 1 ? 1 + (combo - 1) * 0.5 : 1;
    const finalPoints = Math.floor(points * comboMultiplier);

    setLevelScore(prev => {
      const newScore = prev + finalPoints;
      if (newScore >= 500) {
        triggerLevelUp();
        return 0;
      }
      return newScore;
    });
    setTotalScore(prev => prev + finalPoints);
  }, []);

  // Trigger level up
  const triggerLevelUp = useCallback(() => {
    setShowLevelUp(true);
    setLevel(prev => prev + 1);
    setGrid(createEmptyGrid());
    setFallingBlock(null);

    setTimeout(() => {
      setShowLevelUp(false);
    }, 2000);
  }, []);

  // Handle Lexical Bomb explosion - convert hit letter to common vowel
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

  // Handle Destroyer Bomb explosion - 3x3 area clear
  const handleDestroyerBomb = useCallback((row: number, col: number) => {
    let clearedCount = 0;

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));

      // Clear 3x3 area around impact point
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

    // Trigger cascade after explosion
    setIsProcessing(true);
  }, [addPoints]);

  // Land block on grid
  const landBlock = useCallback((block: FallingBlock) => {
    // Handle bombs
    if (block.blockType === 'lexical-bomb') {
      const targetRow = block.row + 1 < ROWS && grid[block.row + 1][block.col].letter !== null
        ? block.row
        : Math.min(block.row, ROWS - 1);
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

    // Get the letters in correct order based on orientation
    const isReversed = block.orientation === 'horizontal-reversed' || block.orientation === 'vertical-reversed';
    const orderedLetters = isReversed ? [...block.letters].reverse() : block.letters;
    const orderedWildcards = isReversed ? [...block.isWildcard].reverse() : block.isWildcard;

    const isHorizontal = block.orientation === 'horizontal' || block.orientation === 'horizontal-reversed';

    // Calculate positions
    const positions: {row: number, col: number}[] = [];
    if (block.letters.length === 1) {
      positions.push({ row: block.row, col: block.col });
    } else if (isHorizontal) {
      positions.push({ row: block.row, col: block.col });
      positions.push({ row: block.row, col: block.col + 1 });
    } else {
      positions.push({ row: block.row, col: block.col });
      positions.push({ row: block.row + 1, col: block.col });
    }

    // Check for Solitary Word Rule (2-letter blocks only)
    if (block.letters.length === 2) {
      const word = orderedLetters.join('');
      const tempGrid = grid.map(r => r.map(c => ({ ...c })));

      // Place temporarily to check isolation
      positions.forEach((pos, i) => {
        tempGrid[pos.row][pos.col] = {
          letter: orderedLetters[i],
          isWildcard: orderedWildcards[i],
          id: block.id + i * 0.5
        };
      });

      if (validWords.has(word) && isSolitaryBlock(positions, tempGrid)) {
        // Solitary valid word - score and don't place
        const points = word.length * word.length;
        addPoints(points, 0);
        setLastClearedWords([`${word} (Solitary!) +${points}`]);
        setTimeout(() => setLastClearedWords([]), 1500);
        setFallingBlock(null);
        return;
      }
    }

    // Normal landing
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));

      if (block.letters.length === 1) {
        let letter = orderedLetters[0];
        if (orderedWildcards[0]) {
          letter = findBestWildcardLetter(block.row, block.col, newGrid);
        }
        newGrid[block.row][block.col] = {
          letter,
          isWildcard: orderedWildcards[0],
          id: block.id
        };
      } else {
        positions.forEach((pos, i) => {
          newGrid[pos.row][pos.col] = {
            letter: orderedLetters[i],
            isWildcard: orderedWildcards[i],
            id: block.id + i * 0.5
          };
        });
      }

      return newGrid;
    });

    setFallingBlock(null);
    setComboCount(0);
    setIsProcessing(true);
  }, [grid, findBestWildcardLetter, validWords, isSolitaryBlock, addPoints, handleLexicalBomb, handleDestroyerBomb]);

  // Cascade gravity - returns true if any blocks moved
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

  // Find and clear words - returns points scored
  const findAndClearWords = useCallback((): number => {
    let pointsScored = 0;
    const wordsFound: string[] = [];

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      const cellsToClear = new Set<string>();

      // Check horizontal words
      for (let row = 0; row < ROWS; row++) {
        let col = 0;
        while (col < COLS) {
          if (newGrid[row][col].letter === null) {
            col++;
            continue;
          }

          let word = '';
          let startCol = col;
          while (col < COLS && newGrid[row][col].letter !== null) {
            word += newGrid[row][col].letter;
            col++;
          }

          if (word.length >= 2 && validWords.has(word)) {
            wordsFound.push(word);
            const points = word.length * word.length;
            pointsScored += points;
            for (let c = startCol; c < col; c++) {
              cellsToClear.add(`${row},${c}`);
            }
          }
        }
      }

      // Check vertical words
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

          if (word.length >= 2 && validWords.has(word)) {
            if (!wordsFound.includes(word) || word.length > 2) {
              wordsFound.push(word);
              const points = word.length * word.length;
              pointsScored += points;
            }
            for (let r = startRow; r < row; r++) {
              cellsToClear.add(`${r},${col}`);
            }
          }
        }
      }

      // Check for 8-letter bingo
      for (let row = 0; row < ROWS; row++) {
        let fullRow = '';
        for (let col = 0; col < COLS; col++) {
          if (newGrid[row][col].letter) {
            fullRow += newGrid[row][col].letter;
          }
        }
        if (fullRow.length === COLS && validWords.has(fullRow)) {
          wordsFound.push(`BINGO: ${fullRow}`);
          pointsScored += 64;
        }
      }

      if (cellsToClear.size > 0) {
        cellsToClear.forEach(key => {
          const [r, c] = key.split(',').map(Number);
          newGrid[r][c] = { letter: null, isWildcard: false, id: 0 };
        });

        setLastClearedWords(wordsFound);
        setTimeout(() => setLastClearedWords([]), 1500);
      }

      return newGrid;
    });

    return pointsScored;
  }, [validWords]);

  // Process cascade and combos
  useEffect(() => {
    if (!isProcessing || isGameOver || isPaused || showLevelUp) return;

    const processTimer = setTimeout(() => {
      // Apply gravity
      applyCascadeGravity();

      // Small delay then check for words
      setTimeout(() => {
        const points = findAndClearWords();

        if (points > 0) {
          const newCombo = comboCount + 1;
          setComboCount(newCombo);
          addPoints(points, newCombo);

          // Continue processing for more combos
          setIsProcessing(true);
        } else {
          // No more words, done processing
          setIsProcessing(false);
          setComboCount(0);
        }
      }, 150);
    }, 100);

    return () => clearTimeout(processTimer);
  }, [isProcessing, isGameOver, isPaused, showLevelUp, applyCascadeGravity, findAndClearWords, comboCount, addPoints]);

  // 4-Way Flip block orientation
  const flipBlock = useCallback(() => {
    if (!fallingBlock || fallingBlock.letters.length === 1 || fallingBlock.blockType !== 'normal') return;

    // Cycle: horizontal -> vertical -> horizontal-reversed -> vertical-reversed -> horizontal
    const orientationCycle: Orientation[] = ['horizontal', 'vertical', 'horizontal-reversed', 'vertical-reversed'];
    const currentIndex = orientationCycle.indexOf(fallingBlock.orientation);
    const nextIndex = (currentIndex + 1) % 4;
    const newOrientation = orientationCycle[nextIndex];

    const isHorizontalNew = newOrientation === 'horizontal' || newOrientation === 'horizontal-reversed';

    // Check if new orientation is possible
    if (isHorizontalNew) {
      // Need space to the right
      if (fallingBlock.col + 1 >= COLS) return;
      if (grid[fallingBlock.row][fallingBlock.col + 1].letter !== null) return;
    } else {
      // Need space below
      if (fallingBlock.row + 1 >= ROWS) return;
      if (grid[fallingBlock.row + 1][fallingBlock.col].letter !== null) return;
    }

    setFallingBlock(prev => prev ? { ...prev, orientation: newOrientation } : null);
  }, [fallingBlock, grid]);

  // Move block
  const moveBlock = useCallback((direction: 'left' | 'right' | 'down') => {
    if (!fallingBlock || isGameOver || isPaused || isScrambleMode || isProcessing) return;

    const isHorizontal = fallingBlock.orientation === 'horizontal' || fallingBlock.orientation === 'horizontal-reversed';

    if (direction === 'left') {
      const newCol = fallingBlock.col - 1;
      if (canPlaceBlock(fallingBlock, fallingBlock.row, newCol, fallingBlock.orientation)) {
        setFallingBlock(prev => prev ? { ...prev, col: newCol } : null);
      }
    } else if (direction === 'right') {
      let newCol = fallingBlock.col + 1;
      if (fallingBlock.letters.length === 2 && isHorizontal) {
        if (newCol + 1 >= COLS) return;
      }
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
  }, [fallingBlock, isGameOver, isPaused, isScrambleMode, isProcessing, canPlaceBlock]);

  // Game loop
  useEffect(() => {
    if (isGameOver || isPaused || isScrambleMode || showLevelUp || isProcessing) return;

    const gameLoop = setInterval(() => {
      if (fallingBlock) {
        if (canMoveDown(fallingBlock)) {
          setFallingBlock(prev => prev ? { ...prev, row: prev.row + 1 } : null);
        } else {
          landBlock(fallingBlock);
        }
      } else {
        setTimeout(spawnBlock, 100);
      }
    }, dropSpeed);

    return () => clearInterval(gameLoop);
  }, [fallingBlock, isGameOver, isPaused, isScrambleMode, showLevelUp, isProcessing, dropSpeed, canMoveDown, landBlock, spawnBlock]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver || isPaused || isScrambleMode || !fallingBlock || isProcessing) return;

      if (e.key === 'ArrowLeft') {
        moveBlock('left');
      } else if (e.key === 'ArrowRight') {
        moveBlock('right');
      } else if (e.key === 'ArrowDown') {
        moveBlock('down');
      } else if (e.key === 'ArrowUp' || e.key === ' ') {
        flipBlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fallingBlock, isGameOver, isPaused, isScrambleMode, isProcessing, moveBlock, flipBlock]);

  // Scramble timer
  useEffect(() => {
    if (!isScrambleMode) return;

    const timer = setInterval(() => {
      setScrambleTimeLeft(prev => {
        if (prev <= 1) {
          setIsScrambleMode(false);
          setSelectedCell(null);
          // Trigger processing after scramble ends
          setIsProcessing(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isScrambleMode]);

  // Activate scramble
  const activateScramble = () => {
    if (isScrambleMode || isProcessing) return;
    setIsScrambleMode(true);
    setScrambleTimeLeft(10);
    setSelectedCell(null);
  };

  // Handle cell click in scramble mode
  const handleCellClick = (row: number, col: number) => {
    if (!isScrambleMode || grid[row][col].letter === null) return;

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
      }
      setSelectedCell(null);
    }
  };

  // Reset game
  const resetGame = () => {
    setGrid(createEmptyGrid());
    setFallingBlock(null);
    setLevelScore(0);
    setTotalScore(0);
    setLevel(1);
    setBlocksPlaced(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsScrambleMode(false);
    setScrambleTimeLeft(0);
    setSelectedCell(null);
    setLastClearedWords([]);
    setShowLevelUp(false);
    setComboCount(0);
    setIsProcessing(false);
    idCounter.current = 0;
  };

  // Start game
  useEffect(() => {
    if (!fallingBlock && !isGameOver && blocksPlaced === 0 && !isProcessing) {
      spawnBlock();
    }
  }, []);

  // Get orientation indicator text
  const getOrientationIndicator = (): string => {
    if (!fallingBlock || fallingBlock.letters.length !== 2) return '';
    const [a, b] = fallingBlock.letters;
    switch (fallingBlock.orientation) {
      case 'horizontal': return `${a}-${b}`;
      case 'vertical': return `${a}/${b}`;
      case 'horizontal-reversed': return `${b}-${a}`;
      case 'vertical-reversed': return `${b}/${a}`;
    }
  };

  // Render falling block cells
  const getFallingBlockCells = (): {row: number, col: number, letter: string, isWildcard: boolean, isBomb: BlockType}[] => {
    if (!fallingBlock) return [];

    const cells: {row: number, col: number, letter: string, isWildcard: boolean, isBomb: BlockType}[] = [];
    const isReversed = fallingBlock.orientation === 'horizontal-reversed' || fallingBlock.orientation === 'vertical-reversed';
    const isHorizontal = fallingBlock.orientation === 'horizontal' || fallingBlock.orientation === 'horizontal-reversed';

    const orderedLetters = isReversed ? [...fallingBlock.letters].reverse() : fallingBlock.letters;
    const orderedWildcards = isReversed ? [...fallingBlock.isWildcard].reverse() : fallingBlock.isWildcard;

    if (fallingBlock.letters.length === 1) {
      cells.push({
        row: fallingBlock.row,
        col: fallingBlock.col,
        letter: orderedLetters[0],
        isWildcard: orderedWildcards[0],
        isBomb: fallingBlock.blockType
      });
    } else {
      if (isHorizontal) {
        cells.push({
          row: fallingBlock.row,
          col: fallingBlock.col,
          letter: orderedLetters[0],
          isWildcard: orderedWildcards[0],
          isBomb: fallingBlock.blockType
        });
        cells.push({
          row: fallingBlock.row,
          col: fallingBlock.col + 1,
          letter: orderedLetters[1],
          isWildcard: orderedWildcards[1],
          isBomb: fallingBlock.blockType
        });
      } else {
        cells.push({
          row: fallingBlock.row,
          col: fallingBlock.col,
          letter: orderedLetters[0],
          isWildcard: orderedWildcards[0],
          isBomb: fallingBlock.blockType
        });
        cells.push({
          row: fallingBlock.row + 1,
          col: fallingBlock.col,
          letter: orderedLetters[1],
          isWildcard: orderedWildcards[1],
          isBomb: fallingBlock.blockType
        });
      }
    }

    return cells;
  };

  const fallingCells = getFallingBlockCells();

  return (
    <div className="h-[100svh] w-full flex flex-col overflow-hidden bg-stone-900">
      {/* ===== HEADER (Fixed Height) ===== */}
      <header className="h-14 shrink-0 flex items-center justify-between px-3 bg-stone-800 border-b border-stone-700">
        <button onClick={onExit} className="p-2 text-stone-400 hover:text-stone-200 transition-colors">
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-6">
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
            <span className="text-lg font-black text-emerald-400 tabular-nums leading-none">{500 - levelScore}</span>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setIsPaused(!isPaused)}
            disabled={isGameOver || isScrambleMode}
            className="p-2 text-stone-400 hover:text-stone-200 transition-colors disabled:opacity-50"
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button onClick={resetGame} className="p-2 text-stone-400 hover:text-stone-200 transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {/* ===== GAME BOARD (Flex Grow - Takes Remaining Space) ===== */}
      <main className="flex-grow flex items-center justify-center p-2 min-h-0 overflow-hidden relative">
        {/* Word cleared notification */}
        {lastClearedWords.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <div className={`px-3 py-1.5 rounded-lg font-black text-sm shadow-lg animate-pulse ${
              comboCount > 1 ? 'bg-purple-500 text-white' : 'bg-amber-500 text-stone-900'
            }`}>
              {comboCount > 1 && <span className="mr-2">🔥 COMBO x{comboCount}!</span>}
              {lastClearedWords.map((w, i) => (
                <span key={i}>{w} </span>
              ))}
            </div>
          </div>
        )}

        {/* Level Up notification */}
        {showLevelUp && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center animate-pulse">
              <div className="text-5xl font-black text-amber-400 mb-2">LEVEL {level}!</div>
              <div className="text-lg text-stone-300">Speed increased!</div>
            </div>
          </div>
        )}

        {/* The Board */}
        <div
          className="grid gap-px bg-stone-800 p-1 rounded-lg shadow-2xl border border-stone-700 max-h-full w-auto"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            aspectRatio: `${COLS}/${ROWS}`,
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const fallingCell = fallingCells.find(fc => fc.row === rowIndex && fc.col === colIndex);
              const displayLetter = fallingCell ? fallingCell.letter : cell.letter;
              const isWildcard = fallingCell ? fallingCell.isWildcard : cell.isWildcard;
              const isFalling = !!fallingCell;
              const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
              const isLightSquare = (rowIndex + colIndex) % 2 === 0;
              const bombType = fallingCell?.isBomb || 'normal';

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`
                    aspect-square flex items-center justify-center
                    text-xs sm:text-sm md:text-base font-black select-none
                    transition-all duration-100
                    w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8
                    ${isLightSquare ? 'bg-stone-700' : 'bg-stone-600'}
                    ${displayLetter ? 'cursor-pointer' : ''}
                    ${isScrambleMode && cell.letter ? 'hover:ring-2 hover:ring-amber-400' : ''}
                    ${isSelected ? 'ring-2 ring-amber-400 bg-amber-900/50' : ''}
                    ${isFalling && bombType === 'normal' ? 'bg-indigo-600 ring-1 ring-indigo-400' : ''}
                    ${isFalling && bombType === 'lexical-bomb' ? 'bg-blue-500 ring-2 ring-blue-300 animate-pulse' : ''}
                    ${isFalling && bombType === 'destroyer-bomb' ? 'bg-red-500 ring-2 ring-red-300 animate-pulse' : ''}
                  `}
                >
                  {displayLetter && (
                    <span className={`
                      ${isWildcard ? 'text-amber-400' : isFalling ? 'text-white' : 'text-stone-100'}
                      ${bombType !== 'normal' ? 'text-lg' : ''}
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
      </main>

      {/* ===== CONTROL DECK (Fixed Height at Bottom) ===== */}
      <footer className="h-44 shrink-0 bg-stone-800 border-t-2 border-stone-700 px-3 pt-2 pb-4 flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center justify-center gap-4 mb-2 h-6">
          {isScrambleMode ? (
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Shuffle size={14} />
              <span>SCRAMBLE: {scrambleTimeLeft}s - Tap to swap</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-stone-500 text-xs uppercase tracking-wider">
              <span>Bomb in {20 - (blocksPlaced % 20)}</span>
              {fallingBlock && fallingBlock.letters.length === 2 && fallingBlock.blockType === 'normal' && (
                <span className="text-indigo-400 font-bold">{getOrientationIndicator()}</span>
              )}
              {fallingBlock?.blockType === 'lexical-bomb' && (
                <span className="text-blue-400 flex items-center gap-1"><Sparkles size={12} /> Lexical</span>
              )}
              {fallingBlock?.blockType === 'destroyer-bomb' && (
                <span className="text-red-400 flex items-center gap-1"><Bomb size={12} /> Destroyer</span>
              )}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex-grow grid grid-cols-4 grid-rows-2 gap-2 max-w-md mx-auto w-full">
          <button
            onClick={() => moveBlock('left')}
            disabled={!fallingBlock || isGameOver || isPaused || isScrambleMode || isProcessing}
            className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 rounded-xl text-stone-300 font-black disabled:opacity-30 transition-all border border-stone-600 flex items-center justify-center touch-manipulation"
          >
            <ChevronLeft size={32} />
          </button>

          <button
            onClick={() => moveBlock('down')}
            disabled={!fallingBlock || isGameOver || isPaused || isScrambleMode || isProcessing}
            className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 rounded-xl text-stone-300 font-black disabled:opacity-30 transition-all border border-stone-600 flex items-center justify-center touch-manipulation"
          >
            <ChevronDown size={32} />
          </button>

          <button
            onClick={() => moveBlock('right')}
            disabled={!fallingBlock || isGameOver || isPaused || isScrambleMode || isProcessing}
            className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 rounded-xl text-stone-300 font-black disabled:opacity-30 transition-all border border-stone-600 flex items-center justify-center touch-manipulation"
          >
            <ChevronRight size={32} />
          </button>

          <button
            onClick={flipBlock}
            disabled={!fallingBlock || fallingBlock.letters.length === 1 || fallingBlock.blockType !== 'normal' || isGameOver || isPaused || isScrambleMode || isProcessing}
            className={`rounded-xl font-bold transition-all border flex items-center justify-center touch-manipulation ${
              fallingBlock && fallingBlock.letters.length === 2 && fallingBlock.blockType === 'normal'
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-white border-indigo-500'
                : 'bg-stone-700 text-stone-500 border-stone-600 opacity-40'
            }`}
          >
            <FlipVertical size={28} />
          </button>

          <button
            onClick={activateScramble}
            disabled={isScrambleMode || isGameOver || isProcessing}
            className={`col-span-4 rounded-xl font-black text-lg transition-all border flex items-center justify-center gap-2 touch-manipulation ${
              isScrambleMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-400 text-stone-900 border-amber-500'
            } disabled:opacity-50`}
          >
            <Shuffle size={24} />
            <span>SCRAMBLE MODE</span>
          </button>
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

      {isPaused && !isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-stone-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center border border-stone-700">
            <h2 className="text-3xl font-black text-stone-100 mb-6">Paused</h2>
            <button
              onClick={() => setIsPaused(false)}
              className="py-4 px-8 bg-amber-600 hover:bg-amber-500 rounded-xl text-stone-900 font-black text-lg transition-all"
            >
              Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lextris;
