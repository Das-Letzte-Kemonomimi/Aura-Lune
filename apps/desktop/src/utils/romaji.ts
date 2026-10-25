/**
 * Silnik transliteracji japońskich tekstów na alfabet łaciński (Hepburn Romanization).
 * Obsługuje Hiraganę, Katakanę, digrafy (Youon), podwójne spółgłoski (Sokuon) i przedłużenia.
 */

// Złożone digrafy Youon (Hiragana + małe ya/yu/yo/a/i/u/e/o)
const HIRAGANA_DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  しぇ: 'she', ちぇ: 'che',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  てぃ: 'ti', でぃ: 'di',
};

// Złożone digrafy Katakana
const KATAKANA_DIGRAPHS: Record<string, string> = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo',
  シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho',
  ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju', ジョ: 'jo',
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo',
  ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  シェ: 'she', チェ: 'che',
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo',
  ティ: 'ti', ディ: 'di',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo',
  ヴァ: 'va', ヴィ: 'vi', ヴ: 'vu', ヴェ: 've', ヴォ: 'vo',
};

// Pojedyncze znaki Hiragana
const HIRAGANA_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
};

// Pojedyncze znaki Katakana
const KATAKANA_MAP: Record<string, string> = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'wo', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
  ャ: 'ya', ュ: 'yu', ョ: 'yo',
  ヴ: 'vu',
};

// Japońskie znaki interpunkcyjne
const JAPANESE_PUNCTUATION: Record<string, string> = {
  '、': ', ',
  '。': '. ',
  '！': '! ',
  '？': '? ',
  '「': '"',
  '」': '"',
  '『': "'",
  '』': "'",
  '・': ' ',
  '〜': '~',
  '～': '~',
  '　': ' ',
};

/**
 * Sprawdza, czy ciąg znaków zawiera japońskie pismo (Hiragana, Katakana lub Kanji).
 */
export function hasJapaneseCharacters(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * Transliteruje japoński tekst (Hiragana, Katakana) do alfabetu łacińskiego (Hepburn Romaji).
 * Znaki łacińskie, cyfry i znaki bez bezpośredniego odpowiednika są zachowywane.
 */
export function toRomaji(input: string): string {
  if (!input) return '';

  let result = '';
  let i = 0;
  let lastChar = '';

  while (i < input.length) {
    const char = input[i];
    const nextChar = i + 1 < input.length ? input[i + 1] : '';
    const twoChars = char + nextChar;

    // Sprawdzenie interpunkcji japońskiej
    if (JAPANESE_PUNCTUATION[char]) {
      result += JAPANESE_PUNCTUATION[char];
      lastChar = '';
      i++;
      continue;
    }

    // Sprawdzenie przedłużenia Katakany (Choonpu ー)
    if (char === 'ー') {
      if (lastChar && /[aiueo]/.test(lastChar)) {
        result += lastChar;
      } else {
        result += '-';
      }
      i++;
      continue;
    }

    // Sprawdzenie sokuon (małe tsu っ / ッ)
    if (char === 'っ' || char === 'ッ') {
      // Podwojenie spółgłoski następnego znaku
      if (i + 1 < input.length) {
        // Peek ahead następnej sylaby
        let nextRomaji = '';
        if (i + 2 < input.length && (HIRAGANA_DIGRAPHS[input.substring(i + 1, i + 3)] || KATAKANA_DIGRAPHS[input.substring(i + 1, i + 3)])) {
          nextRomaji = HIRAGANA_DIGRAPHS[input.substring(i + 1, i + 3)] || KATAKANA_DIGRAPHS[input.substring(i + 1, i + 3)];
        } else if (HIRAGANA_MAP[nextChar] || KATAKANA_MAP[nextChar]) {
          nextRomaji = HIRAGANA_MAP[nextChar] || KATAKANA_MAP[nextChar];
        }

        if (nextRomaji && nextRomaji.length > 0) {
          const firstLetter = nextRomaji[0].toLowerCase();
          if (firstLetter === 'c' && nextRomaji.startsWith('ch')) {
            result += 't'; // tch dla ch (np. mat-cha)
          } else if (/[bcdfghjklmnpqrstvwxyz]/.test(firstLetter)) {
            result += firstLetter;
          }
        }
      }
      i++;
      continue;
    }

    // Sprawdzenie dwuznaków (Digraphs)
    if (twoChars && (HIRAGANA_DIGRAPHS[twoChars] || KATAKANA_DIGRAPHS[twoChars])) {
      const romaji = HIRAGANA_DIGRAPHS[twoChars] || KATAKANA_DIGRAPHS[twoChars];
      result += romaji;
      lastChar = romaji[romaji.length - 1];
      i += 2;
      continue;
    }

    // Sprawdzenie pojedynczych znaków Hiragana / Katakana
    if (HIRAGANA_MAP[char] || KATAKANA_MAP[char]) {
      const romaji = HIRAGANA_MAP[char] || KATAKANA_MAP[char];
      result += romaji;
      lastChar = romaji[romaji.length - 1];
      i++;
      continue;
    }

    // Standardowe znaki (alfabet łaciński, spacje, liczby, Kanji)
    result += char;
    lastChar = /[a-zA-Z]/.test(char) ? char.toLowerCase() : '';
    i++;
  }

  // Uporządkowanie podwójnych spacji
  return result.replace(/\s+/g, ' ').trim();
}
