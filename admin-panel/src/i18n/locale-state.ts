export type AdminLocale = 'ru' | 'tj';

let activeLocale: AdminLocale = 'ru';

export function setActiveLocale(locale: AdminLocale) {
  activeLocale = locale;
}

export function getActiveLocale(): AdminLocale {
  return activeLocale;
}
