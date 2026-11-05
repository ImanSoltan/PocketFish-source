// The app's languages. The language comes from the phone (navigator.languages: on iOS the
// language chosen for the app, which needs the languages listed in Info.plist), or from the
// Language setting. Texts are looked up with t('key', { param }).
import { de } from './de';
import { en, type MessageKey, type Messages } from './en';
import { es } from './es';
import { fr } from './fr';

export type { MessageKey } from './en';

export const LANGUAGES = ['en', 'de', 'es', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language's own name, for the Language setting. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français' };

const MESSAGES: Record<Language, Messages> = { en, de, es, fr };

export const isLanguage = (x: unknown): x is Language => LANGUAGES.includes(x as Language);

/** The first of the user's preferred languages that the app speaks, English otherwise. */
export function detectLanguage(preferred: readonly string[] = browserLanguages()): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

let current: Language = 'en';

/** Switch the app's language: a language, or 'auto' for the phone's. */
export function setLanguage(choice: Language | 'auto'): Language {
  current = choice === 'auto' ? detectLanguage() : choice;
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  return current;
}

export const language = (): Language => current;

export const hasMessage = (key: string): key is MessageKey => key in en;

/** The text for `key` in the current language, with {placeholders} filled in. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = MESSAGES[current][key] ?? en[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
