import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ru, type RuStrings } from '../i18n/ru';
import { tj } from '../i18n/tj';

export type AdminLocale = 'ru' | 'tj';

const STORAGE_KEY = 'ruznamo_admin_locale';

type LocaleContextValue = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  strings: RuStrings;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'tj' ? 'tj' : 'ru';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === 'tj' ? 'tg' : 'ru';
    import('../i18n').then(({ setActiveLocale }) => setActiveLocale(locale));
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: setLocaleState,
      strings: locale === 'tj' ? tj : ru,
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

export function useStrings() {
  return useLocale().strings;
}
