/** Letters shown in the jump rail; `#` collects digits, symbols and non-Latin scripts. */
export const JUMP_LETTERS: readonly string[] = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

/** Letters that do not decompose into a base letter plus a combining mark. */
const FOLDED: Record<string, string> = { Ł: 'L', Ø: 'O', Đ: 'D', Ħ: 'H', Ð: 'D', Þ: 'T', Æ: 'A', Œ: 'O' };

/** Rail bucket of a sort key: its first letter without diacritics (Ł → L, Ö → O), or `#`. */
export function letterFor(value: string | null | undefined): string {
  const first = (value ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').charAt(0).toUpperCase();
  const folded = FOLDED[first] ?? first;
  return /^[A-Z]$/.test(folded) ? folded : '#';
}

/** Index of the first item of every letter, in the order the list is currently sorted. */
export function buildLetterIndex<T>(items: readonly T[], keyOf: (item: T) => string | null | undefined): Map<string, number> {
  const index = new Map<string, number>();
  items.forEach((item, i) => {
    const letter = letterFor(keyOf(item));
    if (!index.has(letter)) index.set(letter, i);
  });
  return index;
}
