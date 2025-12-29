import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import CategoriesModal from '../../components/CategoriesModal';
import Header from '../../components/Header';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { useNavigation } from '../../context/NavigationContext';
import { getApiHeaders } from '../../utils/api-helpers';
import { translateWithCache } from '../../utils/translation-cache';

// Map app language codes to translation API target codes
const mapLanguageToTranslationCode = (lang: string): string => {
  const mapping: Record<string, string> = {
    'en': 'en',
    'es': 'es',
    'fr': 'fr',
    'ru': 'ru',
    'zh': 'zh',
    'zh-hans': 'zh',
    'ar': 'ar',
    'pt': 'pt',
    'de': 'de',
    'ja': 'ja',
    'ko': 'ko',
    'it': 'it',
  };
  return mapping[lang] || 'en';
};

// Use shared cached translator

interface Product {
  main_image_url: string;
  multi_language_info: {
    title: string;
  };
  item_id: number;
  price: string;
  promotion_displays: Array<{
    promotion_info_list: Array<{
      promotion_name: string;
    }>;
  }>;
  inventory: number;
  shop_name: string;
  title: string;
  tags: string[];
}

interface SearchFilters {
  sort: string;
  rating: string;
  min_price: number;
  max_price: number;
}

const { width } = Dimensions.get('window');

