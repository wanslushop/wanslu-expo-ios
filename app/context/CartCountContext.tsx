import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface CartCountContextType {
  cartCount: number;
  refreshCartCount: () => void;
}

const CartCountContext = createContext<CartCountContextType>({
  cartCount: 0,
  refreshCartCount: () => {},
});

export const CartCountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return setCartCount(0);

      const response = await fetch('https://api.wanslu.shop/api/account/cart/count', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCartCount(data.count || 0);
      }
    } catch (e) {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  return (
    <CartCountContext.Provider value={{ cartCount, refreshCartCount: fetchCartCount }}>
      {children}
    </CartCountContext.Provider>
  );
};

export const useCartCount = () => useContext(CartCountContext);
