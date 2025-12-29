import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get the lang-currency header value from AsyncStorage
 * Returns the value in format "language/currency" (e.g., "en/USD")
 * Returns null if not found or on error
 */
export async function getLangCurrencyHeader(): Promise<string | null> {
  try {
    const langCurrencyData = await AsyncStorage.getItem('lang-currency');
    if (!langCurrencyData) {
      return null;
    }
    
    const { language, currency } = JSON.parse(langCurrencyData);
    if (language && currency) {
      return `${language}/${currency}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting lang-currency header:', error);
    return null;
  }
}

/**
 * Get headers object with lang-currency header included
 * @param existingHeaders Optional existing headers object
 * @returns Headers object with X-lang-currency header added
 */
export async function getApiHeaders(existingHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const langCurrency = await getLangCurrencyHeader();
  const headers = { ...existingHeaders };
  
  if (langCurrency) {
    headers['X-lang-currency'] = langCurrency;
  }
  
  return headers;
}

