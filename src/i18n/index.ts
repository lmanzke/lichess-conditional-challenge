import { createI18n } from 'vue-i18n';
import { de, en } from './messages';

const supported = ['en', 'de'] as const;
type Locale = (typeof supported)[number];

/** The language of the page (lichess sets it on <html>), then the browser's languages, then English. */
const detectLocale = (): Locale => {
  const candidates = [document.documentElement.lang, ...navigator.languages].map(tag => tag.slice(0, 2).toLowerCase());
  return supported.find(locale => candidates.includes(locale)) ?? 'en';
};

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, de },
});

export type Translate = (key: string, named?: Record<string, unknown>) => string;
