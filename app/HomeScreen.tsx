import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import DepartmentsGrid from './components/DepartmentsGrid';
import FeaturedCards from './components/FeaturedCards';
import Header from './components/Header';
import HeroCarousel from './components/HeroCarousel';
import HotSearches from './components/HotSearches';
import ProductCard, { TrendingProduct } from './components/ProductCard';
import { useAuth } from './context/AuthContext';
import { useCartCount } from './context/CartCountContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';
import { translateWithCache } from './utils/translation-cache';

interface TrendingApiResponse {
  status: string;
  data: TrendingProduct[];
}

// Translation utility functions
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
  };
  return mapping[lang] || 'en';
};

export default function HomeScreen() {
  const router = useRouter();
  const { navigateToSearch, showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const { cartCount } = useCartCount();
  const { isAuthenticated, authToken } = useAuth();
  const { t, language } = useI18n();
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local and Chinese products states
  const [localProducts, setLocalProducts] = useState<TrendingProduct[]>([]);
  const [chineseProducts, setChineseProducts] = useState<TrendingProduct[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingChinese, setLoadingChinese] = useState(true);
  
  // Translation state
  const [translatingTrendingProducts, setTranslatingTrendingProducts] = useState<Set<string>>(new Set());
  const [translatedTrendingTitles, setTranslatedTrendingTitles] = useState<Map<string, string>>(new Map());
  const [translatingLocalProducts, setTranslatingLocalProducts] = useState<Set<string>>(new Set());
  const [translatedLocalTitles, setTranslatedLocalTitles] = useState<Map<string, string>>(new Map());
  const [translatingChineseProducts, setTranslatingChineseProducts] = useState<Set<string>>(new Set());
  const [translatedChineseTitles, setTranslatedChineseTitles] = useState<Map<string, string>>(new Map());
  const trendingTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  const localTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  const chineseTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  
  // Initialize animation for a product title
  const getTitleAnimation = (productId: string, type: 'trending' | 'local' | 'chinese'): Animated.Value => {
    const animations = type === 'trending' ? trendingTitleAnimations : type === 'local' ? localTitleAnimations : chineseTitleAnimations;
    if (!animations.has(productId)) {
      animations.set(productId, new Animated.Value(0.5));
    }
    return animations.get(productId)!;
  };
  
  // Translate product titles
  const translateProductTitles = async (products: TrendingProduct[], type: 'trending' | 'local' | 'chinese') => {
    if (language === 'en') {
      if (type === 'trending') {
        setTranslatedTrendingTitles(new Map());
        setTranslatingTrendingProducts(new Set());
      } else if (type === 'local') {
        setTranslatedLocalTitles(new Map());
        setTranslatingLocalProducts(new Set());
      } else {
        setTranslatedChineseTitles(new Map());
        setTranslatingChineseProducts(new Set());
      }
      return;
    }

    const targetLang = mapLanguageToTranslationCode(language);
    const translatingSet = type === 'trending' ? setTranslatingTrendingProducts : type === 'local' ? setTranslatingLocalProducts : setTranslatingChineseProducts;
    const translatedMap = type === 'trending' ? setTranslatedTrendingTitles : type === 'local' ? setTranslatedLocalTitles : setTranslatedChineseTitles;

    // Start pulse animation for all products and mark as translating
    products.forEach(product => {
      const productId = product.pid;
      
      translatingSet(prev => {
        const newSet = new Set(prev);
        newSet.add(productId);
        return newSet;
      });
      
      const animValue = getTitleAnimation(productId, type);
      
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
      const productId = product.pid;
      const originalTitle = product.title;
      
      try {
        const translated = await translateWithCache(originalTitle, targetLang);
        
        translatedMap(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, translated);
          return newMap;
        });
        
        translatingSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        const animValue = getTitleAnimation(productId, type);
        animValue.stopAnimation(() => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      } catch (error) {
        console.error(`Failed to translate product ${productId}:`, error);
        translatingSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        const animValue = getTitleAnimation(productId, type);
        animValue.stopAnimation(() => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }
    });
  };

  
  // Wishlist states
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Map<string, number>>(new Map());
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistFetched, setWishlistFetched] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  useEffect(() => {
    fetchTrendingProducts();
    fetchLocalProducts();
    fetchChineseProducts();
  }, []);

  // Translate products when language changes or products are loaded
  useEffect(() => {
    if (trendingProducts.length > 0) {
      translateProductTitles(trendingProducts, 'trending');
    }
  }, [language, trendingProducts]);

  useEffect(() => {
    if (localProducts.length > 0) {
      translateProductTitles(localProducts, 'local');
    }
  }, [language, localProducts]);

  useEffect(() => {
    if (chineseProducts.length > 0) {
      translateProductTitles(chineseProducts, 'chinese');
    }
  }, [language, chineseProducts]);

  // Fetch wishlist items on mount and when auth status changes
  useEffect(() => {
    console.log('HomeScreen useEffect - isAuthenticated:', isAuthenticated, 'wishlistFetched:', wishlistFetched);
    if (isAuthenticated && !wishlistFetched) {
      fetchWishlistItems();
    } else if (!isAuthenticated) {
      setWishlistItems(new Set());
      setWishlistIds(new Map());
      setWishlistFetched(false);
      setLastFetchTime(0);
    }
  }, [isAuthenticated]); // Remove wishlistFetched from dependencies

  // Handle screen focus - refresh wishlist when screen is opened
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen focused');
      if (isAuthenticated) {
        // Small delay to ensure component is fully mounted
        const timer = setTimeout(() => {
          handleScreenFocus();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [isAuthenticated])
  );

  // Periodic refresh to sync with changes from other devices (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      console.log('Periodic wishlist sync check...');
      fetchWishlistItems(true); // Force refresh from API
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const fetchWishlistItems = async (forceRefresh = false) => {
    if (!authToken) return;
    
    // Check if we already fetched recently (within 5 seconds) - unless force refresh
    const now = Date.now();
    if (!forceRefresh && wishlistFetched && (now - lastFetchTime) < 5000) {
      console.log('Wishlist already fetched recently, skipping...');
      return;
    }
    
    try {
      setWishlistLoading(true);
      console.log('Fetching wishlist items...', forceRefresh ? '(forced refresh)' : '');
      
      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        const wishlistSet = new Set<string>();
        const wishlistMap = new Map<string, number>();
        
        data.data?.forEach((item: any) => {
          wishlistSet.add(item.pid);
          wishlistMap.set(item.pid, item.id);
        });
        
        setWishlistItems(wishlistSet);
        setWishlistIds(wishlistMap);
        setWishlistFetched(true);
        setLastFetchTime(now);
        console.log('Wishlist items fetched and cached:', wishlistSet.size, 'items');
      }
    } catch (error) {
      console.error('Failed to fetch wishlist items:', error);
    } finally {
      setWishlistLoading(false);
    }
  };

  const refreshWishlist = async () => {
    console.log('Refreshing wishlist...');
    setWishlistFetched(false);
    setLastFetchTime(0);
    await fetchWishlistItems(true); // Force refresh from API
  };

  // Function to handle screen focus - refresh wishlist when screen is opened
  const handleScreenFocus = () => {
    if (isAuthenticated) {
      console.log('Screen focused, refreshing wishlist...');
      refreshWishlist();
    }
  };

  // Check if a specific product is in wishlist by calling API directly
  const checkWishlistStatus = async (productId: string): Promise<{ isInWishlist: boolean; wishlistId?: number }> => {
    if (!authToken) return { isInWishlist: false };
    
    try {
      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        const wishlistItem = data.data?.find((item: any) => item.pid === productId);
        
        if (wishlistItem) {
          console.log(`Product ${productId} found in wishlist via API check`);
          return { isInWishlist: true, wishlistId: wishlistItem.id };
        } else {
          console.log(`Product ${productId} not found in wishlist via API check`);
          return { isInWishlist: false };
        }
      }
    } catch (error) {
      console.error('Failed to check wishlist status:', error);
    }
    
    return { isInWishlist: false };
  };

  const handleWishlistToggle = async (product: TrendingProduct) => {
    if (!isAuthenticated) {
      Alert.alert(t('common.error'), t('home.pleaseLoginToUseWishlist'));
      return;
    }

    if (!authToken) return;

    try {
      const productId = product.pid;
      
      // First check local cache
      let isInWishlist = wishlistItems.has(productId);
      let wishlistId = wishlistIds.get(productId);
      
      // If not in local cache, check API directly (for cross-device sync)
      if (!isInWishlist) {
        console.log(`Product ${productId} not in local cache, checking API...`);
        const apiCheck = await checkWishlistStatus(productId);
        isInWishlist = apiCheck.isInWishlist;
        wishlistId = apiCheck.wishlistId;
        
        // Update local cache if found in API
        if (isInWishlist && wishlistId) {
          setWishlistItems(prev => new Set([...prev, productId]));
          setWishlistIds(prev => new Map(prev).set(productId, wishlistId!));
          console.log(`Updated local cache with product ${productId} from API`);
        }
      }

      if (isInWishlist) {
        // Remove from wishlist
        const wishlistId = wishlistIds.get(productId);
        if (!wishlistId) {
          Alert.alert(t('common.error'), t('home.wishlistItemNotFound'));
          return;
        }

        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: wishlistId })
        });

        if (response.ok) {
          setWishlistItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
          setWishlistIds(prev => {
            const newMap = new Map(prev);
            newMap.delete(productId);
            return newMap;
          });
          console.log(`Removed product ${productId} from wishlist`);
        } else {
          Alert.alert(t('common.error'), t('home.failedToRemoveFromWishlist'));
        }
      } else {
        // Add to wishlist
        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            src: product.src,
            pid: product.pid,
            img: product.img,
            title: product.title,
            price: product.price.toString(),
          })
        });

        const responseData = await response.json();

        if (response.ok) {
          Alert.alert(t('common.success'), t('home.addedToWishlist'));
          const wishlistId = responseData.id || responseData.data?.id;
          if (wishlistId) {
            setWishlistItems(prev => new Set([...prev, productId]));
            setWishlistIds(prev => new Map(prev).set(productId, wishlistId));
            console.log(`Added product ${productId} to wishlist`);
          }
        } else if (responseData.status === "error" && responseData.message === "Item already exists in wishlist") {
          Alert.alert(t('common.info'), t('home.itemAlreadyInWishlist'));
          const wishlistId = responseData.data?.id;
          if (wishlistId) {
            setWishlistItems(prev => new Set([...prev, productId]));
            setWishlistIds(prev => new Map(prev).set(productId, wishlistId));
            console.log(`Product ${productId} already in wishlist, updated state`);
          }
        } else {
          Alert.alert(t('common.error'), responseData.message || t('home.failedToAddToWishlist'));
        }
      }
    } catch (error) {
      console.error('Wishlist action failed:', error);
      Alert.alert(t('common.error'), t('home.wishlistActionFailed'));
    }
  };

  const fetchTrendingProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("https://api.wanslu.shop/api/home/trending", {
        method: "GET",
        headers: {
          "accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TrendingApiResponse = await response.json();
      
      if (data.status === "success") {
        setTrendingProducts(data.data);
      } else {
        throw new Error("API returned unsuccessful status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trending products");
      console.error("Error fetching trending products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalProducts = async () => {
    try {
      setLoadingLocal(true);
      const response = await fetch("https://api.wanslu.shop/api/home/trending?local=1", {
        method: "GET",
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TrendingApiResponse = await response.json();
      
      if (data.status === "success") {
        setLocalProducts(data.data || []);
      } else {
        throw new Error("API returned unsuccessful status");
      }
    } catch (err) {
      console.error("Error fetching local products:", err);
      setLocalProducts([]);
    } finally {
      setLoadingLocal(false);
    }
  };

  const fetchChineseProducts = async () => {
    try {
      setLoadingChinese(true);
      const response = await fetch("https://api.wanslu.shop/api/home/trending?chinese=1", {
        method: "GET",
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TrendingApiResponse = await response.json();
      
      if (data.status === "success") {
        setChineseProducts(data.data || []);
      } else {
        throw new Error("API returned unsuccessful status");
      }
    } catch (err) {
      console.error("Error fetching Chinese products:", err);
      setChineseProducts([]);
    } finally {
      setLoadingChinese(false);
    }
  };

  const handleProductPress = (product: TrendingProduct) => {
    // Navigate to product detail page
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



  // Render trending product item
  const renderTrendingItem = ({ item }: { item: TrendingProduct }) => {
    const isInWishlist = wishlistItems.has(item.pid);
    const productId = item.pid;
    const originalTitle = item.title;
    const displayTitle = language !== 'en' && translatedTrendingTitles.has(productId)
      ? translatedTrendingTitles.get(productId)!
      : originalTitle;
    const isTranslating = language !== 'en' && translatingTrendingProducts.has(productId);
    const titleOpacity = getTitleAnimation(productId, 'trending');
    
    return (
      <View style={styles.trendingItem}>
        <ProductCard
          product={{ ...item, title: displayTitle }}
          onPress={() => handleProductPress(item)}
          isInWishlist={isInWishlist}
          onWishlistToggle={handleWishlistToggle}
          titleOpacity={language !== 'en' ? titleOpacity : undefined}
          showTranslating={isTranslating}
        />
      </View>
    );
  };

  // Render local product item
  const renderLocalItem = ({ item, index }: { item: TrendingProduct; index: number }) => {
    const isInWishlist = wishlistItems.has(item.pid);
    const isLastItem = index === localProducts.length - 1;
    const isOddLastItem = localProducts.length % 2 === 1 && isLastItem;
    const productId = item.pid;
    const originalTitle = item.title;
    const displayTitle = language !== 'en' && translatedLocalTitles.has(productId)
      ? translatedLocalTitles.get(productId)!
      : originalTitle;
    const isTranslating = language !== 'en' && translatingLocalProducts.has(productId);
    const titleOpacity = getTitleAnimation(productId, 'local');
    
    return (
      <View style={[styles.trendingItem, isOddLastItem && styles.halfWidthItem]}>
        <ProductCard
          product={{ ...item, title: displayTitle }}
          onPress={() => handleProductPress(item)}
          isInWishlist={isInWishlist}
          onWishlistToggle={handleWishlistToggle}
          titleOpacity={language !== 'en' ? titleOpacity : undefined}
          showTranslating={isTranslating}
        />
      </View>
    );
  };

  // Render Chinese product item
  const renderChineseItem = ({ item, index }: { item: TrendingProduct; index: number }) => {
    const isInWishlist = wishlistItems.has(item.pid);
    const isLastItem = index === chineseProducts.length - 1;
    const isOddLastItem = chineseProducts.length % 2 === 1 && isLastItem;
    const productId = item.pid;
    const originalTitle = item.title;
    const displayTitle = language !== 'en' && translatedChineseTitles.has(productId)
      ? translatedChineseTitles.get(productId)!
      : originalTitle;
    const isTranslating = language !== 'en' && translatingChineseProducts.has(productId);
    const titleOpacity = getTitleAnimation(productId, 'chinese');
    
    return (
      <View style={[styles.trendingItem, isOddLastItem && styles.halfWidthItem]}>
        <ProductCard
          product={{ ...item, title: displayTitle }}
          onPress={() => handleProductPress(item)}
          isInWishlist={isInWishlist}
          onWishlistToggle={handleWishlistToggle}
          titleOpacity={language !== 'en' ? titleOpacity : undefined}
          showTranslating={isTranslating}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E53E3E" />
      
      <Header cartCount={cartCount} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Carousel */}
        <HeroCarousel />
        
        {/* Hot Searches */}
        <HotSearches 
          wishlistItems={wishlistItems}
          onWishlistToggle={handleWishlistToggle}
        />

      

        {/* Trending Products */}
        <View style={styles.trendingContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.trendingTitle}>{t('home.trendingProducts')}</Text>
            {/* <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity> */}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>Loading</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchTrendingProducts}>
                <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={trendingProducts}
              renderItem={renderTrendingItem}
              keyExtractor={(item) => item.pid.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              numColumns={2}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Local Products */}
        <View style={styles.trendingContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.trendingTitle}>{t('home.localProducts')}</Text>
          </View>

          {loadingLocal ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>Loading</Text>
            </View>
          ) : (
            <FlatList
              data={localProducts}
              renderItem={renderLocalItem}
              keyExtractor={(item) => item.pid.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              numColumns={2}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Chinese International Products */}
        <View style={styles.trendingContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.trendingTitle}>Chinese International Products</Text>
          </View>

          {loadingChinese ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>Loading</Text>
            </View>
          ) : (
            <FlatList
              data={chineseProducts}
              renderItem={renderChineseItem}
              keyExtractor={(item) => item.pid.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              numColumns={2}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />
          )}
        </View>

  {/* Departments Grid */}
  <DepartmentsGrid />

{/* Featured Cards */}
<FeaturedCards />
        
      </ScrollView>
      
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
  scrollView: {
    flex: 1,
  },

  trendingContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  trendingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    margin: 0,
    gap: 16,
  },
  trendingItem: {
    flex: 1,
    margin: 0,
    maxWidth: '100%',
  },
  halfWidthItem: {
    flex: 0.5,
    maxWidth: '50%',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  liveChatButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  liveChatText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
