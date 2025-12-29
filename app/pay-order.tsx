import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import PaymentTimer from './components/PaymentTimer';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface SubOrder {
  id: number;
  pid: string;
  oid: string;
  oid2: string;
  user_id: number;
  username: string;
  producttitle: string;
  vimg: string;
  variant: string;
  quantity: number;
  price: string;
  status: string;
  addservices: string | null;
  country: string;
  countrycode: string;
  fulladdress: string;
  time: string;
  currency?: string;
  payment: string;
  src: string;
  warehouse: string | null;
  waybill: string | null;
  review: number;
  area: string;
  cancel_reason: string;
  unread_messages_count: number;
  dom_shipping: string;
  currencyrate: string;
  confirm_time: string;
}

interface OrderSummary {
  subtotal: number;
  total_shipping: number;
  additional_services_total: number;
  total: number;
  delivery_method_name: string;
}

interface Order {
  items: {
    [key: string]: SubOrder;
  };
  summary: OrderSummary;
}

interface UserInfo {
  username: string;
  email: string;
  balance: number;
}

export default function PayOrderScreen() {
  const { t } = useI18n();
  const { oid } = useLocalSearchParams<{ oid: string }>();
  const { convertPrice } = useCurrency();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentBody, setPaymentBody] = useState<string>('');
  const [webProgress, setWebProgress] = useState(0);
  const [expired, setExpired] = useState(false);

  const fetchOrderData = useCallback(async () => {
    if (!oid) {
      setError('Order ID is required');
      setLoading(false);
      return;
    }

    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.replace('/login');
        return;
      }

      // Fetch order details
      const orderResponse = await fetch(`https://api.wanslu.shop/api/order/${oid}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to fetch order details');
      }

      const orderData = await orderResponse.json();
      if (orderData.status === 'success' && orderData.data) {
        // The API returns data nested under order ID key
        const orderId = Object.keys(orderData.data)[0];
        const orderInfo = orderData.data[orderId];
        
        if (orderInfo && orderInfo.items) {
          // Calculate summary from items
          const items = Object.values(orderInfo.items);
          const subtotal = items.reduce((sum: number, item: any) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            const itemTotal = price * quantity;
            return sum + (isNaN(itemTotal) ? 0 : itemTotal);
          }, 0);
          const total_shipping = items.reduce((sum: number, item: any) => {
            const shipping = parseFloat(item.dom_shipping || '0') || 0;
            return sum + (isNaN(shipping) ? 0 : shipping);
          }, 0);
          const additional_services_total = items.reduce((sum: number, item: any) => {
            if (!item.addservices) return sum;
            const services = parseFloat(item.addservices) || 0;
            return sum + (isNaN(services) ? 0 : services);
          }, 0);
          const total = (subtotal || 0) + (total_shipping || 0) + (additional_services_total || 0);
          
          const orderWithSummary = {
            items: orderInfo.items,
            summary: {
              subtotal: isNaN(subtotal) ? 0 : subtotal,
              total_shipping: isNaN(total_shipping) ? 0 : total_shipping,
              additional_services_total: isNaN(additional_services_total) ? 0 : additional_services_total,
              total: isNaN(total) ? 0 : total,
              delivery_method_name: 'Standard Delivery' // Default since not in response
            }
          };
          
          setOrder(orderWithSummary);
        } else {
          throw new Error('Invalid order structure');
        }
      } else {
        throw new Error('Invalid order data');
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
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  }, [oid]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // Check if payment has expired (72 hours from order confirmation time)
  useEffect(() => {
    if (!order) {
      setExpired(false);
      return;
    }

    const orderRow = Object.values(order.items)[0];
    const getIsExpired = () => {
      // Use confirm_time if available, otherwise use time
      const orderTime = orderRow.confirm_time || orderRow.time;
      if (!orderTime) {
        return false; // If no time available, don't expire
      }
      const orderDate = new Date(orderTime);
      // Check if date is valid
      if (isNaN(orderDate.getTime())) {
        return false; // Invalid date, don't expire
      }
      const expiryDate = new Date(orderDate.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      const now = new Date();
      return expiryDate.getTime() - now.getTime() <= 0;
    };

    const isExpired = getIsExpired();
    setExpired(isExpired);

    if (isExpired) {
      return;
    }

    const interval = setInterval(() => {
      const checkExpired = getIsExpired();
      if (checkExpired) {
        setExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const handlePayOrder = async () => {
    if (!order || !user) return;

    const orderRow = Object.values(order.items)[0];
    const totalAmount = order.summary.total;

    

    // Show confirmation dialog
    Alert.alert(
      t('payOrder.confirmPayment'),
      t('payOrder.confirmPaymentMsg', { amount: convertPrice(totalAmount), oid }),
      [
        { text: t('payOrder.cancel'), style: 'cancel' },
        { text: t('payOrder.payNow'), onPress: openPaymentWebView }
      ]
    );
  };

  const openPaymentWebView = async () => {
    if (!order || !oid) return;

    setProcessing(true);
    try {
      const orderRow = Object.values(order.items)[0];
      
      // Create form data for payment
      const body = new URLSearchParams({
        oid: oid,
        username: orderRow.username,
        uid: String(orderRow.user_id),
        order: String(orderRow.oid),
        source: 'app'
      }).toString();
      
      setPaymentBody(body);
      setPaymentVisible(true);
    } catch (e) {
      console.error('Open payment failed:', e);
      Alert.alert('Error', 'Failed to open payment page');
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
          <Text style={styles.title}>{t('payOrder.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('payOrder.loadingOrderDetails')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('payOrder.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error || t('payOrder.orderNotFound')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOrderData}>
            <Text style={styles.retryButtonText}>{t('payOrder.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const orderRow = Object.values(order.items)[0];
  const summary = order.summary;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('payOrder.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>{t('payOrder.orderNumber') || 'Order #'}{oid}</Text>
          <Text style={styles.orderStatus}>{orderRow.status}</Text>
          <Text style={styles.orderDate}>
            {new Date(orderRow.time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.orderItemsSection}>
          <Text style={styles.sectionTitle}>{t('payOrder.orderItems')}</Text>
          {Object.values(order.items).map(sub => (
            <View key={sub.oid2} style={styles.orderItem}>
              <Image 
                source={{ uri: sub.vimg }} 
                style={styles.productImage}
                defaultSource={require('./assets/logo.png')}
              />
              <View style={styles.productDetails}>
                <Text style={styles.productTitle}>{sub.producttitle}</Text>
                <Text style={styles.productVariant}>{sub.variant} x {sub.quantity}</Text>
                {sub.addservices && (
                  <Text style={styles.addServices}>
                    {t('payOrder.additionalServices')}: {sub.addservices}
                  </Text>
                )}
                <Text style={styles.productPrice}>
                  {convertPrice(parseFloat(sub.price) * sub.quantity)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Order Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>{t('payOrder.orderSummary')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('payOrder.subtotal')}:</Text>
            <Text style={styles.summaryValue}>{convertPrice(summary.subtotal)}</Text>
          </View>
          {summary.total_shipping > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('payOrder.localShipping')}:</Text>
              <Text style={styles.summaryValue}>{convertPrice(summary.total_shipping)}</Text>
            </View>
          )}
          {summary.additional_services_total > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('payOrder.additionalServices')}:</Text>
              <Text style={styles.summaryValue}>{convertPrice(summary.additional_services_total)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t('payOrder.totalAmount')}:</Text>
            <Text style={styles.totalValue}>{convertPrice(summary.total)}</Text>
          </View>
        </View>

        {/* Shipping Info */}
        <View style={styles.shippingSection}>
          <Text style={styles.sectionTitle}>{t('payOrder.shippingInformation')}</Text>
          <Text style={styles.shippingText}>
            <Text style={styles.shippingLabel}>{t('payOrder.method')}:</Text> {summary.delivery_method_name}
          </Text>
          <Text style={styles.shippingText}>
            <Text style={styles.shippingLabel}>{t('payOrder.address')}:</Text> {orderRow.fulladdress} ({orderRow.area})
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.payButtonContainer}>
        {orderRow.status === 'Under Review' ? (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{orderRow.status}</Text>
          </View>
        ) : orderRow.payment === '1' || parseFloat(orderRow.payment || '0') === 1 ? (
          <View style={[styles.statusContainer, styles.paidContainer]}>
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text style={[styles.statusText, styles.paidText]}>Paid</Text>
          </View>
        ) : (
          <>
            {!expired && (
              <TouchableOpacity
                style={[
                  styles.payButton,
                  (!user || user.balance < summary.total || processing) && styles.payButtonDisabled
                ]}
                onPress={handlePayOrder}
                disabled={!user || user.balance < summary.total || processing}
              >
                {processing ? (
                  <View style={styles.payButtonContent}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.payButtonText}>{t('payOrder.processing')}</Text>
                  </View>
                ) : (
                  <Text style={styles.payButtonText}>
                    {t('orders.pay')} {convertPrice(summary.total)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {(orderRow.payment === '0' || parseFloat(orderRow.payment || '1') === 0) && (
              <PaymentTimer orderTime={orderRow.confirm_time || orderRow.time} />
            )}          </>
        )}
      </View>

      {/* Payment WebView */}
      {paymentVisible && (
        <View style={styles.webviewOverlay}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setPaymentVisible(false)} style={styles.webviewBackButton}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>{t('payOrder.completePayment')}</Text>
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
  orderHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  orderStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderItemsSection: {
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
  orderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f3f4f6',
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productVariant: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  addServices: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  summarySection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  shippingSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shippingText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  shippingLabel: {
    fontWeight: '600',
    color: '#111827',
  },
  balanceSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  statusContainer: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  paidContainer: {
    backgroundColor: '#ecfdf5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  paidText: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: 'bold',
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
