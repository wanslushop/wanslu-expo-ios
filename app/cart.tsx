import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    SafeAreaView,
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
  user_id: number;
  pid: string;
  src: string;
  country: string;
  image: string;
  title: string;
  variant: string;
  vinfo: string;
  min_quantity: number;
  quantity: number;
  dom_shipping: string;
  tax: number;
  weight: number;
  volume: number;
  price: string;
  updated_at: string;
  created_at: string;
  note: string | null;
  seller: string;
  time: string;
}

export default function CartScreen() {
  const router = useRouter();
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [updatingQuantities, setUpdatingQuantities] = useState<Set<number>>(new Set());
  const [removingItems, setRemovingItems] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Notes functionality state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [selectedItemForNotes, setSelectedItemForNotes] = useState<CartItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState<Set<number>>(new Set());
  const [minOrderValue, setMinOrderValue] = useState<number>(200); // Default fallback

  useEffect(() => {
    fetchCartItems();
    fetchMinimums();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const authToken = await AsyncStorage.getItem('authToken');
      
      if (!authToken) {
        Alert.alert(t('cart.loginRequired'), t('cart.pleaseLoginToViewCart'));
        router.push('/login');
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/account/cart?offset=0&limit=1000', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const items: CartItem[] = data.data || [];
        setCartItems(items);
        // No items selected by default - user must manually select items
      } else {
        Alert.alert(t('common.error'), t('cart.failedToFetchCartItems'));
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      Alert.alert(t('common.error'), t('cart.networkErrorOccurred'));
    } finally {
      setLoading(false);
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

  const updateQuantity = async (itemId: number, newQuantity: number) => {
    // Find the item to check MOQ
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;
    
    // Don't allow quantity below MOQ
    if (newQuantity < item.min_quantity) {
      Alert.alert(t('cart.minimumOrderQuantity'), t('cart.minimumOrderQuantityForItem', { quantity: item.min_quantity }));
      return;
    }
  
    try {
      setUpdatingQuantities(prev => new Set(prev).add(itemId));
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert(t('cart.loginRequired'), t('cart.pleaseLoginToUpdateCart'));
        return;
      }
  
      const response = await fetch('https://api.wanslu.shop/api/actions/cart', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: itemId, quantity: newQuantity }),
      });
  
      if (response.ok) {
        setCartItems(prev =>
          prev.map(item =>
            item.id === itemId
              ? { ...item, quantity: newQuantity }
              : item
          )
        );
      } else {
        Alert.alert(t('common.error'), t('cart.failedToUpdateQuantity'));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert(t('common.error'), t('cart.failedToUpdateQuantity'));
    } finally {
      setUpdatingQuantities(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const updateNote = async (itemId: number, note: string) => {
    try {
      setUpdatingNotes(prev => new Set(prev).add(itemId));
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert(t('cart.loginRequired'), t('cart.pleaseLoginToUpdateNotes'));
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/actions/cart', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: itemId, note: note }),
      });

      if (response.ok) {
        setCartItems(prev =>
          prev.map(item =>
            item.id === itemId
              ? { ...item, note: note }
              : item
          )
        );
      } else {
        Alert.alert(t('common.error'), t('cart.failedToUpdateNote'));
      }
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert(t('common.error'), t('cart.failedToUpdateNote'));
    } finally {
      setUpdatingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const openNotesModal = (item: CartItem) => {
    setSelectedItemForNotes(item);
    setNoteText(item.note || '');
    setNotesModalVisible(true);
  };

  const closeNotesModal = () => {
    setNotesModalVisible(false);
    setSelectedItemForNotes(null);
    setNoteText('');
  };

  const saveNote = () => {
    if (selectedItemForNotes) {
      updateNote(selectedItemForNotes.id, noteText);
      closeNotesModal();
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      setRemovingItems(prev => new Set(prev).add(itemId));
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert(t('cart.loginRequired'), t('cart.pleaseLoginToRemoveItems'));
        return;
      }
  
      const response = await fetch('https://api.wanslu.shop/api/actions/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ id: itemId }),
      });
  
      if (response.ok) {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        Alert.alert(t('common.success'), t('cart.itemRemovedFromCart'));
      } else {
        Alert.alert(t('common.error'), t('cart.failedToRemoveItem'));
      }
    } catch (error) {
      console.error('Error removing item:', error);
      Alert.alert(t('common.error'), t('cart.failedToRemoveItem'));
    } finally {
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };



  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert(t('cart.emptyCart'), t('cart.pleaseAddItemsToCart'));
      return;
    }

    const ids = cartItems.filter(i => selectedIds.has(i.id)).map(i => i.id);
    if (ids.length === 0) {
      Alert.alert(t('cart.noSelection'), t('cart.pleaseSelectAtLeastOneItem'));
      return;
    }

    // Check minimum order amount (fetched from API)
    const subtotalCNY = calculateSubtotal();
    
    if (subtotalCNY < minOrderValue) {
      const amountNeeded = minOrderValue - subtotalCNY;
      const convertedAmountNeeded = convertPrice(amountNeeded);
      Alert.alert(
        t('cart.minimumOrderRequired'),
        t('cart.addItemsWorthMore', { amount: convertedAmountNeeded }),
        [{ text: t('common.ok') }]
      );
      return;
    }

    router.push({ pathname: '/checkout', params: { cid: ids.join(',') } });
  };

  const isAllSelected = cartItems.length > 0 && selectedIds.size === cartItems.length;

  const toggleSelectItem = (itemId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(cartItems.map(i => i.id)));
  };

  const unselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      unselectAll();
    } else {
      selectAll();
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      if (!selectedIds.has(item.id)) return sum;
      return sum + (parseFloat(item.price) * item.quantity);
    }, 0);
  };

  const calculateTotalItems = () => {
    return cartItems.reduce((sum, item) => selectedIds.has(item.id) ? sum + item.quantity : sum, 0);
  };

  const calculateShipping = () => {
    // One shipping charge per unique seller, using the maximum fee among that seller's selected items
    const sellerToMaxFee = new Map<string, number>();
    for (const item of cartItems) {
      if (!selectedIds.has(item.id)) continue;
      const perItemShipping = parseFloat(item.dom_shipping || '0');
      const itemFee = isNaN(perItemShipping) ? 0 : perItemShipping; // apply once, not per quantity
      const currentMax = sellerToMaxFee.get(item.seller) ?? 0;
      if (itemFee > currentMax) {
        sellerToMaxFee.set(item.seller, itemFee);
      }
    }
    let total = 0;
    for (const fee of sellerToMaxFee.values()) total += fee;
    return total;
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.topRow}>
        <TouchableOpacity 
          onPress={() => router.push(`/product/${item.pid}?src=${item.src}`)}
          style={styles.productTouchable}
        >
          <Image source={{ uri: item.image }} style={styles.itemImage} />
        </TouchableOpacity>
        <View style={styles.itemDetails}>
          <TouchableOpacity 
            onPress={() => router.push(`/product/${item.pid}?src=${item.src}`)}
            style={styles.titleTouchable}
          >
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </TouchableOpacity>
          {item.variant && (
            <Text style={styles.itemVariant}>{item.variant}</Text>
          )}
          <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>{convertPrice(item.price)}</Text>
          <TouchableOpacity
                style={styles.notesButton}
                onPress={() => openNotesModal(item)}
                disabled={updatingNotes.has(item.id)}
              >
                <Ionicons name="create-outline" size={16} color="#E53E3E" />
                <Text style={styles.notesButtonText}>{t('cart.notes')}</Text>
              </TouchableOpacity>
          </View>
          <View style={styles.quantityContainer}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={updatingQuantities.has(item.id) || item.quantity <= item.min_quantity}
              >
                <Ionicons name="remove" size={20} color={item.quantity <= item.min_quantity ? "#ccc" : "#333"} />
              </TouchableOpacity>
              {updatingQuantities.has(item.id) ? (
                <ActivityIndicator size="small" color="#E53E3E" />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={updatingQuantities.has(item.id)}
              >
                <Ionicons name="add" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.quantityInfo}>
              <Text style={styles.moqText}>{t('cart.moq')}: {item.min_quantity}</Text>
            </View>
          </View>
          <Text style={styles.itemTotal}>
            {t('cart.total')}: {convertPrice(parseFloat(item.price) * item.quantity)}
          </Text>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <TouchableOpacity
          onPress={() => toggleSelectItem(item.id)}
          style={styles.checkbox}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedIds.has(item.id) }}
          accessibilityLabel={`Select item ${item.id}`}
        >
          <Ionicons
            name={selectedIds.has(item.id) ? 'checkbox-outline' : 'square-outline'}
            size={22}
            color="#E53E3E"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeItem(item.id)}
          disabled={removingItems.has(item.id)}
        >
          {removingItems.has(item.id) ? (
            <ActivityIndicator size="small" color="#E53E3E" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#E53E3E" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('cart.title')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('cart.loadingCart')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cart.title')}</Text>
        <TouchableOpacity onPress={toggleSelectAll} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>{isAllSelected ? t('cart.uncheckAll') : t('cart.checkAll')}</Text>
        </TouchableOpacity>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptySubtitle}>{t('cart.addSomeProducts')}</Text>
          <TouchableOpacity 
            style={styles.shopNowButton}
            onPress={() => router.back()}
          >
            <Text style={styles.shopNowButtonText}>{t('cart.shopNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />
          
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.items')} ({calculateTotalItems()})</Text>
              <Text style={styles.summaryValue}>{convertPrice(calculateSubtotal().toFixed(2))}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.shipping')}</Text>
              <Text style={styles.summaryValue}>{convertPrice(calculateShipping().toFixed(2))}</Text>
            </View>
            
            {(() => {
              const subtotalCNY = calculateSubtotal();
              const amountNeeded = minOrderValue - subtotalCNY;
              const isBelowMinimum = subtotalCNY < minOrderValue;
              
              return isBelowMinimum ? (
                <View style={styles.minimumOrderWarning}>
                  <Text style={styles.minimumOrderText}>
                    {t('cart.addItemsWorthMore', { amount: convertPrice(amountNeeded) })}
                  </Text>
                </View>
              ) : null;
            })()}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('cart.total')}</Text>
              <Text style={styles.totalValue}>{convertPrice((calculateSubtotal() + calculateShipping()).toFixed(2))}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.checkoutButton}
              onPress={proceedToCheckout}
            >
              <Text style={styles.checkoutButtonText}>{t('cart.checkout')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      
      {/* Notes Modal */}
      <Modal
        visible={notesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeNotesModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('cart.addNote')}</Text>
              <TouchableOpacity onPress={closeNotesModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedItemForNotes && (
              <View style={styles.modalBody}>
                <Text style={styles.modalItemTitle} numberOfLines={2}>
                  {selectedItemForNotes.title}
                </Text>
                <TextInput
                  style={styles.noteTextInput}
                  placeholder={t('cart.addNoteForItem')}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeNotesModal}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveNote}
                disabled={updatingNotes.has(selectedItemForNotes?.id || 0)}
              >
                {updatingNotes.has(selectedItemForNotes?.id || 0) ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>{t('cart.save')}</Text>
                )}
              </TouchableOpacity>
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
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#E53E3E',
    fontSize: 16,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopNowButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  shopNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cartList: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bottomRow: {
    marginTop: -28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  productTouchable: {
    // No additional styling needed
  },
  titleTouchable: {
    // No additional styling needed
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 22,
  },
  itemVariant: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginBottom: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  removeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  checkoutButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // New styles for quantity controls and notes
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  moqText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#E53E3E',
  },
  notesButtonText: {
    fontSize: 8,
    color: '#E53E3E',
    marginLeft: 4,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalItemTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  noteTextInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
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
