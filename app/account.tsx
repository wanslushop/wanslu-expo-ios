import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import { useAuth } from './context/AuthContext';
import { useCartCount } from './context/CartCountContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { useLangCurrency } from './context/LangCurrencyContext';
import { useNavigation } from './context/NavigationContext';

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  subtitle?: string;
  onPress: () => void;
}

interface AccountScreenProps {
  showMenu?: boolean;
  onMenuClose?: () => void;
  onMenuPress?: () => void;
}

export default function AccountScreen({ showMenu = false, onMenuClose, onMenuPress }: AccountScreenProps) {
  const { isAuthenticated, logout, authToken } = useAuth();
  const { cartCount } = useCartCount();
  const { language, currency } = useLangCurrency();
  const { t } = useI18n();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { convertPrice } = useCurrency();

  useEffect(() => {
    if (isAuthenticated && authToken) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUserData(data.user);
        }
      } else {
        console.error('Failed to fetch user data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call logout API
      const response = await fetch('https://api.wanslu.shop/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Logout API response:', response.status);
      
      // Clear local storage regardless of API response
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Logout API error:', error);
      // Still logout locally even if API fails
      await logout();
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Settings items that are always available
  const settingsItems: MenuItem[] = [
    {
      id: 'language',
      title: t('account.languageCurrency'),
      icon: 'language',
      subtitle: `${language.toUpperCase()} / ${currency.toUpperCase()}`,
      onPress: () => router.push('/lang-currency'),
    },
    {
      id: 'freight',
      title: t('account.freightEstimation'),
      icon: 'car',
      subtitle: t('account.calculateShippingCosts'),
      onPress: () => router.push('/shipping-estimate'),
    },
    {
      id: 'help',
      title: t('account.helpSupport'),
      icon: 'help-circle',
      subtitle: t('account.getHelpAndContactSupport'),
      onPress: () => router.push('/help-support'),
    },
    {
      id: 'about-app',
      title: t('account.about'),
      icon: 'information-circle',
      subtitle: t('account.appVersionAndInformation'),
      onPress: () => router.push('/about-app'),
    },
    {
      id: 'about-company',
      title: t('account.about'),
      icon: 'information-circle',
      subtitle: t('account.aboutWanslu'),
      onPress: () => router.push('/about'),
    },
  ];

  // Account items that require authentication
  const accountItems: MenuItem[] = [
    {
      id: 'profile',
      title: t('account.profile'),
      icon: 'person',
      subtitle: t('account.managePersonalInfo'),
      onPress: () => router.push('/edit-profile'),
    },
    {
      id: 'wallet',
      title: t('account.wallet'),
      icon: 'wallet',
      subtitle: t('account.viewWalletBalance'),
      onPress: () => router.push('/wallet'),
    },
    {
      id: 'addresses',
      title: t('account.addresses'),
      icon: 'location',
      subtitle: t('account.manageDeliveryAddresses'),
      onPress: () => router.push('/address'),
    },
    {
      id: 'transactions',
      title: t('account.transactions'),
      icon: 'receipt',
      subtitle: t('account.viewTransactionHistory'),
      onPress: () => router.push('/transactions'),
    },
    {
      id: 'transfer',
      title: t('account.transfer'),
      icon: 'send',
      subtitle: t('account.transferMoneyToFriends'),
      onPress: () => router.push('/transfer'),
    },
    {
      id: 'transfer-history',
      title: t('account.transferHistory'),
      icon: 'time',
      subtitle: t('account.viewTransferHistory'),
      onPress: () => router.push('/transfers'),
    },
    {
      id: 'activity',
      title: t('account.browsingActivity'),
      icon: 'eye',
      subtitle: t('account.visitLastViewedProducts'),
      onPress: () => router.push('/activity'),
    },
    {
      id: 'referral',
      title: t('account.inviteFriends'),
      icon: 'people',
      subtitle: t('account.shareReferralLink'),
      onPress: () => router.push('/invite'),
    },
    {
      id: 'logout',
      title: isLoggingOut ? t('account.loggingOut') : t('account.logout'),
      icon: 'log-out',
      subtitle: t('account.signOutOfYourAccount'),
      onPress: handleLogout,
    },
  ];

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={item.icon as any} size={20} color="#E53E3E" />
        </View>
        <View style={styles.menuItemContent}>
          <Text style={styles.menuItemTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#ccc" />
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Header cartCount={cartCount} />
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Login Prompt */}
          <View style={styles.loginSection}>
            <View style={styles.loginIcon}>
              <Ionicons name="person-circle" size={80} color="#E53E3E" />
            </View>
            <Text style={styles.loginTitle}>{t('account.welcomeTitle')}</Text>
            <Text style={styles.loginSubtitle}>{t('account.loginSubtitle')}</Text>
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={() => router.push('/login')}
            >
              <Text style={styles.loginButtonText}>{t('account.signIn')}</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{t('account.settingsHeader')}</Text>
            <View style={styles.menuContainer}>
              {settingsItems.map(renderMenuItem)}
            </View>
          </View>
        </ScrollView>
        
        {/* Categories Modal */}
        <CategoriesModal 
          visible={showCategoriesModal} 
          onClose={() => setShowCategoriesModal(false)} 
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImage}>
            {isLoading ? (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>...</Text>
              </View>
            ) : userData ? (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {userData.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>U</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {userData ? userData.username : 'Loading...'}
            </Text>
            <Text style={styles.profileEmail}>
              {userData ? userData.email : 'Loading...'}
            </Text>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userData ? `${convertPrice(userData.balance || '0')}` : '...'}
            </Text>
            <Text style={styles.statLabel}>{t('account.balance')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userData ? userData.rpoints || '0' : '...'}
            </Text>
            <Text style={styles.statLabel}>{t('account.rewardPoints')}</Text>
          </View>
        </View>

        {/* Account Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{t('account.settings')}</Text>
          <View style={styles.menuContainer}>
            {accountItems.map(renderMenuItem)}
          </View>
        </View>

        {/* Settings Menu Items */}
        <View style={styles.menuSection2}>
          <Text style={styles.sectionTitle}>{t('account.appSettings')}</Text>
          <View style={styles.menuContainer}>
            {settingsItems.map(renderMenuItem)}
          </View>
        </View>
      </ScrollView>
      
      {/* Categories Modal */}
      <CategoriesModal 
        visible={showCategoriesModal} 
        onClose={() => setShowCategoriesModal(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loginSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginIcon: {
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profileSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 40,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  profileImageContent: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  accessToken: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  editProfileButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#eee',
  },
  menuSection: {
    marginBottom: 16,
  },
  menuSection2: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
});
