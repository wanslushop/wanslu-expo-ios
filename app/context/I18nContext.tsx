import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useLangCurrency } from './LangCurrencyContext';

// Import all translation files
import arTranslations from '../i18n/translations/ar.json';
import deTranslations from '../i18n/translations/de.json';
import enTranslations from '../i18n/translations/en.json';
import esTranslations from '../i18n/translations/es.json';
import frTranslations from '../i18n/translations/fr.json';
import itTranslations from '../i18n/translations/it.json';
import jaTranslations from '../i18n/translations/ja.json';
import koTranslations from '../i18n/translations/ko.json';
import ptTranslations from '../i18n/translations/pt.json';
import ruTranslations from '../i18n/translations/ru.json';
import zhTranslations from '../i18n/translations/zh.json';
import zhHansTranslations from '../i18n/translations/zhhans.json';
// Type for translation keys
type TranslationKey = string;

// Type for nested translation objects
type NestedTranslation = {
  [key: string]: string | NestedTranslation;
};

// Type for all translations
type Translations = {
  [language: string]: NestedTranslation;
};

// Available translations
const translations: Translations = {
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  ru: ruTranslations,
  zh: zhTranslations,
  'zh-hans': zhHansTranslations,
  ar: arTranslations,
  pt: ptTranslations,
  de: deTranslations,
  ja: jaTranslations,
  ko: koTranslations,
  it: itTranslations,
};

interface I18nContextType {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Helper function to get nested translation
const getNestedTranslation = (obj: NestedTranslation, key: string): string => {
  const keys = key.split('.');
  let current = obj;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k] as NestedTranslation;
    } else {
      return key; // Return key if translation not found
    }
  }
  
  return typeof current === 'string' ? current : key;
};

// Helper function to interpolate parameters
const interpolate = (text: string, params?: Record<string, string | number>): string => {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key]?.toString() || match;
  });
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useLangCurrency();
  const [isLoading, setIsLoading] = useState(false);

  // Debug: Log language changes
  useEffect(() => {
    console.log('I18n: Language changed to:', language);
  }, [language]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const currentTranslations = translations[language] || translations.en;
    const translation = getNestedTranslation(currentTranslations, key);
    return interpolate(translation, params);
  };

  const handleSetLanguage = async (lang: string) => {
    console.log('I18n: Setting language to:', lang);
    setIsLoading(true);
    try {
      await setLanguage(lang);
      console.log('I18n: Language set successfully to:', lang);
    } catch (error) {
      console.error('I18n: Error setting language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: I18nContextType = {
    t,
    language,
    setLanguage: handleSetLanguage,
    isLoading,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};
