import { WordEntry, HookData, HookDetail } from '../types';

export const generateHookData = (fullDictionary: WordEntry[]): HookData[] => {
  // 1. Get all valid 2-letter words
  const twoLetterWords = fullDictionary.filter(w => w.w.length === 2);
  
  // 2. Create a Map of all 3-letter words for fast lookup
  // We map "WORD" -> "Definition"
  const threeLetterMap = new Map<string, string>();
  fullDictionary.forEach(w => {
    if (w.w.length === 3) {
      threeLetterMap.set(w.w, w.d || '');
    }
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  const results: HookData[] = [];

  // 3. For each 2-letter word, calculate valid hooks
  twoLetterWords.forEach(baseWord => {
    const frontHooks: HookDetail[] = [];
    const backHooks: HookDetail[] = [];

    alphabet.forEach(letter => {
      // CHECK FRONT: (Letter + Word) e.g. "A" + "AH" = "AAH"
      const frontTest = letter + baseWord.w;
      if (threeLetterMap.has(frontTest)) {
        frontHooks.push({
          char: letter,
          definition: threeLetterMap.get(frontTest) || ''
        });
      }

      // CHECK BACK: (Word + Letter) e.g. "AH" + "A" = "AHA"
      const backTest = baseWord.w + letter;
      if (threeLetterMap.has(backTest)) {
        backHooks.push({
          char: letter,
          definition: threeLetterMap.get(backTest) || ''
        });
      }
    });

    // Only add to deck if it actually has hooks (almost all do)
    if (frontHooks.length > 0 || backHooks.length > 0) {
      results.push({
        word: baseWord,
        frontHooks,
        backHooks
      });
    }
  });

  // 4. Sort alphabetically by the 2-letter word
  return results.sort((a, b) => a.word.w.localeCompare(b.word.w));
};
