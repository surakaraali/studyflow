import 'i18next';

import type { Translation } from './tr';

// Makes t('...') keys type-checked against the Turkish source strings.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translation };
  }
}
