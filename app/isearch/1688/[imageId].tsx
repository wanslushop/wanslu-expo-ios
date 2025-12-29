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
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
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
  offerId: string;
  subject: string;
  subjectTrans?: string;
  imageUrl: string;
  priceInfo: {
    price: string;
  };
  monthSold?: number;
  repurchaseRate?: string | number;
  rating?: number;
  certifiedFactory?: boolean;
  isOnePsaleFreePost?: boolean;
}

interface SearchFilters {
  sort: string;
  rating: string;
  certifiedFactory: boolean;
  isOnePsaleFreePost: boolean;
  min_price: number;
  max_price: number;
}

const { width } = Dimensions.get('window');

export default function ImageSearch1688() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const router = useRouter();
  const { convertPrice } = useCurrency();
  const { language, t } = useI18n();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: 'default',
    rating: 'all',
    certifiedFactory: false,
    isOnePsaleFreePost: false,
    min_price: 0,
    max_price: 1000,
  });
  const flatListRef = useRef<FlatList>(null);
  const [tempMinPrice, setTempMinPrice] = useState(0);
  const [tempMaxPrice, setTempMaxPrice] = useState(1000);
  const [tempCertifiedFactory, setTempCertifiedFactory] = useState(false);
  
  // Translation state
  const [translatingProducts, setTranslatingProducts] = useState<Set<string>>(new Set());
  const [translatedTitles, setTranslatedTitles] = useState<Map<string, string>>(new Map());
  const titleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Initialize animation for a product title
  const getTitleAnimation = (productId: string): Animated.Value => {
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
      const productId = product.offerId;
      
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
      const productId = product.offerId;
      const originalTitle = product.subjectTrans || product.subject;
      
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
      const response = await fetch('https://api.wanslu.shop/api/account/wishlist?src=1688', {
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

  const searchProducts = async (page = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        imageId: imageId,
        page: page.toString(),
        pageSize: '20',
        language: 'en',
      });

      // Add filters to params
      if (currentFilters.sort !== 'default') params.append('sort', currentFilters.sort);
      if (currentFilters.rating !== 'all') params.append('rating', currentFilters.rating);
      if (typeof currentFilters.certifiedFactory === 'boolean') {
        params.append('certifiedFactory', currentFilters.certifiedFactory ? '1' : '0');
      }
      if (currentFilters.isOnePsaleFreePost) params.append('isOnePsaleFreePost', 'true');
      if (currentFilters.min_price > 0) params.append('min_price', currentFilters.min_price.toString());
      if (currentFilters.min_price && currentFilters.max_price > currentFilters.min_price) {
        params.append('max_price', currentFilters.max_price.toString());
      }

      // Get user ID from me API
      const authToken = await AsyncStorage.getItem('authToken');
      if (authToken) {
        try {
          const headers = await getApiHeaders({
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          });
          const meResponse = await fetch('https://api.wanslu.shop/api/auth/me', {
            method: 'POST',
            headers,
            body: JSON.stringify({ ping: true })
          });
          if (meResponse.ok) {
            const meData = await meResponse.json();
            if (meData.status === 'success' && meData.user?.id) {
              params.append('user', meData.user.id.toString());
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
      }

      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/1688/image/search?${params}`, {
        headers
      });
      const data = await response.json();

      if (data.status === 'success' && data.data.result.success === 'true') {
        const fetchedProducts = data.data.result.result.data || [];
        setProducts(fetchedProducts);
        setTotalPages(data.data.result.result.totalPage || 1);
        setTotalRecords(data.data.result.result.totalRecords || 0);
        
        // Translate titles if language is not English
        if (language !== 'en' && fetchedProducts.length > 0) {
          translateProductTitles(fetchedProducts);
        }
      } else {
        console.error('API Error:', data);
        setError(data.message || 'No products found');
        setProducts([]);
        setTotalPages(1);
        setTotalRecords(0);
      }
    } catch (err) {
      console.error('Error fetching image search results:', err);
      setError('Failed to load search results');
      setProducts([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await searchProducts(1, filters);
    await fetchWishlist();
    setRefreshing(false);
  };

  useEffect(() => {
    if (imageId) {
      searchProducts(1, filters);
      fetchWishlist();
    }
  }, [imageId]);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    searchProducts(page, filters);
    // Scroll to top when page changes
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleFilterChange = async (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    setCurrentPage(1);
    try {
      setFilterLoading(true);
      await searchProducts(1, updatedFilters);
    } finally {
      setFilterLoading(false);
    }
  };

  const handleProductPress = (product: Product) => {
    const productData = {
      id: product.offerId.toString(),
      title: product.subjectTrans || product.subject,
      price: product.priceInfo.price,
      originalPrice: product.priceInfo.price,
      images: [{ imageUrl: product.imageUrl }],
      description: product.subjectTrans || product.subject,
      minOrder: 1,
      stock: 0,
      source: '1688',
    };

    router.push({
      pathname: '/product-detail',
      params: {
        id: product.offerId.toString(),
        src: '1688',
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

      const productId = product.offerId.toString();
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
            src: '1688',
            pid: productId,
            img: product.imageUrl,
            title: product.subjectTrans || product.subject,
            price: product.priceInfo?.price || '0',
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
    const productId = item.offerId.toString();
    const isInWishlistItem = isInWishlist(productId);
    
    // Get translated title or use original
    const displayTitle = language !== 'en' && translatedTitles.has(item.offerId)
      ? translatedTitles.get(item.offerId)!
      : (item.subjectTrans || item.subject);
    
    // Check if this product is being translated
    const isTranslating = language !== 'en' && translatingProducts.has(item.offerId);
    const titleOpacity = getTitleAnimation(item.offerId);
    
    return (
      <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
        {/* Search Source Badge */}
        <View style={styles.searchSourceBadge}>
          <Text style={styles.searchSourceText}>Wholesale</Text>
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
          source={{ uri: item.imageUrl }} 
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
            <Text style={styles.price}>{convertPrice(item.priceInfo.price)}</Text>
          </View>
          
          {/* Show product stats only if they exist */}
          {((item.monthSold || 0) > 0) || (item.repurchaseRate !== undefined && item.repurchaseRate !== null && item.repurchaseRate !== '') ? (
            <View style={styles.productStats}>
              {(item.monthSold || 0) > 0 && (
                <Text style={styles.statText}>Sold: {item.monthSold || 0}</Text>
              )}
                {/* Repurchase badge like search page */}
                {(item.repurchaseRate !== undefined && item.repurchaseRate !== null && item.repurchaseRate !== '') && (
            <View style={styles.badgeContainer}>
              {(() => {
                let rateText: string | null = null;
                const rate = item.repurchaseRate as unknown;
                if (typeof rate === 'string') {
                  rateText = rate.endsWith('%') ? rate : `${rate}%`;
                } else if (typeof rate === 'number') {
                  const normalized = rate <= 1 ? rate * 100 : rate;
                  rateText = `${Math.round(normalized * 100) / 100}%`;
                }
                return rateText ? (
                  <View style={styles.repurchaseBadge}>
                    <Text style={styles.repurchaseText}>{t('search.stats.repurchase')} : {rateText}</Text>
                  </View>
                ) : null;
              })()}
            </View>
          )}
            </View>
          ) : null}


        </View>
      </TouchableOpacity>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <TouchableOpacity
          key={`page-btn-${i}`}
          style={[
            styles.pageButton,
            i === currentPage ? styles.activePageButton : styles.inactivePageButton
          ]}
          onPress={() => handlePageChange(i)}
        >
          <Text style={[
            styles.pageButtonText,
            i === currentPage ? styles.activePageButtonText : styles.inactivePageButtonText
          ]}>
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.pageButton, styles.inactivePageButton, currentPage === 1 && styles.disabledButton]}
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? '#ccc' : '#666'} />
        </TouchableOpacity>
        {pages}
        <TouchableOpacity
          style={[styles.pageButton, styles.inactivePageButton, currentPage === totalPages && styles.disabledButton]}
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? '#ccc' : '#666'} />
        </TouchableOpacity>
      </View>
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
        onPress={() => searchProducts(1, filters)}
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

      {/* Sort and Rating (1688 Image Search) */}
      <View style={styles.filtersContainer}>
         {/* Filters Button */}
         <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => {
              setTempMinPrice(filters.min_price);
              setTempMaxPrice(filters.max_price);
              setTempCertifiedFactory(filters.certifiedFactory);
              setShowFilters(true);
            }}
          >
            <Text style={styles.filterButtonText}>Filters</Text>
            <Ionicons name="options-outline" size={16} color="#666" />
          </TouchableOpacity>
        <View style={styles.filterRow}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Text style={styles.filterButtonText}>
                {(
                  [
                    { value: 'default', label: 'Sort By' },
                    { value: 'price_ASC', label: 'Price: Low to High' },
                    { value: 'price_DESC', label: 'Price: High to Low' },
                    { value: 'monthSold_DESC', label: 'Best Selling' },
                    { value: 'repurchaseRate', label: 'Repurchase Rate' },
                  ] as { value: string; label: string }[]
                ).find(o => o.value === filters.sort)?.label || 'Sort By'}
              </Text>
              <Ionicons name={showSortDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
            </TouchableOpacity>
            {showSortDropdown && (
              <View style={styles.dropdownMenu}>
                {[
                  { value: 'default', label: 'Sort By' },
                  { value: 'price_ASC', label: 'Price: Low to High' },
                  { value: 'price_DESC', label: 'Price: High to Low' },
                  { value: 'monthSold_DESC', label: 'Best Selling' },
                  { value: 'repurchaseRate', label: 'Repurchase Rate' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowSortDropdown(false);
                      handleFilterChange({ sort: option.value });
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ position: 'relative' }}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowRatingDropdown(!showRatingDropdown)}
            >
              <Text style={styles.filterButtonText}>
                {(
                  [
                    { value: 'all', label: 'All Ratings' },
                    { value: '4', label: '4+ Stars' },
                    { value: '3', label: '3+ Stars' },
                  ] as { value: string; label: string }[]
                ).find(o => o.value === filters.rating)?.label || 'All Ratings'}
              </Text>
              <Ionicons name={showRatingDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
            </TouchableOpacity>
            {showRatingDropdown && (
              <View style={styles.dropdownMenu}>
                {[
                  { value: 'all', label: 'All Ratings' },
                  { value: '4', label: '4+ Stars' },
                  { value: '3', label: '3+ Stars' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowRatingDropdown(false);
                      handleFilterChange({ rating: option.value });
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

         
        </View>
        
      </View>

      {/* Results Count */}
      {totalRecords > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>
            Results {(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalRecords)} of {totalRecords} results
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => (
    <View>
      {/* Pagination */}
      {products.length > 0 && renderPagination()}
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
        ref={flatListRef}
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.offerId}
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
        ListHeaderComponentStyle={{ zIndex: 10, elevation: 0, overflow: 'visible' }}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
      />

      {filterLoading && (
        <View style={styles.filterLoadingOverlay}>
          <View style={styles.filterLoadingContent}>
            <ActivityIndicator size="large" color="#ed2027" />
            <Text style={styles.filterLoadingText}>Updating results...</Text>
          </View>
        </View>
      )}
      
      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('search.modal.title')}</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Price Range */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>{t('search.modal.priceRange')}</Text>
                <View style={styles.priceRangeContainer}>
                  <Text style={styles.priceText}>$0</Text>
                  <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                      <View style={[styles.sliderFill, { width: `${(tempMaxPrice / 1000) * 100}%` }]} />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb,
                          { left: `${(tempMaxPrice / 1000) * 100}%` }
                        ]}
                        onPressIn={() => {}}
                      />
                    </View>
                  </View>
                  <Text style={styles.priceText}>$1000</Text>
                </View>
                <Text style={styles.priceRangeText}>
                  ${tempMinPrice} - ${tempMaxPrice}
                </Text>
                
                {/* Price Range Buttons */}
                <View style={styles.priceButtonsContainer}>
                  <TouchableOpacity
                    style={styles.priceButton}
                    onPress={() => {
                      setTempMinPrice(0);
                      setTempMaxPrice(100);
                    }}
                  >
                    <Text style={styles.priceButtonText}>$0 - $100</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.priceButton}
                    onPress={() => {
                      setTempMinPrice(100);
                      setTempMaxPrice(500);
                    }}
                  >
                    <Text style={styles.priceButtonText}>$100 - $500</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.priceButton}
                    onPress={() => {
                      setTempMinPrice(500);
                      setTempMaxPrice(1000);
                    }}
                  >
                    <Text style={styles.priceButtonText}>$500 - $1000</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Certified Factory */}
              <View style={styles.filterGroup}>
                <View style={styles.checkboxContainer}>
                  <Switch
                    value={tempCertifiedFactory}
                    onValueChange={setTempCertifiedFactory}
                    trackColor={{ false: '#ddd', true: '#ed2027' }}
                    thumbColor={tempCertifiedFactory ? '#fff' : '#f4f3f4'}
                  />
                  <Text style={styles.checkboxLabel}>{t('search.modal.certifiedFactory')}</Text>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.applyButton, filterLoading && styles.applyButtonDisabled]}
                onPress={async () => {
                  if (filterLoading) return;
                  setShowFilters(false);
                  setFilterLoading(true);
                  await handleFilterChange({
                    min_price: tempMinPrice,
                    max_price: tempMaxPrice,
                    certifiedFactory: tempCertifiedFactory,
                  });
                  setFilterLoading(false);
                }}
                disabled={filterLoading}
              >
                {filterLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.applyButtonText}>{t('search.modal.applying')}</Text>
                  </View>
                ) : (
                  <Text style={styles.applyButtonText}>{t('search.modal.applyFilters')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
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
    marginTop: Platform.OS === 'ios' ? 60 : 0,
  },
  content: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    overflow: 'visible',
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 3000,
    overflow: 'visible',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3000,
    overflow: 'visible',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: 'white',
    minWidth: 150,
    zIndex: 3000,
    marginBottom: 10,
  },
  filterButtonText: {
    color: '#333',
    fontSize: 14,
    marginRight: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 6,
    elevation: 20,
    zIndex: 9999,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  activeFilterButton: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
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
  checkboxContainer: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  activePageButton: {
    backgroundColor: '#E53E3E',
  },
  inactivePageButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activePageButtonText: {
    color: 'white',
  },
  inactivePageButtonText: {
    color: '#333',
  },
  filterLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  filterLoadingContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
  },
  filterLoadingText: {
    marginTop: 10,
    color: '#333',
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
    marginBottom: 0,
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
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  repurchaseBadge: {
    marginTop: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  repurchaseText: {
    color: '#333',
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#ed2027',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ed2027',
    top: -8,
    marginLeft: -10,
  },
  priceRangeText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  priceButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  priceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    alignItems: 'center',
  },
  priceButtonText: {
    fontSize: 14,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#ed2027',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
