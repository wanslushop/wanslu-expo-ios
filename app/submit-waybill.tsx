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
  weight: number;
  volume: number;
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

interface ShippingOption {
  carrier_id: number;
  carrier_name: string;
  carrier_logo: string;
  cost: number;
  delivery_time: string;
  description: string;
  billing_method: string;
  template_id: number;
  dmid: string;
}

interface WaybillOptions {
  order_id: string;
  shipping_options: ShippingOption[];
  metrics: {
    total_weight: number;
    total_volume: number;
    goods_type: string;
    item_count: number;
  };
}

export default function SubmitWaybillScreen() {
  const { oid } = useLocalSearchParams<{ oid: string }>();
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [waybillOptions, setWaybillOptions] = useState<WaybillOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codEnabled, setCodEnabled] = useState<boolean>(false);
  const [userCountry, setUserCountry] = useState<string>('US');

  // African country codes
  const africanCountryCodes = [
    'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CD', 'CG', 'DJ', 'EG',
    'GQ', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML',
    'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS',
    'SD', 'TZ', 'TG', 'TN', 'UG', 'ZA', 'ZW'
  ];

  const fetchOrderData = useCallback(async () => {
    if (!oid) {
      setError(t('helpOrder.orderIdRequired'));
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
        throw new Error(t('submitWaybill.errors.failedToFetchOrder'));
      }

      const orderData = await orderResponse.json();
      if (orderData.status === 'success' && orderData.data) {
        // The API returns data nested under order ID key
        const orderId = Object.keys(orderData.data)[0];
        const orderInfo = orderData.data[orderId];
        
        if (orderInfo && orderInfo.items) {
          // Check if waybill already exists
          const hasWaybill = Object.values(orderInfo.items).some((item: any) => item.waybill);
          
          if (hasWaybill) {
            Alert.alert('Error', 'Waybill already submitted for this order', [
              { text: 'OK', onPress: () => router.push('/orders') }
            ]);
            return;
          }

          // Calculate summary from items
          const items = Object.values(orderInfo.items);
          const subtotal = items.reduce((sum: number, item: any) => 
            sum + (parseFloat(item.price) * item.quantity), 0
          );
          const total_shipping = items.reduce((sum: number, item: any) => 
            sum + parseFloat(item.dom_shipping || '0'), 0
          );
          const additional_services_total = items.reduce((sum: number, item: any) => 
            sum + (item.addservices ? parseFloat(item.addservices) : 0), 0
          );
          const total = subtotal + total_shipping + additional_services_total;
          
          const orderWithSummary = {
            items: orderInfo.items,
            summary: {
              subtotal,
              total_shipping,
              additional_services_total,
              total,
              delivery_method_name: 'Standard Delivery'
            }
          };
          
          setOrder(orderWithSummary);
        } else {
          throw new Error(t('submitWaybill.errors.invalidOrderStructure'));
        }
      } else {
        throw new Error(t('submitWaybill.errors.invalidOrderData'));
      }
    } catch (err: any) {
      setError(err.message || t('submitWaybill.errors.failedToLoadOrder'));
    }
  }, [oid]);

  const fetchWaybillOptions = useCallback(async () => {
    if (!oid) return;

    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.replace('/login');
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/waybill/options', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oid })
      });
      
      if (!response.ok) {
        throw new Error(t('submitWaybill.errors.failedToFetchOptions'));
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setWaybillOptions(data.data);
        // Auto-select first option if available
        if (data.data.shipping_options.length > 0) {
          setSelectedCarrier(data.data.shipping_options[0].carrier_id);
        }
      } else {
        throw new Error(t('submitWaybill.errors.failedToLoadOptions'));
      }
    } catch (err: any) {
      setError(err.message || t('submitWaybill.errors.failedToLoadOptions'));
    }
  }, [oid]);

  const getUserCountry = useCallback(async () => {
    try {
      // Try to get country from AsyncStorage or use default
      const geoData = await AsyncStorage.getItem('geo-data');
      if (geoData) {
        const parsed = JSON.parse(geoData);
        setUserCountry(parsed.countryCode || 'US');
      } else {
        setUserCountry('US');
      }
    } catch (error) {
      console.error('Error parsing geo-data:', error);
      setUserCountry('US');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await getUserCountry();
      await fetchOrderData();
      await fetchWaybillOptions();
      setLoading(false);
    };
    
    if (oid) {
      loadData();
    }
  }, [oid, fetchOrderData, fetchWaybillOptions, getUserCountry]);

  const handleSubmitWaybill = async () => {
    if (!selectedCarrier) {
      Alert.alert(t('common.error'), t('submitWaybill.pleaseSelectCarrier'));
      return;
    }

    setSubmitting(true);
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.replace('/login');
        return;
      }

      const selectedOption = waybillOptions?.shipping_options.find(
        option => option.carrier_id === selectedCarrier
      );

      if (!selectedOption) {
        throw new Error(t('submitWaybill.selectedOptionNotFound'));
      }

      // Prepare request body
      const requestBody: any = {
        oid,
        weight: Math.max(waybillOptions?.metrics.total_weight || 0, 0.01),
        volume: Math.max(waybillOptions?.metrics.total_volume || 0, 0.01),
        country: userCountry,
        cny: selectedOption.cost,
        dm: selectedOption.carrier_name
      };

      // Add COD amount if it's an African country and COD is enabled
      if (africanCountryCodes.includes(userCountry) && codEnabled) {
        requestBody.cod = 1;
      } else if (africanCountryCodes.includes(userCountry)) {
        requestBody.cod = 0;
      }

      const response = await fetch('https://api.wanslu.shop/api/waybill/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(t('submitWaybill.errors.failedToSubmit'));
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        Alert.alert(t('common.success'), t('submitWaybill.waybillSubmitted'), [
          { text: t('common.ok'), onPress: () => router.push('/orders') }
        ]);
      } else {
        throw new Error(data.message || t('submitWaybill.errors.failedToSubmit'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('submitWaybill.errors.failedToSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('submitWaybill.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('submitWaybill.loadingOptions')}</Text>
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
          <Text style={styles.title}>{t('submitWaybill.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error || t('submitWaybill.orderNotFound')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            setError(null);
            fetchOrderData();
            fetchWaybillOptions();
          }}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const orderRow = Object.values(order.items)[0];
  const summary = order.summary;
  const orderItems = Object.values(order.items);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('submitWaybill.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>{t('submitWaybill.orderId')} #{oid}</Text>
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

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('submitWaybill.orderDetails')}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitWaybill.totalWeight')}</Text>
            <Text style={styles.detailValue}>{waybillOptions?.metrics.total_weight || 0} {t('submitWaybill.unitKg')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitWaybill.totalVolume')}</Text>
            <Text style={styles.detailValue}>{waybillOptions?.metrics.total_volume || 0} {t('submitWaybill.unitM3')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitWaybill.items')}</Text>
            <Text style={styles.detailValue}>{waybillOptions?.metrics.item_count || orderItems.length}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitWaybill.totalValue')}</Text>
            <Text style={styles.detailValue}>{convertPrice(summary.total)}</Text>
          </View>
        </View>

        {/* Shipping Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('submitWaybill.shippingAddress')}</Text>
          <Text style={styles.addressText}>{orderRow.fulladdress}</Text>
          <Text style={styles.areaText}>{orderRow.area}</Text>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('submitWaybill.orderItems')}</Text>
          {orderItems.map(item => (
            <View key={item.oid2} style={styles.orderItem}>
              <Image 
                source={{ uri: item.vimg }} 
                style={styles.productImage}
                defaultSource={require('./assets/logo.png')}
              />
              <View style={styles.productDetails}>
                <Text style={styles.productTitle}>{item.producttitle}</Text>
                <Text style={styles.productVariant}>{item.variant}</Text>
                <Text style={styles.productQuantity}>{t('checkout.qty')}: {item.quantity}</Text>
                <Text style={styles.productPrice}>
                  {convertPrice(parseFloat(item.price) * item.quantity)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Shipping Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('submitWaybill.shippingOptions')}</Text>
          
          {waybillOptions?.shipping_options.length === 0 ? (
            <View style={styles.noOptionsContainer}>
              <Text style={styles.noOptionsText}>{t('submitWaybill.noOptions')}</Text>
            </View>
          ) : (
            <View style={styles.optionsContainer}>
              {waybillOptions?.shipping_options.map(option => (
                <TouchableOpacity
                  key={option.carrier_id}
                  style={[
                    styles.optionCard,
                    selectedCarrier === option.carrier_id && styles.optionCardSelected
                  ]}
                  onPress={() => setSelectedCarrier(option.carrier_id)}
                >
                  <View style={styles.optionHeader}>
                    <View style={styles.optionInfo}>
                      {option.carrier_logo && (
                        <Image 
                          source={{ uri: option.carrier_logo }} 
                          style={styles.carrierLogo}
                        />
                      )}
                      <Text style={styles.carrierName}>{option.carrier_name}</Text>
                    </View>
                    <View style={[
                      styles.radioButton,
                      selectedCarrier === option.carrier_id && styles.radioButtonSelected
                    ]}>
                      {selectedCarrier === option.carrier_id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.optionDetails}>
                    <View style={styles.optionRow}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.optionText}>{option.delivery_time}</Text>
                    </View>
                    <Text style={styles.optionPrice}>{convertPrice(option.cost)}</Text>
                  </View>
                  
                  {option.description && (
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* COD Options for African Countries */}
        {africanCountryCodes.includes(userCountry) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('submitWaybill.codTitle')}</Text>
            <Text style={styles.codDescription}>
              {t('submitWaybill.codQuestion')}
            </Text>
            
            <View style={styles.codOptions}>
              <TouchableOpacity
                style={[styles.codOption, codEnabled && styles.codOptionSelected]}
                onPress={() => setCodEnabled(true)}
              >
                <View style={[
                  styles.radioButton,
                  codEnabled && styles.radioButtonSelected
                ]}>
                  {codEnabled && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.codOptionText}>{t('common.yes')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.codOption, !codEnabled && styles.codOptionSelected]}
                onPress={() => setCodEnabled(false)}
              >
                <View style={[
                  styles.radioButton,
                  !codEnabled && styles.radioButtonSelected
                ]}>
                  {!codEnabled && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.codOptionText}>{t('common.no')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Selected Option Summary */}
        {selectedCarrier && waybillOptions && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>{t('submitWaybill.selectedOption')}</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                <Text style={styles.summaryLabel}>{t('submitWaybill.carrier')}</Text> {
                  waybillOptions.shipping_options.find(opt => opt.carrier_id === selectedCarrier)?.carrier_name
                }
              </Text>
              <Text style={styles.summaryText}>
                <Text style={styles.summaryLabel}>{t('submitWaybill.cost')}</Text> {convertPrice(
                  waybillOptions.shipping_options.find(opt => opt.carrier_id === selectedCarrier)?.cost || 0
                )}
              </Text>
              {africanCountryCodes.includes(userCountry) && (
                <Text style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>{t('submitWaybill.cod')}</Text> {codEnabled ? t('common.yes') : t('common.no')}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitButtonContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCarrier || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitWaybill}
          disabled={!selectedCarrier || submitting}
        >
          {submitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.submitButtonText}>{t('submitWaybill.submitting')}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{t('submitWaybill.title')}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  orderDate: {
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
  addressText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  areaText: {
    fontSize: 14,
    color: '#6b7280',
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
  productQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  noOptionsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noOptionsText: {
    fontSize: 16,
    color: '#6b7280',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'white',
  },
  optionCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  carrierLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  carrierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3b82f6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  optionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  optionPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  optionDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  codDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  codOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  codOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
  },
  codOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  codOptionText: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
  },
  summarySection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryCard: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  summaryText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
  },
  summaryLabel: {
    fontWeight: '600',
  },
  submitButtonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
