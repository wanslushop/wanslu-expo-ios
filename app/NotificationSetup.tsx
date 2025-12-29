import { Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useAuth } from './context/AuthContext';
import { parseDeepLink, sendFcmTokenToBackend } from './utils/share-utils';

// Only import Notifee for iOS and Android
let notifee: any = null;
let messaging: any = null;

// More defensive Firebase import
if (Platform.OS !== 'web') {
  try {
    notifee = require('@notifee/react-native').default;
  } catch (error) {
    console.log('Notifee not available:', error);
  }
  
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.log('Firebase messaging not available:', error);
  }
}

async function createNotificationChannel() {
  if (Platform.OS === 'web' || !notifee) return;
  
  try {
    await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: notifee.AndroidImportance.HIGH,
    });
    console.log('✅ Notification channel created');
  } catch (error) {
    console.error('Error creating notification channel', error);
  }
}

export default function NotificationSetup() {
  const router = useRouter();
  const { isAuthenticated, authToken } = useAuth();

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        await createNotificationChannel();
        
        // Only setup Firebase messaging for iOS and Android
        if (Platform.OS !== 'web' && messaging && typeof messaging === 'function') {
          try {
            const authStatus = await messaging().requestPermission();
            const enabled =
              authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
              authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
              console.log('✅ Push notification permission granted');
              const token = await messaging().getToken();
              console.log('📱 Firebase FCM Token:', token);
              // Send token to backend if user is logged in
              if (isAuthenticated && authToken && token) {
                try {
                  const response = await sendFcmTokenToBackend(
                    token,
                    Platform.OS === 'ios' ? 'ios' : 'android',
                    authToken
                  );
                  if (response.ok) {
                    console.log('✅ FCM token sent to backend');
                  } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to send FCM token:', errorText);
                  }
                } catch (err) {
                  console.error('❌ Error sending FCM token:', err);
                }
              }
            } else {
              console.log('❌ Push notification permission denied');
            }
          } catch (firebaseError) {
            console.log('Firebase messaging setup failed:', firebaseError);
          }
        }
      } catch (error) {
        console.error('Notification setup error:', error);
      }
    };

    setupNotifications();

    // Only setup Firebase messaging handlers for iOS and Android
    if (Platform.OS !== 'web' && messaging && typeof messaging === 'function') {
      try {
        // --- 2. HANDLE FOREGROUND NOTIFICATIONS (App is open) ---
        const unsubscribeForeground = messaging().onMessage(async (remoteMessage: any) => {
          console.log('📩 Foreground notification received:', JSON.stringify(remoteMessage));
          if (remoteMessage.notification && notifee) {
            await notifee.displayNotification({
              title: remoteMessage.notification.title,
              body: remoteMessage.notification.body,
              android: {
                channelId: 'default',
                importance: notifee.AndroidImportance.HIGH,
                pressAction: { id: 'default' },
              },
            });
          }
        });

        // --- 3. HANDLE TAPPED NOTIFICATIONS (App in background or quit) ---
        messaging().onNotificationOpenedApp((remoteMessage: any) => {
          console.log('👉 Notification opened from background:', JSON.stringify(remoteMessage));
          if (remoteMessage.data?.screen) {
            router.push(`/${remoteMessage.data.screen}` as Href);
          }
        });

        messaging()
          .getInitialNotification()
          .then((remoteMessage: any) => {
            if (remoteMessage) {
              console.log('👉 App launched from quit state by notification:', JSON.stringify(remoteMessage));
              if (remoteMessage.data?.screen) {
                router.push(`/${remoteMessage.data.screen}` as Href);
              }
            }
          });

        return () => {
          unsubscribeForeground();
        };
      } catch (firebaseError) {
        console.log('Firebase messaging handlers setup failed:', firebaseError);
      }
    }

    // --- DEEP LINKING LOGIC (Always available) ---
    const handleDeepLink = (url: string) => {
      console.log('🔗 Deep link:', url);
      const { productId } = parseDeepLink(url);
      if (productId) {
        router.push({ pathname: '/product/[id]', params: { id: productId } });
      }
    };

    const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    Linking.getInitialURL().then((url) => url && handleDeepLink(url));

    return () => {
      sub.remove();
    };
  }, [isAuthenticated, authToken]);

  return null;
}
