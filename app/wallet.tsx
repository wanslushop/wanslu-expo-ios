import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from './context/AuthContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface UserInfo {
  username: string;
  email: string;
  balance: number;
}

interface SpendHistoryItem {
  id: number;
  amount: number;
  amount_before: string;
  amount_after: string;
  remarks: string;
  time: string;
}

interface RechargeHistoryItem {
  id: number;
  txn: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  time: string;
}

interface WithdrawalHistoryItem {
  id: number;
  account_name: string;
  amount: string;
  fees: number;
  bank_name: string;
  remarks: string;
  status: string;
  time: string;
  proof?: string;
}

export default function WalletScreen() {
  const { authToken } = useAuth();
  const [user, setUser] = useState<UserInfo>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spend' | 'recharge' | 'withdrawal'>('spend');
  const [history, setHistory] = useState<any[]>([]);
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const fetchUserData = async () => {
    if (!authToken) {
      router.replace('/login');
      return;
    }

    try {
      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true }) // dummy payload
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({
            username: data.user.username,
            email: data.user.email,
            balance: parseFloat(data.user.balance) || 0
          });
        }
      }
    } catch (error) {
      console.error('User data error:', error);
      Alert.alert(t('common.error'), t('wallet.errors.failedToLoadUser'));
    }
  };

  const fetchHistory = async (type: string) => {
    if (!authToken) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://api.wanslu.shop/api/account/wallet/history?type=${type}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to load wallet history:', error);
      Alert.alert(t('common.error'), t('wallet.errors.failedToLoadHistory'));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      router.replace('/login');
      return;
    }
    fetchUserData();
    fetchHistory(activeTab);
  }, [authToken]);

  // Listen for navigation focus to refresh data when returning from other screens
  useFocusEffect(
    useCallback(() => {
      if (authToken) {
        console.log('Wallet screen focused, refreshing data...');
        fetchUserData();
        fetchHistory(activeTab);
      }
    }, [authToken, activeTab])
  );

  useEffect(() => {
    fetchHistory(activeTab);
  }, [activeTab]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const isImageFile = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  const isPdfFile = (url: string) => {
    return url.toLowerCase().includes('.pdf');
  };

  const handleViewProof = (proof: string) => {
    const proofUrl = `https://administration.wanslu.shop/${proof}`;
    // Use Google Docs Viewer for PDFs to display inline instead of downloading
    const isPdf = proof.toLowerCase().includes('.pdf') || proofUrl.toLowerCase().includes('.pdf');
    if (isPdf) {
      const encodedUrl = encodeURIComponent(proofUrl);
      setSelectedProof(`https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`);
    } else {
      setSelectedProof(proofUrl);
    }
    setProofModalVisible(true);
  };

  const renderSpendHistory = () => (
    <View style={styles.cardsContainer}>
      {history.map((item: SpendHistoryItem) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.cardId}>#{item.id}</Text>
              <Text style={styles.cardTime}>{formatDate(item.time)}</Text>
            </View>
            <Text style={styles.cardAmountNegative}>-{convertPrice(item.amount)}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardRemarks} numberOfLines={2}>{item.remarks}</Text>
            <View style={styles.cardBalanceChange}>
              <Text style={styles.cardBalanceText}>
                {convertPrice(item.amount_before)} → {convertPrice(item.amount_after)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderRechargeHistory = () => (
    <View style={styles.cardsContainer}>
      {history.map((item: RechargeHistoryItem) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.cardId}>#{item.id}</Text>
              <Text style={styles.cardTime}>{formatDate(item.time)}</Text>
            </View>
            <Text style={styles.cardAmountPositive}>+{(item.amount)+(item.currency)}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardRow}>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.txn')}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{item.txn}</Text>
              </View>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.method')}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{item.method}</Text>
              </View>
            </View>
            <View style={styles.cardStatusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const handleHelpWithdrawal = (withdrawalId: number) => {
    router.push({
      pathname: '/help-support',
      params: { message: `Withdrawal Help - #${withdrawalId}` }
    });
  };

  const renderWithdrawalHistory = () => (
    <View style={styles.cardsContainer}>
      {history.map((item: WithdrawalHistoryItem) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.cardId}>#{item.id}</Text>
              <Text style={styles.cardTime}>{formatDate(item.time)}</Text>
            </View>
            <Text style={styles.cardAmountNegative}>-{convertPrice(item.amount)}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardRow}>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.receivingName')}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{item.account_name}</Text>
              </View>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.bank')}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{item.bank_name}</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.fees')}</Text>
                <Text style={styles.cardValue}>{convertPrice(item.fees)}</Text>
              </View>
              <View style={styles.cardLabelValue}>
                <Text style={styles.cardLabel}>{t('wallet.table.remarks')}</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{item.remarks}</Text>
              </View>
            </View>
            <View style={styles.cardStatusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            {item.status === 'Completed' && (
              <View style={styles.cardActions}>
                {item.proof && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleViewProof(item.proof!)}
                  >
                    <Ionicons name="document-text" size={14} color="#fff" />
                    <Text style={styles.actionButtonText}>{t('wallet.viewProof')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.helpButton]}
                  onPress={() => handleHelpWithdrawal(item.id)}
                >
                  <Ionicons name="help-circle" size={14} color="#fff" />
                  <Text style={styles.actionButtonText}>{t('wallet.help')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('wallet.loadingHistory')}</Text>
        </View>
      );
    }

    if (history.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>{t('wallet.noRecords')}</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'spend':
        return renderSpendHistory();
      case 'recharge':
        return renderRechargeHistory();
      case 'withdrawal':
        return renderWithdrawalHistory();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('wallet.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>{t('wallet.availableBalance')}</Text>
            <Text style={styles.balanceAmount}>
              {convertPrice(user?.balance || '0')}
            </Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.balanceActionButton}
              onPress={() => router.push('/add-funds')}
            >
              <Text style={styles.balanceActionButtonText}>{t('wallet.addFunds')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.balanceActionButton}
              onPress={() => router.push('/withdraw')}
            >
              <Text style={styles.balanceActionButtonText}>{t('wallet.withdraw')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'spend' && styles.activeTab]}
            onPress={() => setActiveTab('spend')}
          >
            <Text style={[styles.tabText, activeTab === 'spend' && styles.activeTabText]}>
              {t('wallet.tabs.spendHistory')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recharge' && styles.activeTab]}
            onPress={() => setActiveTab('recharge')}
          >
            <Text style={[styles.tabText, activeTab === 'recharge' && styles.activeTabText]}>
              {t('wallet.tabs.rechargeHistory')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'withdrawal' && styles.activeTab]}
            onPress={() => setActiveTab('withdrawal')}
          >
            <Text style={[styles.tabText, activeTab === 'withdrawal' && styles.activeTabText]}>
              {t('wallet.tabs.withdrawalHistory')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      </ScrollView>

      {/* Proof Modal */}
      <Modal
        visible={proofModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('wallet.proofOfWithdrawal')}</Text>
              <TouchableOpacity
                onPress={() => setProofModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              {selectedProof && (
                <>
                  {isImageFile(selectedProof) ? (
                    <Image
                      source={{ uri: selectedProof }}
                      style={styles.proofImage}
                      resizeMode="contain"
                    />
                  ) : isPdfFile(selectedProof) || selectedProof.includes('docs.google.com/viewer') ? (
                    <WebView
                      source={{ uri: selectedProof }}
                      style={styles.proofWebView}
                      startInLoadingState={true}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      allowsInlineMediaPlayback={true}
                      mediaPlaybackRequiresUserAction={false}
                      scalesPageToFit={true}
                      originWhitelist={['*']}
                      onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                      }}
                      onHttpError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('HTTP error: ', nativeEvent);
                      }}
                      renderLoading={() => (
                        <View style={styles.proofLoadingContainer}>
                          <ActivityIndicator size="large" color="#ef4444" />
                          <Text style={styles.proofLoadingText}>{t('wallet.loadingProof')}</Text>
                        </View>
                      )}
                    />
                  ) : (
                    <View style={styles.proofUnsupportedContainer}>
                      <Ionicons name="document-outline" size={64} color="#9ca3af" />
                      <Text style={styles.proofUnsupportedText}>
                        {t('wallet.proofUnsupported')}
                      </Text>
                      <TouchableOpacity
                        style={styles.openInBrowserButton}
                        onPress={() => {
                          if (selectedProof) {
                            Linking.openURL(selectedProof).catch(err => {
                              Alert.alert(t('common.error'), t('wallet.errors.failedToOpenProof'));
                            });
                          }
                        }}
                      >
                        <Text style={styles.openInBrowserText}>
                          {t('wallet.openInBrowser')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
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
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#ef4444',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceInfo: {
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceActionButton: {
    flex: 1,
    backgroundColor: '#fbbf24',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  balanceActionButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f1f1f1',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#ef4444',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: 'white',
  },
  contentContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardAmountPositive: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  cardAmountNegative: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
  },
  cardBody: {
    gap: 10,
  },
  cardRemarks: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardBalanceChange: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardBalanceText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  cardLabelValue: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  cardStatusContainer: {
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ed2027',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  helpButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').height * 0.85,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  proofWebView: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
    height: '100%',
  },
  proofLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  proofLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  proofUnsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  proofUnsupportedText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  openInBrowserButton: {
    marginTop: 24,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  openInBrowserText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9ca3af',
  },
});
