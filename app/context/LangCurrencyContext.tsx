// LangCurrencyContext - Language and Currency Management
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const LANG_CURRENCY_KEY = 'lang-currency';
const GEO_DATA_KEY = 'geo-data';

const countryToLanguage: Record<string, string> = {
  US: 'en',
  ES: 'es',
  CN: 'zh',
  HK: 'zh-hans',
  AR: 'ar',
  FR: 'fr',
  PT: 'pt',
  RU: 'ru',
  DE: 'de',
  JP: 'ja',
  KR: 'ko',
  IT: 'it',
};

const countryDialingCodes: Record<string, string> = {
  US: '+1',
  CN: '+86',
  HK: '+852',
  AR: '+54',
  FR: '+33',
  PT: '+351',
  RU: '+7',
  DE: '+49',
  JP: '+81',
  KR: '+82',
  IT: '+39',
  ES: '+34',
  // ... add more as needed
};

interface LangCurrencyContextType {
  language: string;
  currency: string;
  setLanguage: (lang: string) => Promise<void>;
  setCurrency: (curr: string) => Promise<void>;
  loading: boolean;
}

const defaultValue: LangCurrencyContextType = {
  language: 'en',
  currency: 'USD',
  setLanguage: async () => {},
  setCurrency: async () => {},
  loading: true,
};

const LangCurrencyContext = createContext<LangCurrencyContextType>(defaultValue);

export const useLangCurrency = () => {
  const context = useContext(LangCurrencyContext);
  if (!context) {
    throw new Error('useLangCurrency must be used within a LangCurrencyProvider');
  }
  return context;
};

export const LangCurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('en');
  const [currency, setCurrencyState] = useState('USD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeLangCurrency = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANG_CURRENCY_KEY);
        if (stored) {
          const { language: storedLang, currency: storedCurr } = JSON.parse(stored);
          setLanguageState(storedLang);
          setCurrencyState(storedCurr);
        } else {
          // Fetch geo data
          try {
            const res = await fetch('https://free.freeipapi.com/api/json');
            const geo = await res.json();
            const countryCode = geo.countryCode || 'US';
            const currencyCode = (geo.currencies && geo.currencies[0]) || 'USD';
            const countryName = geo.countryName || 'United States';
            const continent = geo.continent || 'Asia';
            const language = countryToLanguage[countryCode] || 'en';
            const dialingCode = countryDialingCodes[countryCode] || (`+${geo.phoneCodes && geo.phoneCodes[0]}`) || '+1';
            const langCurrency = `${language}/${currencyCode}`;
            const geoData = {
              countryCode,
              currencyCode,
              countryName,
              continent,
              language,
              dialingCode,
              langCurrency
            };
            setLanguageState(language);
            setCurrencyState(currencyCode);
            await AsyncStorage.setItem(LANG_CURRENCY_KEY, JSON.stringify({ language, currency: currencyCode }));
            await AsyncStorage.setItem(GEO_DATA_KEY, JSON.stringify(geoData));
          } catch (error) {
            console.log('Geo detection failed, using defaults:', error);
            setLanguageState('en');
            setCurrencyState('USD');
          }
        }
      } catch (error) {
        console.error('Error initializing lang/currency:', error);
        setLanguageState('en');
        setCurrencyState('USD');
      } finally {
        setLoading(false);
      }
    };

    initializeLangCurrency();
  }, []);

  const setLanguage = async (lang: string) => {
    console.log('LangCurrency: setLanguage called with:', lang, 'current currency:', currency);
    setLanguageState(lang);
    try {
      const dataToStore = JSON.stringify({ language: lang, currency });
      console.log('LangCurrency: Saving to AsyncStorage:', dataToStore);
      await AsyncStorage.setItem(LANG_CURRENCY_KEY, dataToStore);
      console.log('LangCurrency: Language saved successfully');
    } catch (error) {
      console.error('LangCurrency: Error saving language:', error);
    }
  };

  const setCurrency = async (curr: string) => {
    console.log('LangCurrency: setCurrency called with:', curr, 'current language:', language);
    setCurrencyState(curr);
    try {
      const dataToStore = JSON.stringify({ language, currency: curr });
      console.log('LangCurrency: Saving currency to AsyncStorage:', dataToStore);
      await AsyncStorage.setItem(LANG_CURRENCY_KEY, dataToStore);
      console.log('LangCurrency: Currency saved successfully');
    } catch (error) {
      console.error('LangCurrency: Error saving currency:', error);
    }
  };

  const value: LangCurrencyContextType = {
    language,
    currency,
    setLanguage,
    setCurrency,
    loading,
  };

  return (
    <LangCurrencyContext.Provider value={value}>
      {children}
    </LangCurrencyContext.Provider>
  );
};
