import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface CartItem {
  id: number;
  pid: string;
  src: string;
  title: string;
  variant?: string;
  vinfo?: string;
  img?: string | { images: string[] };
  image?: string;
  price: string;
  quantity: number;
  min_quantity?: number;
  dom_shipping?: string;
  note?: string;
  item_total: number;
  item_shipping: number;
}

interface Address {
  id: number;
  fname: string;
  lname: string;
  number: string;
  add1: string;
  add2: string;
  city: string;
  district: string;
  country: string;
  zip: string;
}

interface ShippingMethod {
  id: number;
  deliverycycle: string;
  description: string;
  dmid: number;
  delivery_method: string;
}

interface CheckoutSummary {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  items_count: number;
}

interface CouponInfo {
  success: boolean;
  message: string;
  discount: number;
  coupon_type: string;
  coupon: string;
  minvalue: number;
  maxdiscount: number;
}

interface AdditionalService {
  id: number;
  name: string;
  type: string;
  price: number;
  status: number;
  description: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  const cidParam = Array.isArray(params.cid) ? params.cid.join(',') : (params.cid || '');
  const selectedCartIds = useMemo(() => (cidParam ? cidParam.split(',').map((n) => Number(n)) : []), [cidParam]);

  const [loading, setLoading] = useState(true);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [couponCode, setCouponCode] = useState('');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedAddressForShipping, setSelectedAddressForShipping] = useState<Address | null>(null);

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<number | null>(null);
  const [loadingShippingMethods, setLoadingShippingMethods] = useState(false);

  const [geoData, setGeoData] = useState<any>(null);
  const [isLocalCheckout, setIsLocalCheckout] = useState(false);
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([]);
  const [selectedServices, setSelectedServices] = useState<{ [itemId: number]: number[] }>({});
  const [selectedItemForServices, setSelectedItemForServices] = useState<CartItem | null>(null);
  const [minOrderValue, setMinOrderValue] = useState<number>(200); // Default fallback

  useEffect(() => {
    // Parse stored geo-data if present (optional)
    (async () => {
      try {
        const savedGeo = await AsyncStorage.getItem('geo-data');
        if (savedGeo) setGeoData(JSON.parse(savedGeo));
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchCheckoutData = async (maybeCoupon?: string) => {
    if (!selectedCartIds.length) {
      Alert.alert(t('checkout.noItemsSelected'), t('checkout.pleaseSelectItemsToCheckout'));
      router.back();
      return;
    }

    setLoading(true);
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('https://api.wanslu.shop/api/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cid: selectedCartIds,
          coupon: maybeCoupon,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCartItems(data.data.cart_items || []);
        setSummary(data.data.summary || null);
        setCoupon(data.data.coupon || null);
        const allLocal = (data.data.cart_items || []).every((item: CartItem) => item.src === 'local');
        setIsLocalCheckout(allLocal);
      } else {
        Alert.alert(t('common.error'), t('checkout.failedToLoadCheckoutData'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('checkout.networkErrorWhileLoadingCheckout'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return;
    try {
      const response = await fetch('https://api.wanslu.shop/api/account/address', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        let list: Address[] = data.data || [];
        if (isLocalCheckout && geoData?.countryName) {
          list = list.filter((a) => a.country?.toLowerCase() === geoData.countryName.toLowerCase());
        }
        setAddresses(list);
        if (list.length > 0) setSelectedAddress(list[0].id);
      }
    } catch {
      // ignore
    }
  };

  const fetchShippingMethods = async (addressId: number) => {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return;
    try {
      setLoadingShippingMethods(true);
      const response = await fetch(`https://api.wanslu.shop/api/etc/shippingmethod?address_id=${addressId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const methods: ShippingMethod[] = data.data?.shipping_methods || [];
        setShippingMethods(methods);
        setSelectedShippingMethod(methods[0]?.id ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingShippingMethods(false);
    }
  };

  const fetchAdditionalServices = async () => {
    try {
      const response = await fetch("https://api.wanslu.shop/api/etc/addservices?type=order");
      if (response.ok) {
        const data = await response.json();
        setAdditionalServices(data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchMinimums = async () => {
    try {
      const response = await fetch("https://api.wanslu.shop/api/etc/minimums");
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data && data.data.length > 0) {
          setMinOrderValue(data.data[0].minordervalue || 200);
        }
      }
    } catch {
      // ignore, use default
    }
  };

  useEffect(() => {
    fetchCheckoutData();
    fetchAdditionalServices();
    fetchMinimums();
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [isLocalCheckout]);

  // Shipping methods fetched when opening modal after address pick

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert(t('checkout.coupon'), t('checkout.pleaseEnterCouponCode'));
      return;
    }
    setApplyingCoupon(true);
    await fetchCheckoutData(couponCode);
    setApplyingCoupon(false);
  };

  const handleRemoveCoupon = async () => {
    setApplyingCoupon(true);
    setCouponCode('');
    await fetchCheckoutData('');
    setApplyingCoupon(false);
  };

  const handleAddressSelect = async (address: Address) => {
    if (isLocalCheckout) {
      setSelectedAddress(address.id);
      setShowAddressModal(false);
      return;
    }
    setSelectedAddressForShipping(address);
    setShowAddressModal(false);
    setShowShippingModal(true);
    await fetchShippingMethods(address.id);
  };

  const handleConfirmShippingMethod = () => {
    if (!selectedAddressForShipping || !selectedShippingMethod) return;
    setSelectedAddress(selectedAddressForShipping.id);
    setShowShippingModal(false);
  };

  const handleServiceToggle = (itemId: number, serviceId: number) => {
    setSelectedServices((prev) => {
      const current = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: current.includes(serviceId)
          ? current.filter((id) => id !== serviceId)
          : [...current, serviceId],
      };
    });
  };

  const calculateServicesTotal = () => {
    let total = 0;
    Object.entries(selectedServices).forEach(([itemId, serviceIds]) => {
      serviceIds.forEach((serviceId) => {
        const service = additionalServices.find((s) => s.id === serviceId);
        if (service) total += service.price;
      });
    });
    return total;
  };

  const calculateSellerShippingTotal = () => {
    // Group items by seller
    const sellerMap: { [seller: string]: CartItem[] } = {};
    cartItems.forEach((item) => {
      const seller = (item as any).seller || 'unknown';
      if (!sellerMap[seller]) sellerMap[seller] = [];
      sellerMap[seller].push(item);
    });
    let total = 0;
    Object.values(sellerMap).forEach((items) => {
      // For each seller, find the max dom_shipping (if present), else max item_shipping
      let maxShipping = 0;
      items.forEach((item) => {
        const ship = item.dom_shipping ? Number(item.dom_shipping) : Number(item.item_shipping);
        if (!isNaN(ship) && ship > maxShipping) maxShipping = ship;
      });
      total += maxShipping;
    });
    return total;
  };

  const handleSubmitOrder = async () => {
    if (!selectedAddress) {
      Alert.alert(t('checkout.address'), t('checkout.pleaseSelectAddress'));
      return;
    }
    if (!isLocalCheckout && !selectedShippingMethod) {
      Alert.alert(t('checkout.shipping'), t('checkout.pleaseSelectShippingMethod'));
      return;
    }

    // Check minimum order amount (fetched from API)
    const subtotalCNY = Number(summary?.subtotal || 0);
    
    if (subtotalCNY < minOrderValue) {
      const amountNeeded = minOrderValue - subtotalCNY;
      const convertedAmountNeeded = convertPrice(amountNeeded);
      Alert.alert(
        t('checkout.minimumOrderRequired'),
        t('checkout.addItemsWorthMore', { amount: convertedAmountNeeded }),
        [{ text: t('common.ok') }]
      );
      return;
    }

    setSubmitting(true);
    const authToken = await AsyncStorage.getItem('authToken');
    const geo = geoData || {};
    const payload: any = {
      cids: selectedCartIds,
      address: selectedAddress,
      currency: geo.currencyCode || 'USD',
      country: geo.countryName || 'United States',
      country_code: geo.countryCode || 'US',
    };
    if (isLocalCheckout) {
      payload.local = 1;
    } else {
      payload.coupon = couponCode;
      payload.dmid = selectedShippingMethod;
      payload.additional_services = selectedServices;
    }
    try {
      const response = await fetch('https://api.wanslu.shop/api/submit-order', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'success') {
        // Extract order_id from the response
        const orderId = data?.data?.order_id;
        if (orderId) {
          // Navigate to success screen with the order ID
          router.replace({ pathname: '/order-success', params: { oid: orderId } });
        } else {
          // Fallback if order_id not in response
          router.push({ pathname: '/', params: { orders: '1' } });
        }
      } else {
        Alert.alert(t('common.error'), data?.message || t('checkout.failedToPlaceOrder'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('checkout.networkErrorWhilePlacingOrder'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    const imageUrl = typeof item.img === 'string' ? item.img : (item.img as any)?.images?.[0] || item.image || '';
    return (
      <View style={styles.itemRow}>
        <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.itemVariant}>{item.variant}</Text>
          <Text style={styles.itemMeta}>{t('checkout.qty')}: {item.quantity}</Text>
          <View style={styles.itemPriceRow}>
            <Text style={styles.itemPrice}>{convertPrice(Number(item.item_total || 0).toFixed(2))}</Text>
            {!isLocalCheckout && (
              <TouchableOpacity
                style={[styles.button, styles.buttonOutline, { marginLeft: 8, paddingVertical: 6, paddingHorizontal: 10 }]}
                onPress={() => setSelectedItemForServices(item)}
              >
                <Text style={[styles.buttonText, styles.buttonOutlineText]}>{t('checkout.additionalServices')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!isLocalCheckout && selectedServices[item.id]?.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontWeight: '600', color: '#333', fontSize: 13 }}>{t('checkout.additionalServices')}:</Text>
              {selectedServices[item.id].map((serviceId) => {
                const service = additionalServices.find((s) => s.id === serviceId);
                return service ? (
                  <View key={serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#666', fontSize: 12 }}>{service.name}</Text>
                    <Text style={{ color: '#E53E3E', fontSize: 12 }}>{convertPrice(service.price)}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('checkout.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('checkout.loadingCheckout')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={styles.sectionTitle}>{t('checkout.orderSummary')}</Text>
          <View style={styles.listContent}>
            {cartItems.map((i) => (
              <View key={i.id.toString()}>{renderItem({ item: i })}</View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('checkout.shippingAddress')}</Text>
            {selectedAddress ? (
              (() => {
                const a = addresses.find(x => x.id === selectedAddress);
                return a ? (
                  <View style={[styles.addressCard, styles.addressCardSelected]}>
                    <Text style={styles.addressName}>{a.fname} {a.lname}</Text>
                    <Text style={styles.addressLine}>{a.add1}</Text>
                    {!!a.add2 && <Text style={styles.addressLine}>{a.add2}</Text>}
                    <Text style={styles.addressLine}>{a.city}, {a.district} - {a.zip}</Text>
                    <Text style={styles.addressLine}>{a.country}</Text>
                  </View>
                ) : null;
              })()
            ) : (
              <Text style={styles.note}>{t('checkout.noAddressSelected')}</Text>
            )}
            <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setShowAddressModal(true)}>
              <Text style={styles.buttonText}>{selectedAddress ? t('checkout.changeAddress') : t('checkout.selectAddress')}</Text>
            </TouchableOpacity>
          </View>

          {!isLocalCheckout && selectedAddress && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('checkout.shippingMethod')}</Text>
              {selectedShippingMethod ? (
                (() => {
                  const m = shippingMethods.find(x => x.id === selectedShippingMethod);
                  return m ? (
                    <View style={[styles.shippingCard, styles.shippingCardSelected]}>
                      <View style={styles.shippingTopRow}>
                        <Text style={styles.shippingMethod}>{m.delivery_method}</Text>
                        <Text style={styles.shippingCycle}>{m.deliverycycle}</Text>
                      </View>
                      <Text style={styles.shippingDesc}>{m.description}</Text>
                    </View>
                  ) : null;
                })()
              ) : (
                <Text style={styles.note}>{t('checkout.noShippingMethodSelected')}</Text>
              )}
              <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={async () => {
                if (!selectedAddress) return;
                setSelectedAddressForShipping(addresses.find(a => a.id === selectedAddress) || null);
                setShowShippingModal(true);
                await fetchShippingMethods(selectedAddress);
              }}>
                <Text style={styles.buttonText}>{selectedShippingMethod ? t('checkout.changeShippingMethod') : t('checkout.selectShippingMethod')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLocalCheckout && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('checkout.coupon')}</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholderTextColor="#999" placeholder={t('checkout.enterCouponCode')}
                  value={couponCode}
                  onChangeText={setCouponCode}
                />
                <TouchableOpacity
                  style={[styles.button, styles.buttonOutline]}
                  onPress={handleApplyCoupon}
                  disabled={applyingCoupon || !couponCode.trim()}
                >
                  <Text style={[styles.buttonText, styles.buttonOutlineText]}>{applyingCoupon ? t('checkout.applying') : t('checkout.apply')}</Text>
                </TouchableOpacity>
              </View>
              {!!coupon && (
                <View style={styles.couponMessageRow}>
                  <Text style={[styles.couponMessage, coupon.success ? styles.couponSuccess : styles.couponError]}>
                    {coupon.message}
                  </Text>
                  {coupon.success && (
                    <TouchableOpacity onPress={handleRemoveCoupon}>
                      <Ionicons name="close" size={18} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('checkout.summary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('checkout.subtotal')}</Text>
              <Text style={styles.summaryValue}>{convertPrice(Number(summary?.subtotal || 0).toFixed(2))}</Text>
            </View>
            {(() => {
              const subtotalCNY = Number(summary?.subtotal || 0);
              const amountNeeded = minOrderValue - subtotalCNY;
              const isBelowMinimum = subtotalCNY < minOrderValue;
              
              return isBelowMinimum ? (
                <View style={styles.minimumOrderWarning}>
                  <Text style={styles.minimumOrderText}>
                    {t('checkout.addItemsWorthMore', { amount: convertPrice(amountNeeded) })}
                  </Text>
                </View>
              ) : null;
            })()}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('checkout.shipping')}</Text>
              <Text style={styles.summaryValue}>{convertPrice(calculateSellerShippingTotal().toFixed(2))}</Text>
            </View>
            {!isLocalCheckout && Object.keys(selectedServices).length > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#E53E3E' }]}>{t('checkout.additionalServices')}</Text>
                <Text style={[styles.summaryValue, { color: '#E53E3E' }]}>{convertPrice(calculateServicesTotal().toFixed(2))}</Text>
              </View>
            )}
            {coupon?.success && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>{t('checkout.discount')}</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{convertPrice(Number(summary?.discount || 0).toFixed(2))}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}> 
              <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
              <Text style={styles.totalValue}>{convertPrice((Number(summary?.total || 0) + (!isLocalCheckout ? calculateServicesTotal() : 0)).toFixed(2))}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (!selectedAddress || (!isLocalCheckout && !selectedShippingMethod) || submitting) && styles.buttonDisabled]}
            disabled={!selectedAddress || (!isLocalCheckout && !selectedShippingMethod) || submitting}
            onPress={handleSubmitOrder}
          >
            <Text style={styles.buttonText}>{submitting ? t('checkout.placingOrder') : t('checkout.placeOrder')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {/* Address Selection Modal */}
      <Modal visible={showAddressModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('checkout.selectAddress')}</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {addresses.map((a) => (
                <TouchableOpacity key={a.id} style={styles.addressCard} onPress={() => handleAddressSelect(a)}>
                  <Text style={styles.addressName}>{a.fname} {a.lname}</Text>
                  <Text style={styles.addressLine}>{a.add1}</Text>
                  {!!a.add2 && <Text style={styles.addressLine}>{a.add2}</Text>}
                  <Text style={styles.addressLine}>{a.city}, {a.district} - {a.zip}</Text>
                  <Text style={styles.addressLine}>{a.country}</Text>
                </TouchableOpacity>
              ))}
              {addresses.length === 0 && (
                <Text style={styles.note}>{t('checkout.noAddressesFound')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Shipping Method Modal */}
      <Modal visible={showShippingModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('checkout.selectShippingMethod')}</Text>
              <TouchableOpacity onPress={() => setShowShippingModal(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            {selectedAddressForShipping && (
              <View style={styles.modalAddressSummary}>
                <Text style={styles.addressName}>{selectedAddressForShipping.fname} {selectedAddressForShipping.lname}</Text>
                <Text style={styles.addressLine}>{selectedAddressForShipping.add1}</Text>
                <Text style={styles.addressLine}>{selectedAddressForShipping.city}, {selectedAddressForShipping.district}</Text>
              </View>
            )}
            {loadingShippingMethods ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#E53E3E" />
                <Text style={styles.loadingText}>{t('checkout.loadingShippingMethods')}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {shippingMethods.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.shippingCard, selectedShippingMethod === m.id && styles.shippingCardSelected]}
                    onPress={() => setSelectedShippingMethod(m.id)}
                  >
                    <View style={styles.shippingTopRow}>
                      <Text style={styles.shippingMethod}>{m.delivery_method}</Text>
                      <Text style={styles.shippingCycle}>{m.deliverycycle}</Text>
                    </View>
                    <Text style={styles.shippingDesc}>{m.description}</Text>
                  </TouchableOpacity>
                ))}
                {shippingMethods.length === 0 && (
                  <Text style={styles.note}>{t('checkout.noShippingMethodsAvailable')}</Text>
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.button, (!selectedShippingMethod) && styles.buttonDisabled, { marginTop: 12 }]}
              disabled={!selectedShippingMethod}
              onPress={handleConfirmShippingMethod}
            >
              <Text style={styles.buttonText}>{t('checkout.continue')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedItemForServices} animationType="slide" transparent onRequestClose={() => setSelectedItemForServices(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('checkout.additionalServices')}{selectedItemForServices ? ` ${t('checkout.for')} ${selectedItemForServices.title}` : ''}</Text>
              <TouchableOpacity onPress={() => setSelectedItemForServices(null)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {additionalServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                  onPress={() => selectedItemForServices && handleServiceToggle(selectedItemForServices.id, service.id)}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#E53E3E',
                    backgroundColor: selectedItemForServices && selectedServices[selectedItemForServices.id]?.includes(service.id) ? '#E53E3E' : '#fff',
                    marginRight: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    {selectedItemForServices && selectedServices[selectedItemForServices.id]?.includes(service.id) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: '#333' }}>{service.name}</Text>
                    <Text style={{ color: '#666', fontSize: 12 }}>{service.description}</Text>
                  </View>
                  <Text style={{ color: '#E53E3E', fontWeight: '700', marginLeft: 8 }}>{convertPrice(service.price)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.button, { marginTop: 12 }]}
              onPress={() => setSelectedItemForServices(null)}
            >
              <Text style={styles.buttonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginTop: Platform.OS === 'ios' ? 0 : 40,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
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
  content: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemVariant: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  itemPriceRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    color: '#E53E3E',
    fontWeight: '700',
  },
  addressCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  addressCardSelected: {
    borderColor: '#E53E3E',
    backgroundColor: '#fff5f5',
  },
  addressName: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  addressLine: {
    color: '#666',
    fontSize: 12,
  },
  shippingCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  shippingCardSelected: {
    borderColor: '#E53E3E',
    backgroundColor: '#fff5f5',
  },
  shippingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shippingMethod: {
    fontWeight: '600',
    color: '#333',
  },
  shippingCycle: {
    color: '#666',
    fontSize: 12,
  },
  shippingDesc: {
    color: '#666',
    fontSize: 12,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  couponMessageRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponMessage: {
    fontSize: 12,
  },
  couponSuccess: {
    color: '#16a34a',
  },
  couponError: {
    color: '#dc2626',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#666',
  },
  summaryValue: {
    color: '#333',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E53E3E',
  },
  note: {
    fontSize: 12,
    color: '#666',
  },
  button: {
    backgroundColor: '#E53E3E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E53E3E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonOutlineText: {
    color: '#E53E3E',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalAddressSummary: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  minimumOrderWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  minimumOrderText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

