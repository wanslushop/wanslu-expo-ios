import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useNavigation } from '../context/NavigationContext';
import ImageSearchModal from './ImageSearchModal';


interface HeaderProps {
  cartCount?: number;
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  cartCount = 0,
  searchText: externalSearchText,
  onSearchTextChange,
  selectedCategory: externalSelectedCategory,
  onCategoryChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { navigateToSearch, showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const { isAuthenticated, authToken } = useAuth();
  const { t } = useI18n();
  const [notifCount, setNotifCount] = useState<number>(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);
  const isFocused = typeof useIsFocused === 'function' ? useIsFocused() : true;
  
  // Check if we're on search page
  const isSearchPage = pathname === '/search';
  
  // Simple state management - no external menu control
  const [internalSearchText, setInternalSearchText] = useState('');
  const [internalSelectedCategory, setInternalSelectedCategory] = useState('Wholesale');
  const [showMenu, setShowMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const searchText = externalSearchText !== undefined ? externalSearchText : internalSearchText;
  const selectedCategory = externalSelectedCategory !== undefined ? externalSelectedCategory : internalSelectedCategory;
  
  const categories = [
    { value: 'Wholesale', label: t('search.categories.wholesale') },
    { value: 'Retail', label: t('search.categories.retail') },
    { value: 'Local', label: t('search.categories.local') },
    { value: 'Chinese', label: t('search.categories.chinese') },
  ];
  
  // Debug state changes
  useEffect(() => {
    console.log('Menu state changed - showMenu:', showMenu);
  }, [showMenu]);
  
  // Header no longer syncs from URL; SearchScreen owns URL->state syncing
  
  const handleSearchTextChange = (text: string) => {
    if (externalSearchText !== undefined) {
      onSearchTextChange?.(text);
    } else {
      setInternalSearchText(text);
    }
  };
  
  const handleCategoryChange = (category: string) => {
    if (externalSelectedCategory !== undefined) {
      onCategoryChange?.(category);
    } else {
      setInternalSelectedCategory(category);
    }
  };
  
  const handleMenuPress = () => {
    console.log('Hamburger menu pressed, opening categories modal');
    setShowCategoriesModal(true);
  };
  
  const handleMenuClose = () => {
    console.log('Menu close pressed, current showMenu:', showMenu);
    setShowMenu(false);
    console.log('Setting showMenu to false');
  };


  const handleSearchPress = () => {
    if (searchText.trim()) {
      const categoryMap: { [key: string]: string } = {
        'Wholesale': '1688',
        'Retail': 'tb',
        'Chinese': 'chinese',
        'Local': 'local'
      };
      const mappedCategory = categoryMap[selectedCategory] || '1688';
      
      console.log('Header - Search triggered:', { 
        searchText: searchText.trim(), 
        selectedCategory, 
        mappedCategory 
      });
      
      if (isSearchPage) {
        // If already on search page, update the URL param to trigger fresh search
        router.replace({
          pathname: '/search',
          params: { q: searchText.trim() }
        });
      } else {
        // Navigate to search page with query parameter
        router.push({
          pathname: '/search',
          params: { q: searchText.trim() }
        });
      }
    }
  };

  const handleCameraPress = () => {
    setShowImageSearchModal(true);
  };

  const handleMenuNavigation = (route: string) => {
    handleMenuClose();
    // Type assertion to handle dynamic routes
    router.push(route as any);
  };

  // Fetch notification count
  useEffect(() => {
    if (!isAuthenticated || !authToken) return;
    let cancelled = false;
    const fetchNotifCount = async () => {
      setNotifLoading(true);
      try {
        const res = await fetch('https://api.wanslu.shop/api/etc/notifications/count', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setNotifCount(data.count || 0);
        } else {
          if (!cancelled) setNotifCount(0);
        }
      } catch {
        if (!cancelled) setNotifCount(0);
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    };
    fetchNotifCount();
    return () => { cancelled = true; };
  }, [isAuthenticated, authToken, isFocused]);

  return (
    <>
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.menuButton, showMenu && { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={handleMenuPress}>
          <Ionicons name="menu" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
          <Image 
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Notification Bell */}
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => router.push('/notifications')}
              disabled={notifLoading}
            >
              <Ionicons name="notifications" size={24} color="white" />
              {notifCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {/* Cart Icon */}
          <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
            <Ionicons name="cart" size={24} color="white" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowDropdown(!showDropdown)}
            >
              <Text style={styles.dropdownText}>{(categories.find(c => c.value === selectedCategory)?.label) || selectedCategory}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
            
            {showDropdown && (
              <View style={styles.dropdown}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      handleCategoryChange(category.value);
                      setShowDropdown(false);
                    }}
                  >
                    {selectedCategory === category.value && (
                      <Ionicons name="checkmark" size={16} color="#333" />
                    )}
                    <Text style={[
                      styles.dropdownItemText,
                      selectedCategory === category.value && styles.selectedDropdownItem
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholderTextColor="#999" placeholder={t('search.placeholder')}
              value={searchText}
              onChangeText={handleSearchTextChange}
              onSubmitEditing={handleSearchPress}
            />
            <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress}>
              <Ionicons name="camera" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
            <Ionicons name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ImageSearchModal
        isVisible={showImageSearchModal}
        onClose={() => setShowImageSearchModal(false)}
        source={selectedCategory === 'Wholesale' ? '1688' : selectedCategory === 'Retail' ? 'tb' : selectedCategory === 'Local' ? 'local' : 'chinese'}
      />
    </View>
  </>
  );
};
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E53E3E',
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    zIndex: 10000
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuButton: {
    padding: 8,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 40,
    marginBottom: 4,
  },
  logoText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoSubtext: {
    color: 'white',
    fontSize: 10,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderColor: '#ddd',
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  selectedDropdownItem: {
    fontWeight: 'bold',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  cameraButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  menuItems: {
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  notifButton: {
    position: 'relative',
    padding: 8,
    marginRight: 2,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  notifBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
});

export default Header;
