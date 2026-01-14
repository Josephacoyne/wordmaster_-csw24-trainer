// Define what a "Word" looks like in our app
export interface WordEntry {
  w: string; // The actual word (e.g., "AA")
  d?: string; // The definition (optional)
}

// Define the shape of our Hook Data
export interface HookDetail {
  char: string;       // The valid letter (e.g., 'B')
  definition: string; // The definition of the NEW word (e.g., definition of 'BAA')
}

export interface HookData {
  word: WordEntry;        // The base 2-letter word (e.g., "AA")
  frontHooks: HookDetail[]; // List of valid front letters (B, C, F, etc.)
  backHooks: HookDetail[];  // List of valid back letters (H, L, S, etc.)
}

// ✅ CHANGED: This is now an Enum so 'AppMode.HOME' works in your code
export enum AppMode {
  HOME = 'HOME',
  TRAINING = 'TRAINING',
  CHALLENGE = 'CHALLENGE',
  BOGEY = 'BOGEY',
  HOOKS = 'HOOKS'
}

export type WordLength = 2 | 3 | 4;
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';