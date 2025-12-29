import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useI18n } from './context/I18nContext';

const LoadingSpinner = ({ size = 'large' }: { size?: 'small' | 'large' }) => (
  <ActivityIndicator size={size} color="#E53E3E" />
);

const Button = ({ onPress, disabled, children, style }: any) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.button, disabled && styles.buttonDisabled, style]}
    activeOpacity={0.7}
  >
    <Text style={styles.buttonText}>{children}</Text>
  </TouchableOpacity>
);

export default function NotificationsScreen() {
  const { t } = useI18n();
  const { authToken, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const isFocused = typeof useIsFocused === 'function' ? useIsFocused() : true;

  const fetchNotifications = async () => {
    if (!isAuthenticated || !authToken) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('https://api.wanslu.shop/api/etc/notifications', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      } else {
        setNotifications([]);
      }
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && authToken) fetchNotifications();
    else setLoading(false);
  }, [isAuthenticated, authToken]);

  useEffect(() => {
    if (isFocused && isAuthenticated && authToken) fetchNotifications();
  }, [isFocused]);

  const markAllAsRead = async () => {
    if (!authToken) return;
    setMarkingAll(true);
    await fetch('https://api.wanslu.shop/api/etc/notifications/read/?all=true', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    setNotifications(notifications.map(n => ({ ...n, isread: true })));
    setMarkingAll(false);
  };

  const handleNotifClick = async (notif: any) => {
    if (!notif.isread && authToken) {
      await fetch(`https://api.wanslu.shop/api/etc/notifications/read/${notif.id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isread: true } : n));
    }
    if (notif.link) {
      // Try to use router if link is internal, otherwise fallback to Linking
      if (notif.link.startsWith('/')) {
        router.push(notif.link);
      } else {
        // For external links
        try {
          const { Linking } = await import('react-native');
          Linking.openURL(notif.link);
        } catch {}
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('navigation.notifications')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.container}>
        {!isAuthenticated ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: '#888', fontSize: 16 }}>{t('auth.loginRequired')}</Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
              <Button onPress={markAllAsRead} disabled={markingAll || loading}>
                {markingAll ? <LoadingSpinner size="small" /> : t('notifications.markAllAsRead')}
              </Button>
            </View>
            {loading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <LoadingSpinner size="large" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: '#888', fontSize: 16 }}>{t('notifications.noNotifications')}</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={item => String(item.id)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item: notif }) => (
                  <TouchableOpacity
                    style={[
                      styles.notifItem,
                      notif.isread ? styles.notifRead : styles.notifUnread,
                    ]}
                    onPress={() => handleNotifClick(notif)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.notifHeader}>
                      <Text style={[styles.notifTitle, notif.isread ? styles.notifTitleRead : styles.notifTitleUnread]}>
                        {notif.title}
                      </Text>
                    </View>
                    <Text style={styles.notifBody}>{notif.body?.replace(/<[^>]+>/g, '')}</Text>
                    <Text style={styles.notifDate}>
                      {new Date(notif.time).toLocaleString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric', 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </Text>
                    {!notif.isread && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name="ellipse" size={10} color="#E53E3E" style={{ marginRight: 4 }} />
                        <Text style={styles.unreadText}>{t('notifications.unread')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 0 : 40,
    backgroundColor: '#ed2027',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  container: {
    maxWidth: 600,
    alignSelf: 'center',
    flex: 1,
    padding: 16,
    width: '100%',
  },
  button: {
    backgroundColor: '#fff',
    borderColor: '#E53E3E',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#E53E3E',
    fontWeight: 'bold',
    fontSize: 15,
  },
  notifItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notifUnread: {
    borderColor: '#E53E3E',
    borderWidth: 2,
  },
  notifRead: {
    opacity: 0.6,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  notifTitleUnread: {
    color: '#E53E3E',
  },
  notifTitleRead: {
    color: '#333',
  },
  notifBody: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 20,
  },
  notifDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  unreadText: {
    color: '#E53E3E',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
