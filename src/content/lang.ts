/** Interface language: English, or Hinglish written in Roman script. */
export type Lang = 'en' | 'hi';

/** A line in both languages. */
export interface Txt {
  en: string;
  hi: string;
}

export const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'Hinglish' };

export function tr(t: Txt, lang: Lang): string {
  return t[lang];
}
