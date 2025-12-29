import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PaymentTimerProps {
  orderTime: string;
}

const PaymentTimer: React.FC<PaymentTimerProps> = ({ orderTime }) => {
  const calculateTimeLeft = () => {
    const orderDate = new Date(orderTime);
    const expiryDate = new Date(orderDate.getTime() + 72 * 60 * 60 * 1000); // 72 hours
    const difference = expiryDate.getTime() - new Date().getTime();

    if (difference > 0) {
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      return { days, hours, minutes, seconds };
    }

    return null;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [orderTime]);

  if (!timeLeft) {
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>Payment time expired</Text>
      </View>
    );
  }

  const { days, hours, minutes, seconds } = timeLeft;
  
  return (
    <View style={styles.container}>
      <Text style={styles.timerText}>
        Time left to pay: {days > 0 && `${days}d `}
        {String(hours).padStart(2, '0')}h:
        {String(minutes).padStart(2, '0')}m:
        {String(seconds).padStart(2, '0')}s
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 0,
  },
  timerText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  expiredText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '500',
  },
});

export default PaymentTimer;
