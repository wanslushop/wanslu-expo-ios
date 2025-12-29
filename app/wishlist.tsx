import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import ProductCard, { TrendingProduct } from './components/ProductCard';
import { useCartCount } from './context/CartCountContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';

interface WishlistItem {
  id: number;
  user_id: number;
  pid: string;
  src: "1688" | "tb" | "local" | "chinese";
  title: string;
  img: string;
  price: string;
  updated_at: string;
  created_at: string;
}

interface WishlistResponse {
  status: string;
  data: WishlistItem[];
  meta?: {
    total: number;
  };
}

export default function WishlistScreen() {
  const router = useRouter();
  const { cartCount } = useCartCount();
  const { t } = useI18n();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  
  // State management
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [src, setSrc] = useState<"1688" | "tb" | "local" | "chinese" | "all">("all");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit] = useState(12);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [wishlist, setWishlist] = useState<{ [pid: string]: { id: number } }>({});
  const [geoData, setGeoData] = useState<any>(null);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Fetch user data
  const fetchUserData = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({
            username: data.user.username,
            email: data.user.email
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const showResponseMessage = (text: string, type: 'success' | 'error') => {
    setMessageText(text);
    setMessageType(type);
    setShowMessage(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowMessage(false);
    }, 3000);
  };

  // Fetch wishlist items
  const fetchWishlist = async (isRefresh = false) => {
    if (isRefresh) {
      setLoading(true);
      setOffset(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    
    setError(null);
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        router.push('/login');
        return;
      }

      const currentOffset = isRefresh ? 0 : offset;
      const url = src === 'all' 
        ? `https://api.wanslu.shop/api/account/wishlist?offset=${currentOffset}&limit=${limit}`
        : `https://api.wanslu.shop/api/account/wishlist?offset=${currentOffset}&limit=${limit}&src=${src}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data: WishlistResponse = await response.json();
        const newItems = data.data || [];
        
        if (isRefresh) {
          setItems(newItems);
          setTotal(Number(data.meta?.total) || 0);
        } else {
          setItems(prev => [...prev, ...newItems]);
        }
        
        setOffset(currentOffset + newItems.length);
        setHasMore(newItems.length === limit);
        
        // Create wishlist map
        const map: { [pid: string]: { id: number } } = {};
        newItems.forEach((item: WishlistItem) => {
          map[item.pid] = { id: item.id };
        });
        
        if (isRefresh) {
          setWishlist(map);
        } else {
          setWishlist(prev => ({ ...prev, ...map }));
        }
      } else {
        setError('Failed to load wishlist');
        if (isRefresh) {
          setItems([]);
          setTotal(0);
          setWishlist({});
        }
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setError('Network error. Please try again.');
      if (isRefresh) {
        setItems([]);
        setTotal(0);
        setWishlist({});
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Handle wishlist toggle (add/remove)
  const handleWishlistToggle = async (product: TrendingProduct) => {
    const pid = String(product.pid);
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        showResponseMessage('Please login to use wishlist', 'error');
        return;
      }

      // Remove from wishlist (since we're in wishlist screen, items are already in wishlist)
      const wishlistItem = items.find(item => item.pid === pid);
      if (!wishlistItem) {
        showResponseMessage('Wishlist item not found.', 'error');
        return;
      }

      const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: wishlistItem.id })
      });

      if (response.ok) {
        showResponseMessage('Removed from wishlist!', 'success');
        // Remove from local items array
        setItems(prev => prev.filter(item => item.pid !== pid));
        setTotal(prev => Math.max(0, prev - 1));
        // Update wishlist map
        setWishlist(prev => {
          const copy = { ...prev };
          delete copy[pid];
          return copy;
        });
      } else {
        showResponseMessage('Failed to remove from wishlist.', 'error');
      }
    } catch (error) {
      console.error('Wishlist action failed:', error);
      showResponseMessage('Wishlist action failed.', 'error');
    }
  };

  // Map wishlist item to product card format
  const mapToProductCard = (item: WishlistItem): TrendingProduct => {
    return {
      pid: item.pid,
      src: item.src,
      title: item.title,
      img: item.img,
      price: parseFloat(item.price),
      view_count: 0
    };
  };

  // Handle product press
  const handleProductPress = (product: TrendingProduct) => {
    const productData = {
      id: product.pid.toString(),
      title: product.title,
      price: product.price.toString(),
      originalPrice: product.price.toString(),
      images: [{ imageUrl: product.img }],
      description: product.title,
      minOrder: 1,
      stock: 100,
      source: product.src,
    };
    
    router.push({
      pathname: '/product-detail',
      params: {
        id: product.pid.toString(),
        source: product.src,
        productData: JSON.stringify(productData)
      }
    });
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWishlist(true).finally(() => setRefreshing(false));
  }, [src]);

  // Handle load more
  const onLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchWishlist(false);
    }
  }, [loadingMore, hasMore, loading, offset, src]);

  // Handle source filter change
  const handleSourceChange = (newSrc: "1688" | "tb" | "local" | "chinese" | "all") => {
    setSrc(newSrc);
    setOffset(0);
    setHasMore(true);
    fetchWishlist(true);
  };

  // Handle retry
  const handleRetry = () => {
    fetchWishlist(true);
  };

  // Effects
  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    fetchWishlist(true);
  }, [src]);

  // Render wishlist item
  const renderWishlistItem = ({ item }: { item: WishlistItem }) => {
    const productCard = mapToProductCard(item);
    return (
      <View style={styles.wishlistItem}>
        <ProductCard 
          product={productCard} 
          onPress={() => handleProductPress(productCard)}
          showWishlistButton={true}
          isInWishlist={true}
          onWishlistToggle={handleWishlistToggle}
        />
      </View>
    );
  };
  

  // Render filter buttons
  const renderFilterButtons = () => (
    <View style={styles.categoryContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollContainer}
      >
        {[
          { key: "all", label: t('wishlist.filters.all') },
          { key: "1688", label: t('wishlist.filters.wholesale') },
          { key: "tb", label: t('wishlist.filters.retail') },
          { key: "chinese", label: t('wishlist.filters.chinese') }
        ].map((category, index) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryPill,
              index === 0 && styles.firstCategoryPill,
              index === 3 && styles.lastCategoryPill,
              src === category.key && styles.selectedCategoryPill
            ]}
            onPress={() => handleSourceChange(category.key as "1688" | "tb" | "local" | "chinese" | "all")}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.categoryPillText,
              src === category.key && styles.selectedCategoryPillText
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render loading more indicator
  const renderLoadMoreIndicator = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color="#E53E3E" />
        <Text style={styles.loadMoreText}>{t('wishlist.loadingMore')}</Text>
      </View>
    );
  };

  // Render end text
  const renderEndText = () => {
    if (loadingMore || hasMore || items.length === 0) return null;
    return (
      <View style={styles.endTextContainer}>
        <Text style={styles.endText}>{t('wishlist.endReached')}</Text>
      </View>
    );
  };

  // Render error state
  const renderErrorState = () => {
    if (!error) return null;
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#E53E3E" />
        <Text style={styles.errorTitle}>{t('errors.somethingWentWrong')}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
      {/* Response Message Display */}
      {showMessage && (
        <View style={[styles.messageContainer, messageType === 'success' ? styles.successMessage : styles.errorMessage]}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
      
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('wishlist.myWishlist')}</Text>
          <Text style={styles.itemCount}>{total} {t('wishlist.items')}</Text>
        </View>
        
        {renderFilterButtons()}
        
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E53E3E" />
            <Text style={styles.loadingText}>{t('wishlist.loadingWishlist')}</Text>
          </View>
        ) : error ? (
          renderErrorState()
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>{t('wishlist.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('wishlist.emptySubtitle')}
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.browseButtonText}>{t('wishlist.browseProducts')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => `${item.id}-${item.pid}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            numColumns={2}
            columnWrapperStyle={styles.row}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#E53E3E']}
              />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.1}
            ListFooterComponent={() => (
              <View>
                {renderLoadMoreIndicator()}
                {renderEndText()}
              </View>
            )}
          />
        )}
      </View>
      
      {/* Categories Modal */}
      <CategoriesModal 
        visible={showCategoriesModal} 
        onClose={() => setShowCategoriesModal(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },

  listContainer: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    margin: 0,
    gap: 16,
  },
  wishlistItem: {
    flex: 1,
    margin: 0,
    maxWidth: '100%',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  endTextContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  endText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    // position: 'absolute',
    // top: 0,
    // left: 0,
    // right: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successMessage: {
    backgroundColor: '#4CAF50',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryContainer: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    // paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  categoryScrollContainer: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    marginHorizontal: -1, // so borders overlap
    minWidth: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstCategoryPill: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastCategoryPill: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  selectedCategoryPill: {
    backgroundColor: '#ed2027',
    borderColor: '#ed2027',
  },
  categoryPillText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCategoryPillText: {
    color: 'white',
    fontWeight: '600',
  },
});
