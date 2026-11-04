import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import tr from './tr';

export const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

export type Language = keyof typeof resources;

// The first release ships in Turkish. A language setting comes later.
export const defaultLanguage: Language = 'tr';

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  // Strings are bundled with the app, so they are ready before the first render.
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
