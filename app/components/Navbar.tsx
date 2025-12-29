import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';

export type NavItem = 'home' | 'orders' | 'wishlist' | 'account' | 'search';

interface NavbarProps {
  activeTab: NavItem;
  onTabPress: (tab: NavItem) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabPress }) => {
  const { t } = useI18n();
  
  const navItems = [
    {
      id: 'home' as NavItem,
      icon: 'home',
      label: t('navbar.home'),
    },
    {
      id: 'orders' as NavItem,
      icon: 'bag',
      label: t('navbar.orders'),
    },
    {
      id: 'wishlist' as NavItem,
      icon: 'heart',
      label: t('navbar.wishlist'),
    },
    {
      id: 'account' as NavItem,
      icon: 'person',
      label: t('navbar.account'),
    },
  ];

  return (
    <View style={styles.container}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.navItem}
          onPress={() => onTabPress(item.id)}
        >
          <View style={[
            styles.iconContainer,
            activeTab === item.id && styles.activeIconContainer
          ]}>
            <Ionicons
              name={item.icon as any}
              size={20}
              color={activeTab === item.id ? '#E53E3E' : 'white'}
            />
          </View>
          <Text style={[
            styles.navLabel,
            activeTab === item.id && styles.activeNavLabel
          ]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#E53E3E',
    paddingTop: 5,
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
  },
  iconContainer: {
    width: 50,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeIconContainer: {
    backgroundColor: 'white',
    borderRadius: 5,
  },
  navLabel: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  activeNavLabel: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default Navbar;
