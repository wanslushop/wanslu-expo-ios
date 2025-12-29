import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple in-memory cache for fast lookups during a session
const memoryCache = new Map<string, { translatedText: string; expiresAt: number }>();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'translation:v1:'; // bump version to invalidate old entries if needed

function buildKey(text: string, targetLang: string): string {
  // Build a bounded key to avoid excessively long storage keys
  // Use a lightweight hash to keep deterministic keys
  const input = `${targetLang}:${text}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return `${STORAGE_PREFIX}${targetLang}:${hash.toString(16)}`;
}

export async function translateWithCache(
  text: string,
  targetLang: string,
  fetcher?: (text: string, targetLang: string) => Promise<string>
): Promise<string> {
  if (!text || !targetLang) return text;

  const key = buildKey(text, targetLang);
  const now = Date.now();

  // 1) Memory cache
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.translatedText || text;
  }

  // 2) AsyncStorage cache
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { translatedText: string; expiresAt: number };
      if (parsed.expiresAt > now) {
        // hydrate memory cache and return
        memoryCache.set(key, parsed);
        return parsed.translatedText || text;
      }
    }
  } catch {
    // ignore storage errors and proceed to fetch
  }

  // 3) Fetch fresh translation
  const translateCall =
    fetcher ??
    (async (q: string, lang: string): Promise<string> => {
      const response = await fetch('https://translate.wanslu.shop/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q,
          source: 'auto',
          target: lang,
          format: 'text',
        }),
      });
      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }
      const data = await response.json();
      return data.translatedText || q;
    });

  try {
    const translatedText = await translateCall(text, targetLang);
    const record = { translatedText, expiresAt: now + ONE_DAY_MS };
    memoryCache.set(key, record);
    // Save to persistent cache, ignore errors
    AsyncStorage.setItem(key, JSON.stringify(record)).catch(() => {});
    return translatedText;
  } catch {
    // On failure, fall back to original text
    return text;
  }
}

export async function clearExpiredTranslations(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const now = Date.now();
    const relevant = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (relevant.length === 0) return;
    const pairs = await AsyncStorage.multiGet(relevant);
    const toRemove: string[] = [];
    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const parsed = JSON.parse(value) as { expiresAt: number };
        if (!parsed.expiresAt || parsed.expiresAt <= now) {
          toRemove.push(key);
          memoryCache.delete(key);
        }
      } catch {
        toRemove.push(key);
        memoryCache.delete(key);
      }
    }
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // ignore cleanup errors
  }
}


