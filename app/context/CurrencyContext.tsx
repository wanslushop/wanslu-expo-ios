import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface CurrencyData {
  currency: string;
  symbol: string;
  base_rate: number;
  markup: string;
  final_rate: number;
  last_updated: string;
  next_update: string;
}

interface CurrencyContextType {
  currencyData: CurrencyData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  convertPrice: (price: number | string) => string;
  refreshCurrencyRate: () => Promise<void>;
  refreshCurrencyOnChange: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyData, setCurrencyData] = useState<CurrencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locale, setLocale] = useState('en-US');
  const [displayCurrency, setDisplayCurrency] = useState('USD');

  const fetchCurrencyRate = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check if we have cached data and it's still valid (not expired)
      if (!forceRefresh) {
        const cachedData = await AsyncStorage.getItem('currency-rate-cache');
        const cacheTimestamp = await AsyncStorage.getItem('currency-rate-timestamp');
        
        if (cachedData && cacheTimestamp) {
          const now = Date.now();
          const cacheTime = parseInt(cacheTimestamp);
          const cacheExpiry = 30 * 60 * 1000; // 30 minutes cache
          
          if (now - cacheTime < cacheExpiry) {
            const parsedData = JSON.parse(cachedData);
            setCurrencyData(parsedData);
            setLoading(false);
            return;
          }
        }
      }

      // Get currency from lang-currency storage
      const langCurrencyData = await AsyncStorage.getItem('lang-currency');
      if (!langCurrencyData) {
        setError('No currency data found');
        setLoading(false);
        return;
      }

      const { currency } = JSON.parse(langCurrencyData);

      const response = await fetch(`https://api.wanslu.shop/api/etc/currencyrate?currency=${currency}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch currency rate');
      }

      const data = await response.json();
      if (data.status === 'success') {
        setCurrencyData(data.data);
        
        // Cache the data
        await AsyncStorage.setItem('currency-rate-cache', JSON.stringify(data.data));
        await AsyncStorage.setItem('currency-rate-timestamp', Date.now().toString());
      } else {
        throw new Error('Invalid currency data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch currency rate');
      console.error('Currency fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrencyRate = async () => {
    await fetchCurrencyRate(true);
  };

  const refreshCurrencyOnChange = async () => {
    console.log('CurrencyContext: Manual refresh triggered');
    setRefreshing(true);
    try {
      await loadLocaleAndCurrency();
      await fetchCurrencyRate(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCurrencyRate();
    loadLocaleAndCurrency();
  }, []);

  // Listen for currency changes in LangCurrencyContext
  useEffect(() => {
    const checkCurrencyChange = async () => {
      try {
        const langCurrencyData = await AsyncStorage.getItem('lang-currency');
        if (langCurrencyData) {
          const { currency: storedCurrency } = JSON.parse(langCurrencyData);
          if (storedCurrency && storedCurrency !== displayCurrency) {
            console.log(`CurrencyContext: Currency changed from ${displayCurrency} to ${storedCurrency}`);
            setDisplayCurrency(storedCurrency);
            // Refresh currency rate when currency changes
            await fetchCurrencyRate(true);
          }
        }
      } catch (e) {
        console.warn('Failed to check currency change:', e);
      }
    };

    // Check for currency changes more frequently (every 1 second) for better responsiveness
    const interval = setInterval(checkCurrencyChange, 1000);
    return () => clearInterval(interval);
  }, [displayCurrency]);

  const loadLocaleAndCurrency = async () => {
    try {
      const langCurrencyData = await AsyncStorage.getItem('lang-currency');
      if (langCurrencyData) {
        const { language, currency: storedCurrency } = JSON.parse(langCurrencyData);
        if (language) {
          // Map language to locale format
          const localeMap: Record<string, string> = {
            'en': 'en-US',
            'es': 'es-ES',
            'zh': 'zh-CN',
            'zh-hans': 'zh-CN',
            'ar': 'ar-SA',
            'fr': 'fr-FR',
            'pt': 'pt-PT',
            'ru': 'ru-RU',
            'de': 'de-DE',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'it': 'it-IT'
          };
          setLocale(localeMap[language] || 'en-US');
        }
        if (storedCurrency) {
          setDisplayCurrency(storedCurrency);
        }
      }
    } catch (e) {
      console.warn('Failed to get locale from storage:', e);
    }
  };

  const convertPrice = (price: number | string): string => {
    if (!currencyData) {
      return `CNY ${price}`;
    }

    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numericPrice)) {
      return `$${price}`;
    }

    const convertedPrice = numericPrice * currencyData.final_rate;

    // Special formatting for XOF and XAF currencies
    if (displayCurrency === 'XOF' || displayCurrency === 'XAF') {
      // XOF/XAF: No decimal points, no commas, use spaces for thousands separator
      const roundedPrice = Math.round(convertedPrice);
      const formattedNumber = roundedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return `${formattedNumber} ${currencyData.symbol}`;
    }

    // Use Intl.NumberFormat for other currencies with locale-based formatting
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      
      return formatter.format(convertedPrice);
    } catch (e) {
      console.warn('Failed to format currency:', e);
      
      // Fallback formatting based on currency
      const formattedNumber = convertedPrice.toFixed(2);
      
      // Currency position based on locale/currency
      if (displayCurrency === 'EUR' && (locale.includes('fr') || locale.includes('de'))) {
        return `${formattedNumber} ${currencyData.symbol}`; // 10,50 €
      } else if (displayCurrency === 'USD' || displayCurrency === 'GBP') {
        return `${currencyData.symbol}${formattedNumber}`; // $10.50
      } else {
        return `${currencyData.symbol}${formattedNumber}`; // Default: symbol before
      }
    }
  };

  return (
    <CurrencyContext.Provider value={{ 
      currencyData, 
      loading, 
      error, 
      refreshing,
      convertPrice, 
      refreshCurrencyRate,
      refreshCurrencyOnChange
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
