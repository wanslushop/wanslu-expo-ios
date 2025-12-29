import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PaymentTimer from './PaymentTimer';

interface OrderPayButtonProps {
  orderRow: {
    time: string;
    username: string;
    user_id: number;
  };
  oid: string;
  onPayPress: (oid: string) => void;
}

const OrderPayButton: React.FC<OrderPayButtonProps> = ({ orderRow, oid, onPayPress }) => {
  const getIsExpired = () => {
    const orderDate = new Date(orderRow.time);
    const expiryDate = new Date(orderDate.getTime() + 72 * 60 * 60 * 1000); // 72 hours
    return expiryDate.getTime() - new Date().getTime() <= 0;
  };

  const [expired, setExpired] = useState(getIsExpired());

  useEffect(() => {
    if (expired) {
      return;
    }

    const interval = setInterval(() => {
      if (getIsExpired()) {
        setExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orderRow.time, expired]);

  return (
    <View style={styles.container}>
      {!expired && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => onPayPress(oid)}
        >
          <Text style={styles.payButtonText}>Pay</Text>
        </TouchableOpacity>
      )}
      <PaymentTimer orderTime={orderRow.time} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  payButton: {
    backgroundColor: '#4cb159',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default OrderPayButton;
