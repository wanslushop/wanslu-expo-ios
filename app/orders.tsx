import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import { OrderChat } from './components/OrderChat';
import OrderPayButton from './components/OrderPayButton';
import { useCartCount } from './context/CartCountContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';

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
  confirm_time: string;
  currency?: string;
  payment: string;
  w_payment: number;
  src: string;
  warehouse: string | null;
  waybill: string | null;
  review: number;
  area: string;
  cancel_reason: string;
  unread_messages_count: number;
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
}

interface OrdersResponse {
  [oid: string]: Order;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  limit: number;
  hasMore: boolean;
  offset: number;
}

interface TrackingData {
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

interface OrderCounts {
  under_review: number;
  pending_payment: number;
  paid: number;
  ordered: number;
  in_warehouse: number;
  shipped_international: number;
  delivered: number;
  cancelled: number;
  refunds: number;
  total: number;
}


export default function OrdersScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { cartCount } = useCartCount();
  const { convertPrice } = useCurrency();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  
  // State management
  const [orders, setOrders] = useState<OrdersResponse>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalOrders: 0,
    limit: 10,
    hasMore: false,
    offset: 0
  });

  const [orderCounts, setOrderCounts] = useState<OrderCounts | null>(null);

  const [filters, setFilters] = useState({
    status: ""
  });

  // Tracking modal state
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [selectedWaybillId, setSelectedWaybillId] = useState<string>("");

  // Chat modal state
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedSubOrderId, setSelectedSubOrderId] = useState<number | null>(null);
  const [selectedOid2, setSelectedOid2] = useState<string | null>(null);
  const [selectedProductTitle, setSelectedProductTitle] = useState("");

  // Fetch user data
  const fetchUserData = useCallback(async () => {
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
            username: data.user.username || '',
            email: data.user.email || ''
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  }, [router]);

  const fetchOrderCounts = useCallback(async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch('https://api.wanslu.shop/api/orders/count', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setOrderCounts(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch order counts:', error);
    }
  }, []);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setLoading(true);
      setError(null);
      // Reset pagination for refresh
      setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
    } else {
      setLoadingMore(true);
    }
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      // Build query string inline to avoid dependency issues
      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());
      
      if (filters.status) params.append('status', filters.status);
      
      const queryString = params.toString();
      
      const response = await fetch(`https://api.wanslu.shop/api/orders?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error("Failed to fetch orders");
      
      const data = await response.json();
      
      if (isRefresh) {
        // Replace orders for refresh
        setOrders(data.data || {});
      } else {
        // Append orders for infinite scroll
        setOrders(prev => ({ ...prev, ...data.data }));
      }
      
      // Update pagination info from API meta
      if (data.meta) {
        setPagination(prev => ({
          ...prev,
          totalOrders: data.meta.total,
          limit: Number(data.meta.limit),
          offset: Number(data.meta.offset),
          hasMore: !!data.meta.has_more,
          totalPages: Math.ceil(data.meta.total / Number(data.meta.limit)),
          currentPage: Math.floor(Number(data.meta.offset) / Number(data.meta.limit)) + 1
        }));
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, pagination.offset, pagination.limit, router]);

  // Separate function to fetch orders with specific status (for immediate updates)
  const fetchOrdersWithStatus = useCallback(async (status: string, isRefresh = false) => {
    if (isRefresh) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('offset', '0'); // Always start from 0 for status changes
      
      if (status) params.append('status', status);
      
      const queryString = params.toString();
      const response = await fetch(`https://api.wanslu.shop/api/orders?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        if (isRefresh) {
          setOrders(data.data);
        } else {
          setOrders(prev => ({ ...prev, ...data.data }));
        }
        
        setPagination(prev => ({
          ...prev,
          totalOrders: data.pagination?.total || 0,
          hasMore: data.pagination?.hasMore || false,
          offset: isRefresh ? 0 : prev.offset + prev.limit,
          currentPage: isRefresh ? 1 : prev.currentPage + 1,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pagination.limit, router]);

  const fetchTrackingData = useCallback(async (waybillId: string) => {
    setTrackingLoading(true);
    setTrackingData(null);
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      const response = await fetch(`https://api.wanslu.shop/api/waybill/${waybillId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error("Failed to fetch tracking data");
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setTrackingData(data.data);
      } else {
        throw new Error("Invalid tracking data");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load tracking data");
    } finally {
      setTrackingLoading(false);
    }
  }, [router]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
  };

  const handleLoadMore = () => {
    if (!loadingMore && pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit,
        currentPage: prev.currentPage + 1
      }));
    }
  };

  const handleResetFilters = () => {
    setFilters({
      status: ""
    });
    setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
    setTimeout(() => fetchOrders(true), 100);
  };

  const handleRetry = () => {
    fetchOrders(true);
  };

  const handleTrackClick = (waybillId: string) => {
    setSelectedWaybillId(waybillId);
    setTrackingModalOpen(true);
    fetchTrackingData(waybillId);
  };

  const handleChatClick = (subOrder: SubOrder) => {
    setSelectedSubOrderId(subOrder.id);
    setSelectedOid2(subOrder.oid2);
    setSelectedProductTitle(subOrder.producttitle);
    setChatModalOpen(true);
  };

  // Action handlers
  const handleCancelOrder = async (oid: string) => {
    // Show confirmation popup
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const authToken = await AsyncStorage.getItem('authToken');
              if (!authToken) return;

              const response = await fetch('https://api.wanslu.shop/api/order/cancel', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ oid }),
              });

              if (response.ok) {
                Alert.alert('Success', 'Order cancelled successfully');
                fetchOrders(true); // Refresh orders
              } else {
                Alert.alert('Error', 'Failed to cancel order');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  const handlePayOrder = (oid: string, src: string) => {
    // Navigate to pay-order screen
    router.push({ pathname: '/pay-order', params: { oid } });
  };

  const handleSubmitWaybill = (oid: string) => {
    // Navigate to waybill submission screen
    router.push({ pathname: '/submit-waybill', params: { oid } });
  };

  const handlePayWaybill = (waybillId: string) => {
    router.push({ pathname: '/waybill', params: { wid: waybillId } });
  };

  const handleRateOrder = (oid: string) => {
    // Navigate to order details page where user can view order and potentially rate
    // For now, navigate to pay-order which shows order details
    try {
      if (!oid) {
        Alert.alert(t('common.error'), 'Invalid order ID');
        return;
      }
      router.push({ pathname: '/pay-order', params: { oid: String(oid) } });
    } catch (error) {
      console.error('Error navigating to rate order:', error);
      Alert.alert(t('common.error'), 'Failed to open order details');
    }
  };

  const handleOrderHelp = (oid: string) => {
    // Navigate to help-order screen
    try {
      if (!oid) {
        Alert.alert(t('common.error'), 'Invalid order ID');
        return;
      }
      router.push({ pathname: '/help-order', params: { oid: String(oid) } });
    } catch (error) {
      console.error('Error navigating to help order:', error);
      Alert.alert(t('common.error'), 'Failed to open help page');
    }
  };

  const handleTrackPackage = (waybillId: string) => {
    setSelectedWaybillId(waybillId);
    setTrackingModalOpen(true);
    fetchTrackingData(waybillId);
  };

  // Render order actions based on status and conditions
  const renderOrderActions = (orderRow: SubOrder, oid: string) => {
    const actions = [];

    // Under Review - Cancel button
    if (orderRow.status === 'Under Review') {
      actions.push(
        <TouchableOpacity
          key="cancel"
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => handleCancelOrder(oid)}
        >
          <Text style={styles.actionButtonText}>{t('orders.cancel')}</Text>
        </TouchableOpacity>
      );
    }
    // Confirmed with payment=0 - Pay button with timer
    else if (orderRow.status === 'Confirmed' && orderRow.payment === '0') {
      actions.push(
        <OrderPayButton
          key="pay"
          orderRow={{
            time: orderRow.confirm_time || orderRow.time,
            username: orderRow.username,
            user_id: orderRow.user_id
          }}
          oid={oid}
          onPayPress={(oid) => handlePayOrder(oid, orderRow.src)}
        />
      );
    }
    // In Warehouse without waybill - Submit Waybill button
    else if (orderRow.status === 'In Warehouse' && !orderRow.waybill) {
      actions.push(
        <TouchableOpacity
          key="waybill"
          style={[styles.actionButton, styles.waybillButton]}
          onPress={() => handleSubmitWaybill(oid)}
        >
          <Text style={styles.actionButtonText}>{t('orders.submitWaybill')}</Text>
        </TouchableOpacity>
      );
    }
    // In Warehouse with waybill - Pay Waybill button
    else if (orderRow.status === 'In Warehouse' && orderRow.waybill && orderRow.w_payment === 0) {
      actions.push(
        <TouchableOpacity
          key="waybill"
          style={[styles.actionButton, styles.payButton]}
          onPress={() => handlePayWaybill(orderRow.waybill!)}
        >
          <Text style={styles.actionButtonText}>{t('orders.payWaybill')}</Text>
        </TouchableOpacity>
      );
    }
  
    // In Warehouse with waybill - Pay Waybill button
    else if (orderRow.status === 'In Warehouse' && orderRow.waybill && orderRow.w_payment === 1) {
      actions.push(
        <TouchableOpacity
          key="view-waybill"
          style={[styles.actionButton, styles.payButton]}
          onPress={() => handlePayWaybill(orderRow.waybill!)}
        >
          <Text style={styles.actionButtonText}>{t('orders.viewWaybill')}</Text>
        </TouchableOpacity>
      );
    }
  
    // Note: For waybill payment scenarios, we would need additional waybill data
    // from the API to check waybill status, payment status, and COD status
    // This would require extending the order data structure or making additional API calls
    // Delivered without review - Rate and Help buttons
    else if (orderRow.status === 'Delivered' && orderRow.review === 0) {
      actions.push(
        <TouchableOpacity
          key="rate"
          style={[styles.actionButton, styles.rateButton]}
          onPress={() => handleRateOrder(oid)}
        >
          <Text style={styles.actionButtonText}>{t('orders.rateOrder')}</Text>
        </TouchableOpacity>
      );
      actions.push(
        <TouchableOpacity
          key="help"
          style={[styles.actionButton, styles.helpButton]}
          onPress={() => handleOrderHelp(oid)}
        >
          <Text style={styles.actionButtonText}>{t('orders.help')}</Text>
        </TouchableOpacity>
      );
    }
    // Delivered with review - Help button only
    else if (orderRow.status === 'Delivered') {
      actions.push(
        <TouchableOpacity
          key="help"
          style={[styles.actionButton, styles.helpButton]}
          onPress={() => handleOrderHelp(oid)}
        >
          <Text style={styles.actionButtonText}>{t('orders.help')}</Text>
        </TouchableOpacity>
      );
    }
    // Shipped International - Track button
    else if (orderRow.status === 'Shipped International' && orderRow.waybill) {
      actions.push(
        <TouchableOpacity
          key="track"
          style={[styles.actionButton, styles.trackButton]}
          onPress={() => handleTrackPackage(orderRow.waybill!)}
        >
          <Text style={styles.actionButtonText}>{t('orders.track')}</Text>
        </TouchableOpacity>
      );
    }

    return actions.length > 0 ? (
      <View style={styles.actionButtonsContainer}>
        {actions}
      </View>
    ) : null;
  };

  const statusOptions = [
    { label: t('orders.all'), value: 'all' },
    { label: t('orders.underReview'), value: 'Under Review' },
    { label: t('orders.pendingPayment'), value: 'Pending Payment' },
    { label: t('orders.paid'), value: 'Paid' },
    { label: t('orders.ordered'), value: 'Ordered' },
    { label: t('orders.inWarehouse'), value: 'In Warehouse' },
    { label: t('orders.shippedInternational'), value: 'Shipped International' },
    { label: t('orders.delivered'), value: 'Delivered' },
    { label: t('orders.cancelled'), value: 'Cancelled' },
    { label: t('orders.refunds'), value: 'Refunds' },
  ];

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const getCountForStatus = (statusValue: string) => {
    if (!orderCounts) return null;
    if (statusValue === 'all') return orderCounts.total;

    const key = statusValue.toLowerCase().replace(/ /g, '_') as keyof OrderCounts;
    return orderCounts[key];
  };

  // convertPrice is now provided by CurrencyContext

  // Effects
  useEffect(() => {
    fetchUserData();
    fetchOrderCounts();
  }, [fetchUserData, fetchOrderCounts]);

  useEffect(() => {
    fetchOrders();
  }, [filters, pagination.offset, pagination.limit]);

  // Separate effect for initial load
  useEffect(() => {
    fetchOrders(true);
  }, []);


  // Render order item
  const renderOrderItem = ({ item }: { item: [string, Order] }) => {
    const [oid, order] = item;
    const orderRow = Object.values(order.items)[0];
    const summary = order.summary;
    
    // Determine status style
    let statusStyle = styles.statusYellow;
    switch(orderRow.status) {
      case 'Paid':
        statusStyle = styles.statusGreen;
        break;
      case 'Confirmed':
        statusStyle = styles.statusGreen;
        break;
      case 'Ordered':
        statusStyle = styles.statusGreen;
        break;
      case 'Delivered':
        statusStyle = styles.statusGreen;
        break;
      case 'At Warehouse':
        statusStyle = styles.statusCyan;
        break;
      case 'Cancelled':
        statusStyle = styles.statusRed;
        break;
      default:
        statusStyle = styles.statusYellow;
    }

    return (
      <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/pay-order', params: { oid } })}>
            <Text style={styles.orderId}>#{oid}</Text>
            <Text style={styles.orderDate}>
              {new Date(orderRow.time).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </TouchableOpacity>
          <View style={styles.orderHeaderRight}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/invoice', params: { oid } })}>
          <Text style={styles.invoiceLink}>{t('orders.invoice')}</Text>
        </TouchableOpacity>
           
          </View>
        </View>
        
        <View style={styles.orderStatusRow}>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={[styles.statusText, statusStyle]}>
              {orderRow.status}
            </Text>
          </View>
          
          {/* Action according to Status here  */}
          {renderOrderActions(orderRow, oid)}
        </View>
        
        <View style={styles.orderItems}>
          {Object.values(order.items).map(sub => (
            <TouchableOpacity 
              key={sub.oid2} 
              style={styles.orderItem}
              onPress={() => {
                // Navigate to product detail page
                const normalizeSrc = (src: string | undefined) => {
                  if (!src) return '1688';
                  if (src.toLowerCase() === 'retail') return 'tb';
                  if (src.toLowerCase() === 'wholesale') return '1688';
                  if (src.toLowerCase() === 'local') return 'local';
                  if (src.toLowerCase() === 'chinese') return 'chinese';
                  return src.toLowerCase();
                };
                
                const productSrc = normalizeSrc(sub.src);
                router.push({
                  pathname: '/product-detail',
                  params: {
                    id: sub.pid,
                    src: productSrc,
                  }
                });
              }}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: sub.vimg }} 
                style={styles.productImage}
                defaultSource={require('./assets/logo.png')}
              />
              
              <View style={styles.productDetails}>
                <View style={styles.productHeader}>
                  <View style={styles.displaySideBySide}>
                  <Text style={styles.subOrderId}>#{sub.oid2}</Text>
                  {sub.status !== 'Cancelled' && (
                      <TouchableOpacity onPress={(e) => {
                        e.stopPropagation();
                        handleChatClick(sub);
                      }}>
                        <View style={styles.chatButton}>
                          <Ionicons 
                            name="chatbox-ellipses-outline" 
                            size={16} 
                            color={sub.unread_messages_count > 0 ? '#E53E3E' : '#666'} 
                          />
                          {sub.unread_messages_count > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadCount}>{sub.unread_messages_count}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    </View>
                  {sub.addservices && (
                    <Text style={styles.addServices}>
                      {t('orders.additionalServices')}: {sub.addservices}
                    </Text>
                  )}
                </View>

                <Text style={styles.productTitle}>{sub.producttitle}</Text>
                
                <View style={styles.productInfo}>
                  <View style={styles.variantQuantity}>
                    <Text style={styles.variantText}>{sub.variant} x {sub.quantity}</Text>
                   
                  </View>
                  
                  <View style={[styles.itemStatusBadge, 
                    sub.status === 'Delivered' ? styles.statusGreen :
                    sub.status === 'Confirmed' ? styles.statusGreen :
                    sub.status === 'Paid' ? styles.statusGreen :
                    sub.status === 'Ordered' ? styles.statusGreen :
                    sub.status === 'Cancelled' ? styles.statusRed :
                    styles.statusYellow
                  ]}>
                    <Text style={[styles.itemStatusText, 
                      sub.status === 'Delivered' ? styles.statusGreen :
                      sub.status === 'Confirmed' ? styles.statusGreen :
                      sub.status === 'Paid' ? styles.statusGreen :
                      sub.status === 'Ordered' ? styles.statusGreen :
                      sub.status === 'Cancelled' ? styles.statusRed :
                      styles.statusYellow
                    ]}>
                      {sub.status}
                    </Text>
        </View>
      </View>
      
                {sub.status === 'Cancelled' && (
                  <Text style={styles.cancelReason}>
                    {t('orders.cancelledReason')}: {sub.cancel_reason}
                  </Text>
                )}
               
                <Text style={styles.productPrice}>
                  {convertPrice(parseFloat(sub.price) * sub.quantity)}
                </Text>
        </View>
        </TouchableOpacity>
          ))}
        </View>

        <View style={styles.orderSummary}>
          <Text style={styles.summaryText}>
            {t('orders.subtotal')}: <Text style={styles.summaryPrice}>{convertPrice(summary.subtotal)}</Text>
          </Text>
          <View style={styles.summaryDetails}>
            {summary.total_shipping > 0 && (
              <Text style={styles.summaryText}>
                {t('orders.localShipping')}: <Text style={styles.summaryPrice}>{convertPrice(summary.total_shipping)}</Text>
              </Text>
            )}
            {summary.additional_services_total > 0 && (
              <Text style={styles.summaryText}>
                {t('orders.additionalServicesTotal')}: <Text style={styles.summaryPrice}>{convertPrice(summary.additional_services_total)}</Text>
              </Text>
            )}
            <Text style={styles.summaryText}>
              {t('orders.toPay')}: <Text style={styles.summaryPrice}>{convertPrice(summary.total)}</Text>
            </Text>
        </View>
      </View>
      
        <View style={styles.shippingInfo}>
          <Text style={styles.shippingText}>
            <Text style={styles.shippingLabel}>{t('orders.shippingMethod')}:</Text> {summary.delivery_method_name}
          </Text>
          <Text style={styles.shippingText}>
            <Text style={styles.shippingLabel}>{t('orders.address')}:</Text> {orderRow.fulladdress} ({orderRow.area})
          </Text>
      </View>
      </View>
    );
  };



  // Render tracking modal
  const renderTrackingModal = () => (
    <Modal
      visible={trackingModalOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setTrackingModalOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('orders.trackingInformation')}</Text>
            <TouchableOpacity onPress={() => setTrackingModalOpen(false)}>
              <Ionicons name="close" size={24} color="#333" />
    </TouchableOpacity>
          </View>
                    <View style={styles.modalBody}>

          <Text style={styles.trackingId}>{t('orders.waybillId')}: {selectedWaybillId}</Text>
          
          {trackingLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>{t('orders.loadingTrackingData')}</Text>
            </View>
          ) : trackingData ? (
            <ScrollView style={styles.trackingContent}>
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.status')}:</Text>
                <View style={[styles.trackingStatusBadge, 
                  trackingData.status === 'Delivered' ? styles.statusGreen :
                  trackingData.status === 'Shipped' ? styles.statusBlue :
                  styles.statusYellow
                ]}>
                  <Text style={styles.trackingStatusText}>{trackingData.status}</Text>
                </View>
              </View>
              
              {trackingData.couriercompany && (
                <View style={styles.trackingRow}>
                  <Text style={styles.trackingLabel}>{t('orders.courier')}:</Text>
                  <Text style={styles.trackingValue}>{trackingData.couriercompany}</Text>
                </View>
              )}
              
              {trackingData.ctracking && (
                <View style={styles.trackingRow}>
                  <Text style={styles.trackingLabel}>{t('orders.trackingId')}:</Text>
                  <Text style={styles.trackingIdValue}>{trackingData.ctracking}</Text>
                </View>
              )}
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.weight')}:</Text>
                <Text style={styles.trackingValue}>{trackingData.weight} g</Text>
              </View>
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.volume')}:</Text>
                <Text style={styles.trackingValue}>{trackingData.volume} cm³</Text>
              </View>
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.price')}:</Text>
                <Text style={styles.trackingPrice}>{convertPrice(trackingData.price)}</Text>
              </View>
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.cod')}:</Text>
                <Text style={styles.trackingValue}>{trackingData.cod > 0 ? 'Yes' : 'No'}</Text>
              </View>
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.destination')}:</Text>
                <Text style={styles.trackingValue}>{trackingData.area}</Text>
              </View>
              
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>{t('orders.created')}:</Text>
                <Text style={styles.trackingValue}>
                  {new Date(trackingData.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              
              {trackingData.remarks && (
                <View style={styles.trackingRow}>
                  <Text style={styles.trackingLabel}>{t('orders.remarks')}:</Text>
                  <Text style={styles.trackingValue}>{trackingData.remarks}</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.noTrackingContainer}>
              <Text style={styles.noTrackingText}>{t('orders.noTrackingInformation')}</Text>
            </View>
          )}
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!user) {
  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('navigation.orders')}</Text>
        </View>
        {/* Status dropdown and filter button row */}
        <View style={styles.statusFilterRow}>
          <TouchableOpacity
            style={styles.statusDropdown}
            onPress={() => setStatusDropdownOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.statusDropdownText} numberOfLines={1}>
              {filters.status ? statusOptions.find(opt => opt.value === filters.status)?.label || filters.status : t('orders.all')}
            </Text>
            {orderCounts && filters.status && filters.status !== 'all' && (
              <View style={styles.statusCountBadge}>
                <Text style={styles.statusCountText}>{getCountForStatus(filters.status)}</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={18} color="#222" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E53E3E" />
            <Text style={styles.loadingText}>{t('orders.loadingOrders')}</Text>
          </View>
                 ) : error ? (
           <View style={styles.errorContainer}>
             <Text style={styles.errorText}>{error}</Text>
             <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
               <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
             </TouchableOpacity>
           </View>
         ) : Object.keys(orders).length === 0 ? (
           <View style={styles.emptyContainer}>
             <Text style={styles.emptyText}>{t('orders.noOrdersFound')}</Text>
             <TouchableOpacity style={styles.resetFiltersButton} onPress={handleResetFilters}>
               <Text style={styles.resetFiltersButtonText}>{t('orders.resetFilters')}</Text>
             </TouchableOpacity>
           </View>
         ) : (
           <>
        <FlatList
               data={Object.entries(orders)}
          renderItem={renderOrderItem}
               keyExtractor={(item) => item[0]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
               onEndReached={handleLoadMore}
               onEndReachedThreshold={0.1}
               ListFooterComponent={() => 
                 loadingMore ? (
                   <View style={styles.loadingMoreContainer}>
                     <ActivityIndicator size="small" color="#E53E3E" />
                     <Text style={styles.loadingMoreText}>{t('orders.loadingMoreOrders')}</Text>
                   </View>
                 ) : null
               }
             />
             
             {/* Order count info */}
             {pagination.totalOrders > 0 && (
               <View style={styles.orderCountContainer}>
                 <Text style={styles.orderCountText}>
                   {t('orders.showingOrders', { current: Object.keys(orders).length, total: pagination.totalOrders })}
                 </Text>
      </View>
             )}
           </>
         )}
      </View>
      

      {renderTrackingModal()}
      {selectedSubOrderId && selectedOid2 && (
        <OrderChat
          visible={chatModalOpen}
          onClose={() => {
            setChatModalOpen(false);
            setSelectedSubOrderId(null);
            setSelectedOid2(null);
            setSelectedProductTitle("");
          }}
          subOrderId={selectedSubOrderId}
          oid2={selectedOid2}
          productTitle={selectedProductTitle}
        />
      )}

      {/* Status dropdown modal at root */}
      <Modal
        visible={statusDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusDropdownOpen(false)}
      >
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setStatusDropdownOpen(false)}>
          <View style={styles.dropdownModal}>
            <FlatList
              data={statusOptions}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                                  onPress={() => {
                  const newStatus = item.value === 'all' ? '' : item.value;
                  setFilters(prev => ({ ...prev, status: newStatus }));
                  setStatusDropdownOpen(false);
                  // Reset pagination and refresh orders with new status
                  setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
                  // Pass the new status directly to avoid stale state
                  setTimeout(() => fetchOrdersWithStatus(newStatus, true), 100);
                }}
                >
                  <Text style={styles.dropdownItemText}>{item.label}</Text>
                  {orderCounts && item.value !== 'all' && (
                    <View style={styles.statusCountBadge}>
                      <Text style={styles.statusCountText}>{getCountForStatus(item.value)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
      
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#E53E3E',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  resetFiltersButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetFiltersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  // Order card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f1f1',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
    backgroundColor: '#fff',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    letterSpacing: 0.5,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  invoiceLink: {
    color: '#E53E3E',
    fontSize: 14,
    textDecorationLine: 'underline',
    fontWeight: '500',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
    marginTop: 2,
  },
  // Status row
  orderStatusRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    gap: 10,
  },
  statusBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    minWidth: 80,
  },
  // Status color variants
  statusGreen: {
    backgroundColor: '#4cb159',
  },
  statusRed: {
    backgroundColor: '#EF4444',
  },
  statusYellow: {
    backgroundColor: '#F59E0B',
  },
  statusCyan: {
    backgroundColor: '#06B6D4',
  },
  statusBlue: {
    backgroundColor: '#3B82F6',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Action buttons
  // Product list
  orderItems: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    backgroundColor: '#fff',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 14,
    backgroundColor: '#fafbfc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  displaySideBySide: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subOrderId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  addServices: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
    fontWeight: '500',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
    flexShrink: 1,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  variantQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  variantText: {
    fontSize: 13,
    color: '#888',
    marginRight: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  unreadBadge: {
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 5,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemStatusBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  itemStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelReason: {
    fontSize: 13,
    color: '#E53E3E',
    marginTop: 3,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginTop: 2,
  },
  // Order summary
  orderSummary: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 2,
    backgroundColor: '#fff',
  },
  summaryText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  summaryDetails: {
    marginTop: 2,
  },
  // Shipping info
  shippingInfo: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f3f3',
},
  shippingText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  shippingLabel: {
    fontWeight: 'bold',
    color: '#555',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: 350,
  },
  filterSection: {
    width: '100%',
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackingContent: {
    paddingTop: 10,
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackingLabel: {
    fontSize: 15,
    color: '#555',
    fontWeight: 'bold',
  },
  trackingValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  trackingIdValue: {
    fontSize: 15,
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  trackingPrice: {
    fontSize: 15,
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  trackingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noTrackingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noTrackingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  trackingId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 10,
  },
  paginationInfo: {
    fontSize: 14,
    color: '#555',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#E53E3E',
    marginHorizontal: 5,
  },
  pageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 5,
  },
     pageButtonDisabled: {
     backgroundColor: '#ccc',
     opacity: 0.7,
   },
   loadingMoreContainer: {
     paddingVertical: 20,
     alignItems: 'center',
   },
   loadingMoreText: {
     marginTop: 8,
     fontSize: 14,
     color: '#666',
   },
   orderCountContainer: {
     paddingVertical: 10,
     paddingHorizontal: 15,
     backgroundColor: '#f0f0f0',
     borderRadius: 8,
     marginTop: 10,
     alignItems: 'center',
   },
   orderCountText: {
     fontSize: 14,
     color: '#555',
  },
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
},
statusDropdown: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#eee',
  paddingHorizontal: 14,
    paddingVertical: 8,
  marginRight: 10,
  minWidth: 160,
},
statusDropdownText: {
  fontSize: 15,
  color: '#222',
  fontWeight: '500',
  maxWidth: 90,
},
statusCountBadge: {
  backgroundColor: '#F59E0B',
  borderRadius: 999,
  paddingHorizontal: 7,
  paddingVertical: 2,
  marginLeft: 6,
  minWidth: 22,
    alignItems: 'center',
  justifyContent: 'center',
  },
statusCountText: {
  color: '#fff',
    fontWeight: 'bold',
  fontSize: 13,
},
dropdownOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.08)',
  justifyContent: 'center',
  alignItems: 'center',
},
dropdownModal: {
  backgroundColor: '#fff',
  borderRadius: 12,
  paddingVertical: 8,
  width: 240,
  maxHeight: 400,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.10,
  shadowRadius: 12,
  elevation: 8,
},
dropdownItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 18,
},
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
    flex: 1,
  },
  // Action buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  payButton: {
    backgroundColor: '#4cb159',
  },
  waybillButton: {
    backgroundColor: '#ed2027',
  },
  rateButton: {
    backgroundColor: '#22C55E',
  },
  helpButton: {
    backgroundColor: '#EF4444',
  },
  trackButton: {
    backgroundColor: '#3B82F6',
  },
  waybillStatusText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
