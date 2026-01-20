export interface WordEntry {
  w: string; // The actual word (e.g., "AA")
  d?: string; // The definition (optional)
  m?: string; // Memory hook/mnemonic
}

export interface HookDetail {
  char: string;       // The valid letter (e.g., 'B')
  definition: string; // The definition of the NEW word (e.g., definition of 'BAA')
}

export interface HookData {
  word: WordEntry;        // The base 2-letter word (e.g., "AA")
  frontHooks: HookDetail[]; // List of valid front letters (B, C, F, etc.)
  backHooks: HookDetail[];  // List of valid back letters (H, L, S, etc.)
}

export enum AppMode {
  HOME = 'HOME',
  TRAINING = 'TRAINING',
  CHALLENGE = 'CHALLENGE',
  BOGEY = 'BOGEY',
  HOOKS = 'HOOKS',
  LEXTRIS = 'LEXTRIS'
}

export type WordLength = 2 | 3 | 4 | 'ALL';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// Challenge Types
export type ChallengeOrder = 'RANDOM' | 'ALPHA';

export interface ChallengeItem {
  word: string;
  isReal: boolean;
  data?: WordEntry;
}

export interface ChallengeSnapshot {
  deck: ChallengeItem[];
  index: number;
  streak: number;
  targetLength: WordLength | null;
  order: ChallengeOrder;
}
