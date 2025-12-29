import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartCountProvider } from './context/CartCountContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { I18nProvider } from './context/I18nContext';
import { LangCurrencyProvider } from './context/LangCurrencyContext';
import { NavigationProvider } from './context/NavigationContext';
import { parseDeepLink } from './utils/share-utils';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      const { productId, source } = parseDeepLink(url);
      if (productId && source === '1688') {
        router.push({ pathname: '/product/w/[id]', params: { id: productId } });
      } else if (productId && source === 'tb') {
        router.push({ pathname: '/product/r/[id]', params: { id: productId } });
      } else if (productId && source === 'local') {
        router.push({ pathname: '/product/l/[id]', params: { id: productId } });
      } else if (productId && source === 'chinese') {
        router.push({ pathname: '/product/c/[id]', params: { id: productId } });
      } else if (productId) {
        router.push({ pathname: '/product/[id]', params: { id: productId } });
      }
    };
    const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    Linking.getInitialURL().then((url) => url && handleDeepLink(url));
    return () => sub.remove();
  }, [router]);

  return (
    <LangCurrencyProvider>
      <I18nProvider>
        <CurrencyProvider>
          <AuthProvider>
            <CartCountProvider>
              <NavigationProvider>
                <Stack screenOptions={{ headerShown: false }}>
                </Stack>
              </NavigationProvider>
            </CartCountProvider>
          </AuthProvider>
        </CurrencyProvider>
      </I18nProvider>
    </LangCurrencyProvider>
  );
}