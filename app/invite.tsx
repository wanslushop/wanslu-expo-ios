import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from './context/I18nContext';

interface User {
  username: string;
  email: string;
  rpoints: number;
}

type TabType = 'link' | 'friends' | 'history' | 'email' | 'affiliate';

export default function InviteScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({
            username: data.user.username,
            email: data.user.email,
            rpoints: data.user.rpoints
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const inviteLink = user ? `https://wanslu.shop/register?ref=${user.username}` : '';

  const handleCopy = async () => {
    if (inviteLink) {
      try {
        await Share.share({
          message: inviteLink,
          title: t('invite.inviteFriends'),
        });
      } catch (error) {
        Alert.alert(t('common.error'), t('invite.failedToShareInviteLink'));
      }
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    
    setSending(true);
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch('https://api.wanslu.shop/api/etc/sendemailinvite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        Alert.alert(t('common.success'), t('invite.invitationSent'));
        setEmail('');
      } else {
        Alert.alert(t('common.error'), t('invite.failedToSendInvite'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('invite.failedToSendInvite'));
    } finally {
      setSending(false);
    }
  };

  const renderSteps = () => (
    <View style={styles.stepsContainer}>
      <View style={styles.stepsRow}>
        <View style={styles.stepItem}>
          <Text style={styles.stepEmoji}>🔗</Text>
          <Text style={styles.stepText}>{t('invite.shareLink')}</Text>
        </View>
        <Text style={styles.stepArrow}>›</Text>
        <View style={styles.stepItem}>
          <Text style={styles.stepEmoji}>➕</Text>
          <Text style={styles.stepText}>{t('invite.friendJoins')}</Text>
        </View>
        <Text style={styles.stepArrow}>›</Text>
        <View style={styles.stepItem}>
          <Text style={styles.stepEmoji}>📦</Text>
          <Text style={styles.stepText}>{t('invite.firstPurchase')}</Text>
        </View>
        <Text style={styles.stepArrow}>›</Text>
        <View style={styles.stepItem}>
          <Text style={styles.stepEmoji}>💰</Text>
          <Text style={styles.stepText}>{t('invite.getCommission')}</Text>
        </View>
      </View>
    </View>
  );

  const renderPointsCard = () => (
    <LinearGradient
      colors={['#E53E3E', '#F56565']}
      style={styles.pointsCard}
    >
      <View style={styles.pointsContent}>
        <Text style={styles.pointsLabel}>{t('invite.availableRPoints')}</Text>
        <Text style={styles.pointsValue}>{user?.rpoints}</Text>
      </View>
    </LinearGradient>
  );

  const renderTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.tabsContainer}
    >
      {[
        { key: 'link', label: t('invite.invitationLink'), icon: 'link' },
        { key: 'friends', label: t('invite.inviteFriends'), icon: 'people' },
        { key: 'history', label: t('invite.history'), icon: 'time' },
        { key: 'email', label: t('invite.emailHistory'), icon: 'mail' },
        { key: 'affiliate', label: t('invite.affiliate'), icon: 'trending-up' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tabButton,
            activeTab === tab.key && styles.tabButtonActive
          ]}
          onPress={() => setActiveTab(tab.key as TabType)}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={16} 
            color={activeTab === tab.key ? '#E53E3E' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.tabTextActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'link':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>{t('invite.inviteFriends')}</Text>
            <Text style={styles.tabSubtitle}>{t('invite.getCommissionOnFirstPurchases')}</Text>
            <View style={styles.linkContainer}>
              <TextInput
                value={inviteLink}
                editable={false}
                style={styles.linkInput}
                placeholderTextColor="#999" placeholder={t('invite.loadingInviteLink')}
              />
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Ionicons name="copy" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.linkHint}>{t('invite.inviteYourFriendsToJoinUs')}</Text>
          </View>
        );

      case 'friends':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>{t('invite.inviteViaEmail')}</Text>
            <TextInput
              style={styles.emailInput}
              placeholderTextColor="#999" placeholder={t('invite.friendEmailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.inviteButton, (!email.trim() || sending) && styles.inviteButtonDisabled]}
              onPress={handleInvite}
              disabled={sending || !email.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.inviteButtonText}>{t('invite.sendInvite')}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.emailHint}>{t('invite.inviteYourFriendsViaEmail')}</Text>
          </View>
        );

      case 'history':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>{t('invite.invitationHistory')}</Text>
            <View style={styles.emptyState}>
              <Ionicons name="time" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('invite.noInvitationHistoryYet')}</Text>
            </View>
          </View>
        );

      case 'email':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>{t('invite.emailInvitationHistory')}</Text>
            <View style={styles.emptyState}>
              <Ionicons name="mail" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('invite.noEmailInvitationsSentYet')}</Text>
            </View>
          </View>
        );

      case 'affiliate':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>{t('invite.affiliateHistory')}</Text>
            <View style={styles.emptyState}>
              <Ionicons name="trending-up" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('invite.noAffiliateActivityYet')}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('invite.inviteFriends')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Steps */}
        {renderSteps()}

        {/* Points Card */}
        {renderPointsCard()}

        {/* Tabs */}
        {renderTabs()}

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  stepsContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  stepArrow: {
    fontSize: 18,
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  pointsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsContent: {
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabsContainer: {
    marginBottom: 20,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabButtonActive: {
    borderColor: '#E53E3E',
    backgroundColor: '#FEE2E2',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#E53E3E',
    fontWeight: '600',
  },
  tabContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tabSubtitle: {
    fontSize: 14,
    color: '#E53E3E',
    fontWeight: '600',
    marginBottom: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  copyButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkHint: {
    fontSize: 12,
    color: '#666',
  },
  emailInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inviteButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailHint: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
