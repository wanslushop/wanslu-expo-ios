import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { OrderChat } from './components/OrderChat';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface SubOrder {
  id: number;
  oid: string;
  oid2: string;
  producttitle: string;
  vimg: string;
  variant: string;
  quantity: number;
  price: string;
  status: string;
  src: string;
}

interface Order {
  oid: string;
  sub_orders: SubOrder[];
}

interface RefundModalProps {
  subOrder: SubOrder;
  visible: boolean;
  onClose: () => void;
}

const RefundModal: React.FC<RefundModalProps> = ({ subOrder, visible, onClose }) => {
  const { t } = useI18n();
  const [refundReason, setRefundReason] = useState('');
  const [refundMessage, setRefundMessage] = useState('');
  const [refundImage, setRefundImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refundReasons = [
    { value: 'damaged', label: t('helpOrder.damagedProduct') },
    { value: 'wrong-item', label: t('helpOrder.wrongItemDelivered') },
    { value: 'quality-issue', label: t('helpOrder.qualityIssue') },
    { value: 'other', label: t('helpOrder.other') },
  ];

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setRefundImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('helpOrder.failedToPickImage'));
    }
  };

  const handleSubmit = async () => {
    if (!refundReason) {
      Alert.alert(t('common.error'), t('helpOrder.pleaseSelectReasonForRefund'));
      return;
    }

    if (!refundImage) {
      Alert.alert(t('common.error'), t('helpOrder.pleaseSelectImageForRefundRequest'));
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert(t('common.error'), t('helpOrder.youAreNotAuthenticated'));
        return;
      }

      const formData = new FormData();
      formData.append('oid2', subOrder.oid2);
      formData.append('refundReason', refundReason);
      formData.append('refundMessage', refundMessage);
      
      // Add image file
      const imageUri = refundImage;
      const imageName = imageUri.split('/').pop() || 'refund_image.jpg';
      const imageType = 'image/jpeg';
      
      formData.append('refundImage', {
        uri: imageUri,
        name: imageName,
        type: imageType,
      } as any);

      const response = await fetch('https://api.wanslu.shop/api/order/refund/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t('helpOrder.failedToSubmitRefundRequest'));
      }

      Alert.alert(t('common.success'), t('helpOrder.refundRequestSubmittedSuccessfully'), [
        { text: t('common.ok'), onPress: () => {
          onClose();
          router.push('/orders');
        }}
      ]);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('helpOrder.unexpectedErrorOccurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('helpOrder.requestRefund')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.productTitle}>{subOrder.producttitle}</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('helpOrder.reasonForRefund')}</Text>
              <ScrollView style={styles.reasonContainer}>
                {refundReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reasonOption,
                      refundReason === reason.value && styles.reasonOptionSelected
                    ]}
                    onPress={() => setRefundReason(reason.value)}
                  >
                    <View style={[
                      styles.radioButton,
                      refundReason === reason.value && styles.radioButtonSelected
                    ]}>
                      {refundReason === reason.value && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      refundReason === reason.value && styles.reasonTextSelected
                    ]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('helpOrder.message')}</Text>
              <TextInput
                style={styles.textArea}
                value={refundMessage}
                onChangeText={setRefundMessage}
                placeholder={t('helpOrder.pleaseDescribeIssueInDetail')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('helpOrder.refundImage')} *</Text>
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <Ionicons name="camera" size={24} color="#ef4444" />
                <Text style={styles.imagePickerText}>
                  {refundImage ? t('helpOrder.changeImage') : t('helpOrder.selectImage')}
                </Text>
              </TouchableOpacity>
              {refundImage && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: refundImage }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton} 
                    onPress={() => setRefundImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.submitButtonContent}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.submitButtonText}>{t('helpOrder.submitting')}</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>{t('helpOrder.submitRequest')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface SubOrderCardProps {
  subOrder: SubOrder;
  onChatPress: () => void;
  onRefundPress: () => void;
}

const SubOrderCard: React.FC<SubOrderCardProps> = ({ subOrder, onChatPress, onRefundPress }) => {
  const { convertPrice } = useCurrency();
  const { t } = useI18n();

  const canRequestRefund = subOrder.status === 'Delivered';
  const isRefundSubmitted = subOrder.status === 'Refund requested' || subOrder.status === 'Refunded';

  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.productInfo}>
          <Image
            source={{ uri: subOrder.vimg }}
            style={styles.productImage}
            defaultSource={require('./assets/logo.png')}
          />
          <View style={styles.productDetails}>
            <Text style={styles.productTitle}>{subOrder.producttitle}</Text>
            <Text style={styles.productId}>{t('helpOrder.id')}: {subOrder.oid2}</Text>
            <Text style={styles.productQuantity}>{t('helpOrder.quantity')}: {subOrder.quantity}</Text>
            <Text style={styles.productPrice}>{convertPrice(parseFloat(subOrder.price))}</Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={onChatPress}>
            <Text style={styles.messageButtonText}>{t('helpOrder.message')}</Text>
          </TouchableOpacity>

          {canRequestRefund && (
            <TouchableOpacity style={styles.refundButton} onPress={onRefundPress}>
              <Text style={styles.refundButtonText}>{t('helpOrder.requestRefund')}</Text>
            </TouchableOpacity>
          )}

          {isRefundSubmitted && (
            <View style={styles.refundSubmittedButton}>
              <Text style={styles.refundSubmittedText}>{t('helpOrder.refundSubmitted')}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default function HelpOrderScreen() {
  const params = useLocalSearchParams<{ oid: string | string[] }>();
  const oid = Array.isArray(params.oid) ? params.oid[0] : params.oid;
  const { convertPrice } = useCurrency();
  const { t } = useI18n();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedSubOrder, setSelectedSubOrder] = useState<SubOrder | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedSubOrderForChat, setSelectedSubOrderForChat] = useState<SubOrder | null>(null);

  const fetchOrder = useCallback(async () => {
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

      const response = await fetch(`https://api.wanslu.shop/api/order/${oid}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      if (data.status === 'success' && data.data && data.data[oid]) {
        const orderDetails = data.data[oid];
        const subOrders = orderDetails.items ? Object.values(orderDetails.items) : [];
        const orderData: Order = {
          oid: oid,
          sub_orders: subOrders as SubOrder[]
        };
        setOrder(orderData);
      } else {
        throw new Error(data.message || 'Could not fetch order data or data is malformed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [oid]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleRefundPress = (subOrder: SubOrder) => {
    setSelectedSubOrder(subOrder);
    setRefundModalVisible(true);
  };

  const handleChatPress = (subOrder: SubOrder) => {
    setSelectedSubOrderForChat(subOrder);
    setChatModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('helpOrder.getHelp')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('helpOrder.loadingOrderDetails')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('helpOrder.getHelp')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{t('common.error')}: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOrder}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('helpOrder.getHelp')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('helpOrder.orderNotFound')}.</Text>
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
        <Text style={styles.title}>{t('helpOrder.getHelp')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>{t('helpOrder.order')} #{order.oid}</Text>
        </View>

        <View style={styles.ordersContainer}>
          {order.sub_orders && order.sub_orders.length > 0 ? (
            order.sub_orders.map((subOrder) => (
              <SubOrderCard
                key={subOrder.id}
                subOrder={subOrder}
                onChatPress={() => handleChatPress(subOrder)}
                onRefundPress={() => handleRefundPress(subOrder)}
              />
            ))
          ) : (
            <View style={styles.noItemsContainer}>
              <Text style={styles.noItemsText}>{t('helpOrder.thisOrderHasNoItems')}.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Refund Modal */}
      {selectedSubOrder && (
        <RefundModal
          subOrder={selectedSubOrder}
          visible={refundModalVisible}
          onClose={() => {
            setRefundModalVisible(false);
            setSelectedSubOrder(null);
          }}
        />
      )}

      {/* Chat Modal */}
      {selectedSubOrderForChat && (
        <OrderChat
          visible={chatModalVisible}
          onClose={() => {
            setChatModalVisible(false);
            setSelectedSubOrderForChat(null);
          }}
          subOrderId={selectedSubOrderForChat.id}
          oid2={selectedSubOrderForChat.oid2}
          productTitle={selectedSubOrderForChat.producttitle}
        />
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
  },
  ordersContainer: {
    gap: 16,
  },
  noItemsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: 16,
    color: '#6b7280',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
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
  productId: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  messageButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    minWidth: 100,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  refundButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    minWidth: 100,
  },
  refundButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  refundSubmittedButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    minWidth: 100,
  },
  refundSubmittedText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    height: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    // maxHeight: 400,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 30,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  reasonContainer: {
    maxHeight: 300,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reasonOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  reasonText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#1e40af',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    minHeight: 80,
    backgroundColor: 'white',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fef2f2',
  },
  imagePickerText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imagePreview: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'center',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
});
