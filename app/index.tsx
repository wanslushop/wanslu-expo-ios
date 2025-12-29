import * as Linking from "expo-linking";
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import AccountScreen from './account';
import CategoriesModal from './components/CategoriesModal';
import Navbar from './components/Navbar';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import HomeScreen from './HomeScreen';
import OrdersScreen from './orders';
import SearchScreen from './search';
import WishlistScreen from './wishlist';

const AppContent: React.FC = () => {
  const { currentScreen, setCurrentScreen, searchQuery, searchCategory, showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const [showMenu, setShowMenu] = useState(false);

  const url = Linking.useURL(); // <-- move this to top level

  const handleMenuPress = () => {
    setShowMenu(!showMenu);
  };

  const handleMenuClose = () => {
    setShowMenu(false);
  };

  // if get param ?orders setCurrentScreen('orders')
  useEffect(() => {
    if (url) {
      const parsed = Linking.parse(url);
      if (parsed.queryParams?.orders !== undefined) {
        setCurrentScreen("orders");
      }
    }
  }, [url]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'orders':
        return <OrdersScreen />;
      case 'wishlist':
        return <WishlistScreen />;
      case 'account':
        return <AccountScreen />;
      case 'search':
        return <SearchScreen 
          searchQuery={searchQuery}
          searchCategory={searchCategory}
        />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderScreen()}
      <Navbar activeTab={currentScreen} onTabPress={setCurrentScreen} />
      <CategoriesModal 
        visible={showCategoriesModal} 
        onClose={() => setShowCategoriesModal(false)} 
      />
    </SafeAreaView>
  );
};

const MainApp: React.FC = () => {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default MainApp;
