import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './context/AuthContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface Onafriq {
  id: number;
  user_id: number;
  amount: string;
  amount_before: string;
  amount_after: string;
  type: string;
  method: string;
  remarks: string;
  time: string;
  payid: string;
  mfs?: string;
  currency?: string;
  mode?: string;
  oid?: string;
  phone_number: string;
  network?: string;
  status?: string;
}

interface User {
  username: string;
  email: string;
}

export default function OnafriqScreen() {
  const { t } = useI18n();
  const { isAuthenticated, authToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onafriqs, setOnafriqs] = useState<Onafriq[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const { convertPrice } = useCurrency();

  useEffect(() => {
    fetchUserData();
    fetchOnafriqs();
  }, []);

  const fetchUserData = async () => {
    if (!authToken) return;
    
    try {
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
            email: data.user.email
          });
        }
      }
    } catch (error) {
      // ignore
    }
  };

  const fetchOnafriqs = async () => {
    setLoading(true);
    if (!authToken) return;
    
    try {
      const response = await fetch('https://api.wanslu.shop/api/account/onafriq', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOnafriqs(data.data || []);
      } else {
        setOnafriqs([]);
      }
    } catch (error) {
      console.error('Failed to load onafriqs:', error);
      setOnafriqs([]);
    } finally {
      setLoading(false);
    }
  };

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

  const getOnafriqIcon = (type?: string) => {
    if (!type) return 'phone-portrait';
    switch (type.toLowerCase()) {
      case 'credit':
        return 'arrow-down-circle';
      case 'debit':
        return 'arrow-up-circle';
      case 'transfer':
        return 'swap-horizontal';
      default:
        return 'phone-portrait';
    }
  };

  const getOnafriqColor = (type?: string) => {
    if (!type) return '#6B7280';
    switch (type.toLowerCase()) {
      case 'credit':
        return '#10B981';
      case 'debit':
        return '#EF4444';
      case 'transfer':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const handleRefresh = async (payid: string) => {
    if (!authToken || !payid) {
      Alert.alert('Error', 'Refresh Failed');
      return;
    }

    setRefreshingIds(prev => new Set(prev).add(payid));

    try {
      const response = await fetch(`https://api.wanslu.shop/api/etc/onafriq?id=${payid}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // Refresh the onafriq page automatically
        await fetchOnafriqs();
      } else {
        Alert.alert('Error', 'Refresh Failed');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      Alert.alert('Error', 'Refresh Failed');
    } finally {
      setRefreshingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(payid);
        return newSet;
      });
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
          <Text style={styles.title}>{t('onafriq.title')}</Text>
          <View></View>
        </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
    

        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('onafriq.transactionHistory')}</Text>
            <Text style={styles.headerSubtitle}>{t('onafriq.title')}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="receipt" size={32} color="white" />
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : onafriqs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>{t('onafriq.noRecordsFound')}</Text>
              <Text style={styles.emptySubtitle}>{t('onafriq.noTransactionsYet')}</Text>
            </View>
          ) : (
            onafriqs.map((item) => (
              <View key={item.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <View style={styles.transactionLeft}>
                    <View style={[styles.transactionIcon, { backgroundColor: getOnafriqColor(item.type) }]}>
                      <Ionicons 
                        name={getOnafriqIcon(item.type) as any} 
                        size={20} 
                        color="white" 
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionType}>
                        Txn: #{item.payid}
                      </Text>
                      <Text style={styles.transactionMethod}>
                        MFS: {item.mfs || '--'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text style={[
                      styles.amountText,
                      { color: getOnafriqColor(item.type) }
                    ]}>
                      {parseFloat(item.amount).toFixed(2)} {item.currency || ''}
                    </Text>
                    <Text style={styles.transactionId}>Status: {item.status || '--'}</Text>
                  </View>
                </View>
                
                <View style={styles.transactionDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('onafriq.mode')}:</Text>
                    <Text style={styles.detailValue}>{item.mode || '--'} {item.oid || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('onafriq.phoneNumber')}:</Text>
                    <Text style={styles.detailValue}>{item.phone_number}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('onafriq.network')}:</Text>
                    <Text style={styles.detailValue}>{item.network || '--'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('onafriq.time')}:</Text>
                    <Text style={styles.detailValue}>{formatDate(item.time)}</Text>
                  </View>
                </View>
                
                {/* Refresh Button */}
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={() => handleRefresh(item.payid)}
                  disabled={refreshingIds.has(item.payid)}
                >
                  {refreshingIds.has(item.payid) ? (
                    <ActivityIndicator size="small" color="#E53E3E" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#E53E3E" />
                  )}
                  <Text style={styles.refreshButtonText}>
                    {refreshingIds.has(item.payid) ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: 'white'
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  headerSection: {
    backgroundColor: '#E53E3E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  infoLink: {
    color: '#E53E3E',
    fontWeight: '600',
  },
  transactionsContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  transactionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionMethod: {
    fontSize: 14,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  transactionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#E53E3E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53E3E',
  },
});
