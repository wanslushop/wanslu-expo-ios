import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { WebView } from 'react-native-webview';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface WaybillData {
  id: number;
  wid: string;
  username: string;
  user_id: number;
  address: number;
  area: string;
  method: string;
  weight: number;
  volume: number;
  price: number;
  payment: number;
  cod: number;
  rpoints_discount: string;
  additionalservices: string;
  remarks: string;
  ip: string;
  status: string;
  couriercompany: string | null;
  ctracking: string | null;
  time: string;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  username: string;
  email: string;
  balance: number;
}

export default function PayWaybillScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  
  const [waybillData, setWaybillData] = useState<WaybillData | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentBody, setPaymentBody] = useState<string>('');
  const [webProgress, setWebProgress] = useState(0);

  const fetchWaybillData = useCallback(async () => {
    if (!wid) {
      setError(t('payWaybill.waybillIdRequired'));
      setLoading(false);
      return;
    }

    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.replace('/login');
        return;
      }

      // Fetch waybill details
      const waybillResponse = await fetch(`https://api.wanslu.shop/api/waybill/${wid}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!waybillResponse.ok) {
        throw new Error(t('submitWaybill.errors.failedToFetchOrder'));
      }

      const waybillData = await waybillResponse.json();
      if (waybillData.status === 'success' && waybillData.data) {
        setWaybillData(waybillData.data);
      } else {
        throw new Error('Invalid waybill data');
      }

      // Fetch user data for balance
      const userResponse = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true })
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.status === 'success' && userData.user) {
          setUser({
            username: userData.user.username || '',
            email: userData.user.email || '',
            balance: parseFloat(userData.user.balance) || 0,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || t('payWaybill.loadingWaybill'));
    } finally {
      setLoading(false);
    }
  }, [wid]);

  useEffect(() => {
    fetchWaybillData();
  }, [fetchWaybillData]);

  const handlePayWaybill = async () => {
    if (!waybillData || !user) return;

    const totalAmount = waybillData.price;

    // Check if user has sufficient balance
    if (user.balance < totalAmount) {
      Alert.alert(
        t('payOrder.insufficientBalance'),
        t('payOrder.insufficientBalanceMsg', { amount: convertPrice(totalAmount), balance: convertPrice(user.balance) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('payOrder.addFunds'), onPress: () => router.push('/add-funds') }
        ]
      );
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      t('payOrder.confirmPayment'),
      t('payOrder.confirmPaymentMsg', { amount: convertPrice(totalAmount), oid: wid as string }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('payOrder.payNow'), onPress: openPaymentWebView }
      ]
    );
  };

  const openPaymentWebView = async () => {
    if (!waybillData || !wid) return;

    setProcessing(true);
    try {
      // Create form data for payment
      const body = new URLSearchParams({
        wid: wid,
        username: waybillData.username,
        uid: String(waybillData.user_id),
        waybill: 'true', // Add this to identify it's a waybill payment
        source: 'app'
      }).toString();
      
      setPaymentBody(body);
      setPaymentVisible(true);
    } catch (e) {
      console.error('Open payment failed:', e);
      Alert.alert(t('common.error'), t('addFunds.failedToOpenPayment'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('payWaybill.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('payWaybill.loadingWaybill')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !waybillData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('payWaybill.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error || t('payWaybill.waybillNotFound')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchWaybillData}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('payWaybill.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Waybill Header */}
        <View style={styles.waybillHeader}>
          <Text style={styles.waybillId}>{t('waybill.title')} #{wid}</Text>
          <Text style={styles.waybillDate}>
            {new Date(waybillData.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Waybill Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('payWaybill.waybillDetails')}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.waybillId')}</Text>
            <Text style={styles.detailValue}>{waybillData.wid}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.status')}</Text>
            <View style={[
              styles.statusBadge,
              waybillData.status === 'Delivered' ? styles.statusGreen :
              waybillData.status === 'Shipped' ? styles.statusBlue :
              styles.statusYellow
            ]}>
              <Text style={styles.statusText}>{waybillData.status}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.shippingMethod')}</Text>
            <Text style={styles.detailValue}>{waybillData.method}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.weight')}</Text>
            <Text style={styles.detailValue}>{waybillData.weight} g</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.volume')}</Text>
            <Text style={styles.detailValue}>{waybillData.volume} cm³</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.cod')}</Text>
            <Text style={styles.detailValue}>{waybillData.cod > 0 ? t('common.yes') : t('common.no')}</Text>
          </View>
        </View>

        {/* Shipping Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('payWaybill.shippingInformation')}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.destination')}</Text>
            <Text style={styles.detailValue}>{waybillData.area}</Text>
          </View>
          
          {waybillData.couriercompany && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('payWaybill.courier')}</Text>
              <Text style={styles.detailValue}>{waybillData.couriercompany}</Text>
            </View>
          )}
          
          {waybillData.ctracking && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('payWaybill.trackingId')}</Text>
              <Text style={styles.detailValue}>{waybillData.ctracking}</Text>
            </View>
          )}
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('payWaybill.paymentInformation')}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.waybillCost')}</Text>
            <Text style={styles.detailValue}>{convertPrice(waybillData.price)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payWaybill.paymentStatus')}</Text>
            <Text style={[
              styles.detailValue,
              waybillData.payment > 0 ? styles.paidText : styles.unpaidText
            ]}>
              {waybillData.payment > 0 ? t('payWaybill.paid') : t('payWaybill.unpaid')}
            </Text>
          </View>
          
         
        </View>

        {/* Additional Information */}
        {(waybillData.additionalservices || waybillData.remarks) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('payWaybill.additionalInformation')}</Text>
            
            {waybillData.additionalservices && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('payWaybill.additionalServices')}</Text>
                <Text style={styles.detailValue}>{waybillData.additionalservices}</Text>
              </View>
            )}
            
            {waybillData.remarks && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('payWaybill.remarks')}</Text>
                <Text style={styles.detailValue}>{waybillData.remarks}</Text>
              </View>
            )}
          </View>
        )}

       
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.payButtonContainer}>
        <TouchableOpacity
          style={[
            styles.payButton,
            (!user || user.balance < waybillData.price || processing || waybillData.payment > 0) && styles.payButtonDisabled
          ]}
          onPress={handlePayWaybill}
          disabled={!user || user.balance < waybillData.price || processing || waybillData.payment > 0}
        >
          {processing ? (
            <View style={styles.payButtonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.payButtonText}>{t('payWaybill.processing')}</Text>
            </View>
          ) : waybillData.payment > 0 ? (
            <Text style={styles.payButtonText}>{t('payWaybill.alreadyPaid')}</Text>
          ) : (
            <Text style={styles.payButtonText}>
              {t('payWaybill.payAmount', { amount: convertPrice(waybillData.price) })}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Payment WebView */}
      {paymentVisible && (
        <View style={styles.webviewOverlay}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setPaymentVisible(false)} style={styles.webviewBackButton}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>{t('payWaybill.completePayment')}</Text>
            <View style={{ width: 22 }} />
          </View>
          {webProgress > 0 && webProgress < 1 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${Math.max(5, Math.floor(webProgress * 100))}%` }]} />
            </View>
          )}
          <WebView
            originWhitelist={["*"]}
            source={{
              uri: 'https://pay2.wanslu.shop/',
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: paymentBody,
            }}
            onLoadStart={() => setWebProgress(0)}
            onLoadProgress={({ nativeEvent }) => setWebProgress(nativeEvent.progress || 0)}
            onLoadEnd={() => setWebProgress(1)}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data || '{}');
                if (data && data.status === 'success') {
                  Alert.alert(t('payOrder.success'), t('payOrder.paymentSuccessful'), [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        setPaymentVisible(false);
                        router.push('/orders');
                      },
                    },
                  ]);
                } else if (data && data.status === 'failed') {
                  Alert.alert(t('payOrder.paymentFailed'), data.message || t('payOrder.paymentFailedMsg'));
                }
              } catch (_e) {}
            }}
            onNavigationStateChange={(navState) => {
              const url = navState?.url || '';
              if (/success/i.test(url) || /status=success/i.test(url)) {
                Alert.alert(t('payOrder.success'), t('payOrder.paymentCompleted'), [
                  {
                    text: t('common.ok'),
                    onPress: () => {
                      setPaymentVisible(false);
                      router.push('/orders');
                    },
                  },
                ]);
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color="#ef4444" />
                <Text style={styles.loadingText}>{t('payOrder.loadingPayment')}</Text>
              </View>
            )}
            style={styles.webview}
          />
        </View>
      )}
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  waybillHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  waybillId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  waybillDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGreen: {
    backgroundColor: '#4cb159',
  },
  statusBlue: {
    backgroundColor: '#3B82F6',
  },
  statusYellow: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paidText: {
    color: '#4cb159',
  },
  unpaidText: {
    color: '#ef4444',
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 8,
  },
  insufficientBalanceText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  payButtonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  payButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#f3f4f6',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: '#ef4444',
  },
  webviewOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  webviewBackButton: {
    padding: 6,
  },
  webviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  },
  webviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
});