export default function ImageSearchTaobao() {
  const { imageName } = useLocalSearchParams<{ imageName: string }>();
  const router = useRouter();
  const { convertPrice } = useCurrency();
  const { language } = useI18n();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: 'default',
    rating: 'all',
    min_price: 0,
    max_price: 1000,
  });
  
  // Translation state
  const [translatingProducts, setTranslatingProducts] = useState<Set<number>>(new Set());
  const [translatedTitles, setTranslatedTitles] = useState<Map<number, string>>(new Map());
  const titleAnimations = useRef<Map<number, Animated.Value>>(new Map()).current;

  // Initialize animation for a product title
  const getTitleAnimation = (productId: number): Animated.Value => {
    if (!titleAnimations.has(productId)) {
      titleAnimations.set(productId, new Animated.Value(0.5)); // Start with reduced opacity
    }
    return titleAnimations.get(productId)!;
  };

  // Translate product titles when language is not English
  const translateProductTitles = async (products: Product[]) => {
    if (language === 'en') {
      // Clear translations if language is English
      setTranslatedTitles(new Map());
      setTranslatingProducts(new Set());
      return;
    }

    const targetLang = mapLanguageToTranslationCode(language);

    // Start pulse animation for all products and mark as translating
    products.forEach(product => {
      const productId = product.item_id;
      
      // Add to translating set immediately
      setTranslatingProducts(prev => {
        const newSet = new Set(prev);
        newSet.add(productId);
        return newSet;
      });
      
      const animValue = getTitleAnimation(productId);
      
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Translate each product title individually and update immediately
    products.forEach(async (product) => {
      const productId = product.item_id;
      const originalTitle = product.multi_language_info?.title || product.title;
      
      try {
        const translated = await translateWithCache(originalTitle, targetLang);
        
        // Update translated title immediately for this product
        setTranslatedTitles(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, translated);
          return newMap;
        });
        
        // Remove from translating set immediately
        setTranslatingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        // Stop animation and set full opacity immediately
        const animValue = titleAnimations.get(productId);
        if (animValue) {
          animValue.stopAnimation(() => {
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        }
      } catch (error) {
        console.error(`Failed to translate product ${productId}:`, error);
        
        // Remove from translating set even on error
        setTranslatingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        // Reset animation on error
        const animValue = titleAnimations.get(productId);
        if (animValue) {
          animValue.stopAnimation(() => {
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        }
      }
    });
  };

  const fetchWishlist = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const headers = await getApiHeaders({
        Authorization: `Bearer ${authToken}`,
      });
      const response = await fetch('https://api.wanslu.shop/api/account/wishlist?src=tb', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setWishlist(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const searchProducts = async (currentFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        image_url: `https://api.wanslu.shop/isearch/${imageName}`,
        language: 'en',
      });

      // TB image search: do not apply sort or price filters

      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/taobao/search?${params}`, {
        headers
      });
      const data = await response.json();

      if (data.status === 'success') {
        const fetchedProducts = data.search_results?.data || [];
        setProducts(fetchedProducts);
        
        // Translate titles if language is not English
        if (language !== 'en' && fetchedProducts.length > 0) {
          translateProductTitles(fetchedProducts);
        }
      } else {
        console.error('API Error:', data);
        setError(data.message || 'No products found');
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching image search results:', err);
      setError('Failed to load search results');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await searchProducts(filters);
    await fetchWishlist();
    setRefreshing(false);
  };

  useEffect(() => {
    if (imageName) {
      searchProducts(filters);
      fetchWishlist();
    }
  }, [imageName]);

  // Translate existing products when language changes
  useEffect(() => {
    if (products.length > 0) {
      if (language !== 'en') {
        translateProductTitles(products);
      } else {
        // Clear translations when switching back to English
        setTranslatedTitles(new Map());
        setTranslatingProducts(new Set());
        // Reset all title animations to full opacity
        titleAnimations.forEach((animValue) => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    searchProducts(updatedFilters);
  };

  const handleProductPress = (product: Product) => {
    const productData = {
      id: product.item_id.toString(),
      title: product.multi_language_info?.title || product.title,
      price: product.price,
      originalPrice: product.price,
      images: [{ imageUrl: product.main_image_url }],
      description: product.multi_language_info?.title || product.title,
      minOrder: 1,
      stock: product.inventory,
      source: 'tb',
    };

    router.push({
      pathname: '/product-detail',
      params: {
        id: product.item_id.toString(),
        src: 'tb',
        productData: JSON.stringify(productData)
      }
    });
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some((item) => item.pid === productId.toString());
  };

  const handleWishlistToggle = async (product: Product) => {
    try {
      setWishlistLoading(true);
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        alert('Please login to add items to wishlist');
        return;
      }

      const productId = product.item_id.toString();
      const isCurrentlyInWishlist = isInWishlist(productId);

      if (isCurrentlyInWishlist) {
        const wishlistItem = wishlist.find((item) => item.pid === productId);
        if (wishlistItem) {
          const headers = await getApiHeaders({
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          });
          const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ id: wishlistItem.id }),
          });

          if (response.ok) {
            setWishlist((prev) => prev.filter((item) => item.id !== wishlistItem.id));
          }
        }
      } else {
        const headers = await getApiHeaders({
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        });
        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            src: 'tb',
            pid: productId,
            img: product.main_image_url,
            title: product.multi_language_info?.title || product.title,
            price: product.price,
          }),
        });

        if (response.ok) {
          fetchWishlist();
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    } finally {
      setWishlistLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const productId = item.item_id.toString();
    const numericProductId = item.item_id;
    const isInWishlistItem = isInWishlist(productId);
    
    // Get translated title or use original
    const displayTitle = language !== 'en' && translatedTitles.has(numericProductId)
      ? translatedTitles.get(numericProductId)!
      : (item.multi_language_info?.title || item.title);
    
    // Check if this product is being translated
    const isTranslating = language !== 'en' && translatingProducts.has(numericProductId);
    const titleOpacity = getTitleAnimation(numericProductId);
    
    return (
      <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
        {/* Search Source Badge */}
        <View style={styles.searchSourceBadge}>
          <Text style={styles.searchSourceText}>Retail</Text>
        </View>
        
        {/* Wishlist Button */}
        <TouchableOpacity 
          style={styles.wishlistButton}
          onPress={(e) => {
            e.stopPropagation();
            handleWishlistToggle(item);
          }}
          disabled={wishlistLoading}
        >
          {wishlistLoading ? (
            <ActivityIndicator size="small" color="#E53E3E" />
          ) : (
            <Ionicons 
              name={isInWishlistItem ? "heart" : "heart-outline"} 
              size={20} 
              color={isInWishlistItem ? "#E53E3E" : "#666"} 
            />
          )}
        </TouchableOpacity>
        
        <Image 
          source={{ uri: item.main_image_url }} 
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <Animated.Text 
            style={[
              styles.productTitle,
              language !== 'en' && { opacity: titleOpacity }
            ]} 
            numberOfLines={2}
          >
            {displayTitle}
          </Animated.Text>
          {isTranslating && (
            <Text style={styles.translatingText}>Translating</Text>
          )}
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{convertPrice(item.price)}</Text>
          </View>
          
          {/* Show product stats only if they exist */}
          {item.inventory > 0 && (
            <View style={styles.productStats}>
              <Text style={styles.statText}>Stock: {item.inventory}</Text>
            </View>
          )}
          
          {item.shop_name && (
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{item.shop_name}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptySubtitle}>
        We couldn't find any products matching your image. Try uploading a different image or adjusting your search.
      </Text>
      <TouchableOpacity 
        style={styles.tryAgainButton}
        onPress={() => router.back()}
      >
        <Text style={styles.tryAgainButtonText}>Try Another Image</Text>
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle" size={64} color="#E53E3E" />
      <Text style={styles.emptyTitle}>Something Went Wrong</Text>
      <Text style={styles.emptySubtitle}>
        {error || 'Failed to load search results. Please try again.'}
      </Text>
      <TouchableOpacity 
        style={styles.tryAgainButton}
        onPress={() => searchProducts(filters)}
      >
        <Text style={styles.tryAgainButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>Image Search Results</Text>
        <Text style={styles.searchSubtitle}>Find similar products based on your image</Text>
      </View>
 
      {/* Results Count */}
      {products.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>
            Found {products.length} results
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmptyComponent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>Searching for products...</Text>
        </View>
      );
    }
    
    if (error) {
      return renderErrorState();
    }
    
    if (products.length === 0) {
      return renderEmptyState();
    }
    
    return null;
  };

  return (
    <View style={styles.container}>
      <Header />
      
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.item_id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.productList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E53E3E']}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
      />
      
      {/* Categories Modal */}
      <CategoriesModal 
        visible={showCategoriesModal} 
        onClose={() => setShowCategoriesModal(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  searchSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  activeFilterButton: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
  },
  activeFilterButtonText: {
    color: 'white',
  },
  advancedFilters: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceText: {
    fontSize: 14,
    color: '#666',
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  productList: {
    padding: 8,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  tryAgainButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tryAgainButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // Product card styles
  productCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.9,
    elevation: 5,
  },
  searchSourceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E53E3E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  searchSourceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    zIndex: 1,
  },
  productImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  translatingText: {
    fontSize: 10,
    color: '#4CAF50',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  priceContainer: {
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  productStats: {
    marginTop: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  shopInfo: {
    marginTop: 4,
  },
  shopName: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
