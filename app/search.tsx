import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import Navbar from './components/Navbar';
import { useAuth } from './context/AuthContext';
import { useCartCount } from './context/CartCountContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';
import { getApiHeaders } from './utils/api-helpers';
import { translateWithCache } from './utils/translation-cache';

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

interface SearchProduct {
  imageUrl: string;
  subject: string;
  subjectTrans: string;
  offerId: number;
  priceInfo: {
    price: string;
    consignPrice: string;
    originalPrice: string;
  };
  repurchaseRate: string;
  monthSold: number;
  tradeScore: string;
  isSelect: boolean;
  minOrderQuantity: number;
  searchSource?: string; // Add search source for badge
  stock?: number; // Add stock information
  translatedTitle?: string; // Translated title
  isTranslating?: boolean; // Whether translation is in progress
}

// New interface for retail API response
interface RetailProduct {
  main_image_url: string;
  multi_language_info: {
    title: string;
  };
  item_id: number;
  price: number;
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

interface SearchApiResponse {
  result: {
    success: boolean;
    code: string;
    result: {
      totalRecords: number;
      totalPage: number;
      pageSize: number;
      currentPage: number;
      data: SearchProduct[];
    };
  };
}

// New interface for retail API response
interface RetailApiResponse {
  data: {
    data: RetailProduct[];
  };
}

interface SearchScreenProps {
  showMenu?: boolean;
  onMenuClose?: () => void;
  onMenuPress?: () => void;
  searchQuery?: string;
  searchCategory?: string;
}

// Helper to normalize src/category
const normalizeSrc = (src: string) => {
  if (!src) return '1688';
  if (src.toLowerCase() === 'retail') return 'tb';
  if (src.toLowerCase() === 'wholesale') return '1688';
  return src.toLowerCase();
};

export default function SearchScreen({ 
  showMenu = false, 
  onMenuClose, 
  onMenuPress,
  searchQuery = '',
  searchCategory = '1688'
}: SearchScreenProps) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { q: urlQuery } = useLocalSearchParams<{ q: string }>();
  const { cartCount } = useCartCount();
  const { isAuthenticated, authToken } = useAuth();
  const { currentScreen, setCurrentScreen, showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const { convertPrice, loading: currencyLoading, currencyData } = useCurrency();
  
  // Translation state
  const [translatingProducts, setTranslatingProducts] = useState<Set<number>>(new Set());
  const [translatedTitles, setTranslatedTitles] = useState<Map<number, string>>(new Map());
  const titleAnimations = useRef<Map<number, Animated.Value>>(new Map()).current;
  
  // Use URL query first, then props
  const initialSearchQuery = urlQuery || searchQuery;
  const initialSearchCategory = searchCategory;
  
  console.log('SearchScreen - URL query:', urlQuery);
  console.log('SearchScreen - Initial values:', { initialSearchQuery, initialSearchCategory });
  
  const [searchText, setSearchText] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialSearchCategory);
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Filter and sort states for 1688
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [certifiedFactory, setCertifiedFactory] = useState(false);
  
  // Dropdown states
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  
  // Loading states
  const [filterLoading, setFilterLoading] = useState(false);
  
  // Scroll animation state
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const categoryContainerAnimation = useRef(new Animated.Value(0)).current;
  
  // Scroll handler for category animation
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDirection = currentScrollY > lastScrollY;
    const scrollThreshold = 25; // Increased threshold
    
    // Only animate if we've scrolled past the threshold
    if (currentScrollY > scrollThreshold) {
      if (scrollDirection && !isScrollingDown) {
        // Scrolling down - hide containers
        setIsScrollingDown(true);
        Animated.timing(categoryContainerAnimation, {
          toValue: -66, // Increased to hide both containers
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else if (!scrollDirection && isScrollingDown) {
        // Scrolling up - show containers
        setIsScrollingDown(false);
        Animated.timing(categoryContainerAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } else if (currentScrollY <= scrollThreshold && isScrollingDown) {
      // Always show when near the top
      setIsScrollingDown(false);
      Animated.timing(categoryContainerAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    setLastScrollY(currentScrollY);
  };
  
  // Wishlist states
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Map<string, number>>(new Map());
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistFetched, setWishlistFetched] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [urlApplied, setUrlApplied] = useState(false);
  
  // Animation values for category transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Initialize animation for a product title
  const getTitleAnimation = (productId: number): Animated.Value => {
    if (!titleAnimations.has(productId)) {
      titleAnimations.set(productId, new Animated.Value(0.5)); // Start with reduced opacity
    }
    return titleAnimations.get(productId)!;
  };

  // Translate product titles when language is not English
  const translateProductTitles = async (products: SearchProduct[]) => {
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

  const [blockedSearch, setBlockedSearch] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");

  const categories = [
    { key: '1688', label: t('search.categories.wholesale') },
    { key: 'tb', label: t('search.categories.retail') },
    { key: 'chinese', label: t('search.categories.chinese') },
    { key: 'local', label: t('search.categories.local') }
  ];

  const sortOptions = [
    { value: '', label: t('search.sort.noSort') },
    { value: 'price_ASC', label: t('search.sort.priceLowHigh') },
    { value: 'price_DESC', label: t('search.sort.priceHighLow') },
    { value: 'monthSold_DESC', label: t('search.sort.mostSold') },
    { value: 'rePurchaseRate', label: t('search.sort.repurchaseRate') }
  ];

  // TB (Retail) sort options
  const tbSortOptions = [
    { value: 'default', label: t('search.sort.sortBy') },
    { value: 'SALE_QTY_DESC', label: t('search.sort.bestSelling') },
    { value: 'SALE_QTY_ASC', label: t('search.sort.leastToBestSelling') },
    { value: 'PRICE_ASC', label: t('search.sort.priceLowHigh') },
    { value: 'PRICE_DESC', label: t('search.sort.priceHighLow') },
  ];

  const ratingOptions = [
    { value: 'all', label: t('search.rating.all') },
    { value: '3', label: t('search.rating.threePlus') },
    { value: '4', label: t('search.rating.fourPlus') }
  ];

  useEffect(() => {
    if (initialSearchQuery) {
      performSearch(initialSearchQuery, initialSearchCategory, 1, true);
    }
  }, [initialSearchQuery, initialSearchCategory]);



  // Apply URL query once (or when input is empty) without overwriting user typing afterwards
  useEffect(() => {
    if (!urlQuery || !urlQuery.trim()) return;
    const isInputEmpty = !searchText || searchText.trim() === '';
    if (!urlApplied || isInputEmpty) {
      console.log('SearchScreen - Applying URL query to input');
      setSearchText(urlQuery);
      performSearch(urlQuery, selectedCategory, 1, true);
      setUrlApplied(true);
    }
  }, [urlQuery, selectedCategory, urlApplied]);

  // Fetch wishlist items on mount and when auth status changes
  useEffect(() => {
    console.log('SearchScreen useEffect - isAuthenticated:', isAuthenticated, 'wishlistFetched:', wishlistFetched);
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
      console.log('SearchScreen focused');
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
      
      const headers = await getApiHeaders({
        'Authorization': `Bearer ${authToken}`
      });
      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        const wishlistSet = new Set<string>();
        const wishlistMap = new Map<string, number>();
        
        data.data?.forEach((item: any) => {
          // Store the pid as string for comparison
          wishlistSet.add(item.pid);
          wishlistMap.set(item.pid, item.id);
          console.log('Wishlist item:', { pid: item.pid, id: item.id, title: item.title });
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
      const headers = await getApiHeaders({
        'Authorization': `Bearer ${authToken}`
      });
      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers
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

  const handleWishlistToggle = async (product: SearchProduct) => {
    if (!isAuthenticated) {
      Alert.alert(t('common.error'), t('home.pleaseLoginToUseWishlist'));
      return;
    }

    if (!authToken) return;

    try {
      // Use the same ID format as ProductCard component
      const productId = product.offerId.toString();
      
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
      
      console.log(`Toggling wishlist for product ${productId}, currently in wishlist:`, isInWishlist);

      if (isInWishlist) {
        // Remove from wishlist
        const wishlistId = wishlistIds.get(productId);
        if (!wishlistId) {
          Alert.alert(t('common.error'), t('home.wishlistItemNotFound'));
          return;
        }

        const headers = await getApiHeaders({
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        });
        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'DELETE',
          headers,
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
        const headers = await getApiHeaders({
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        });
        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            src: selectedCategory,
            pid: productId,
            img: product.imageUrl,
            title: product.subjectTrans || product.subject,
            price: product.priceInfo.price,
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

  const performSearchWithSort = async (
    query: string, 
    category: string, 
    sortValue: string,
    page: number = 1, 
    reset: boolean = false
  ) => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);

      let apiUrl = `https://api.wanslu.shop/api/search/${category}?q=${encodeURIComponent(query)}&page=${page}&language=en&limit=20&user=0`;
      
      // Add filter parameters and sorting
      if (category === '1688') {
        const params = new URLSearchParams();
        
        // Sort parameter - use the passed sortValue instead of state
        if (sortValue && sortValue.trim() !== '') {
          params.append('sort', sortValue);
        }
        
        // Rating filter
        if (ratingFilter && ratingFilter !== 'all') {
          params.append('rating', ratingFilter);
        }
        
        // Price range
        if (minPrice > 0) {
          params.append('min_price', minPrice.toString());
        }
        if (maxPrice < 1000) {
          params.append('max_price', maxPrice.toString());
        }
        
        // Certified factory
        if (certifiedFactory) {
          params.append('certifiedFactory', '1');
        }
        
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        
        // Debug: Log the API URL to see what parameters are being sent
        console.log('API URL with filters:', apiUrl);
      } else if (category === 'tb') {
        const params = new URLSearchParams();
        // TB sort mapping uses same key names provided from UI (default/SALE_QTY_DESC/SALE_QTY_ASC/PRICE_ASC/PRICE_DESC)
        if (sortValue && sortValue.trim() !== '' && sortValue !== 'default') {
          params.append('sort', sortValue);
        }
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        console.log('TB API URL with sort:', apiUrl);
      }
      
      const headers = await getApiHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
      });
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (category === 'tb') {
        // Handle retail API response
        const retailData: RetailApiResponse = data;
        const convertedResults: SearchProduct[] = retailData.data.data.map((item: RetailProduct) => ({
          imageUrl: item.main_image_url,
          subject: item.title,
          subjectTrans: item.multi_language_info?.title || item.title,
          offerId: item.item_id,
          priceInfo: {
            price: item.price.toFixed(2),
            consignPrice: item.price.toFixed(2),
            originalPrice: item.price.toFixed(2),
          },
          repurchaseRate: 'N/A',
          monthSold: 0,
          tradeScore: 'N/A',
          isSelect: false,
          minOrderQuantity: 1,
          searchSource: 'Retail',
          stock: item.inventory // Add stock information
        }));
        
        if (reset) {
          setSearchResults(convertedResults);
          // Translate titles if language is not English
          if (language !== 'en') {
            translateProductTitles(convertedResults);
          }
        } else {
          setSearchResults(prev => {
            const updated = [...prev, ...convertedResults];
            // Translate new products if language is not English
            if (language !== 'en') {
              translateProductTitles(convertedResults);
            }
            return updated;
          });
        }
        
        // For retail, we don't have pagination info, so we'll estimate
        setCurrentPage(page);
        setTotalPages(Math.ceil(convertedResults.length / 20));
        setTotalRecords(convertedResults.length);
        setHasMore(convertedResults.length === 20);
      } else {
        // Handle wholesale API response
        const wholesaleData: SearchApiResponse = data;
        
        if (wholesaleData.result.success) {
          const newResults = wholesaleData.result.result.data.map(item => ({
            ...item,
            searchSource: 'Wholesale'
          }));
          
          if (reset) {
            setSearchResults(newResults);
            // Translate titles if language is not English
            if (language !== 'en') {
              translateProductTitles(newResults);
            }
          } else {
            setSearchResults(prev => {
              const updated = [...prev, ...newResults];
              // Translate new products if language is not English
              if (language !== 'en') {
                translateProductTitles(newResults);
              }
              return updated;
            });
          }
          
          setCurrentPage(wholesaleData.result.result.currentPage);
          setTotalPages(wholesaleData.result.result.totalPage);
          setTotalRecords(wholesaleData.result.result.totalRecords);
          setHasMore(wholesaleData.result.result.currentPage < wholesaleData.result.result.totalPage);
        } else {
          throw new Error('Search failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  const performSearchWithRating = async (
    query: string, 
    category: string, 
    ratingValue: string,
    page: number = 1, 
    reset: boolean = false
  ) => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);

      let apiUrl = `https://api.wanslu.shop/api/search/${category}?q=${encodeURIComponent(query)}&page=${page}&language=en&limit=20&user=0`;
      
      // Add filter parameters and sorting
      if (category === '1688') {
        const params = new URLSearchParams();
        
        // Sort parameter
        if (sortBy && sortBy.trim() !== '') {
          params.append('sort', sortBy);
        }
        
        // Rating filter - use the passed ratingValue instead of state
        if (ratingValue && ratingValue !== 'all') {
          params.append('rating', ratingValue);
        }
        
        // Price range
        if (minPrice > 0) {
          params.append('min_price', minPrice.toString());
        }
        if (maxPrice < 1000) {
          params.append('max_price', maxPrice.toString());
        }
        
        // Certified factory
        if (certifiedFactory) {
          params.append('certifiedFactory', '1');
        }
        
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        
        // Debug: Log the API URL to see what parameters are being sent
        console.log('API URL with filters:', apiUrl);
      } else if (category === 'tb') {
        const params = new URLSearchParams();
        if (sortBy && sortBy.trim() !== '') {
          params.append('sort', sortBy);
        }
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        console.log('TB API URL with sort:', apiUrl);
      }
      
      const headers = await getApiHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
      });
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (category === 'tb') {
        // Handle retail API response
        const retailData: RetailApiResponse = data;
        const convertedResults: SearchProduct[] = retailData.data.data.map((item: RetailProduct) => ({
          imageUrl: item.main_image_url,
          subject: item.title,
          subjectTrans: item.multi_language_info?.title || item.title,
          offerId: item.item_id,
          priceInfo: {
            price: item.price.toFixed(2),
            consignPrice: item.price.toFixed(2),
            originalPrice: item.price.toFixed(2),
          },
          repurchaseRate: 'N/A',
          monthSold: 0,
          tradeScore: 'N/A',
          isSelect: false,
          minOrderQuantity: 1,
          searchSource: 'Retail',
          stock: item.inventory // Add stock information
        }));
        
        if (reset) {
          setSearchResults(convertedResults);
          // Translate titles if language is not English
          if (language !== 'en') {
            translateProductTitles(convertedResults);
          }
        } else {
          setSearchResults(prev => {
            const updated = [...prev, ...convertedResults];
            // Translate new products if language is not English
            if (language !== 'en') {
              translateProductTitles(convertedResults);
            }
            return updated;
          });
        }
        
        // For retail, we don't have pagination info, so we'll estimate
        setCurrentPage(page);
        setTotalPages(Math.ceil(convertedResults.length / 20));
        setTotalRecords(convertedResults.length);
        setHasMore(convertedResults.length === 20);
      } else {
        // Handle wholesale API response
        const wholesaleData: SearchApiResponse = data;
        
        if (wholesaleData.result.success) {
          const newResults = wholesaleData.result.result.data.map(item => ({
            ...item,
            searchSource: 'Wholesale'
          }));
          
          if (reset) {
            setSearchResults(newResults);
            // Translate titles if language is not English
            if (language !== 'en') {
              translateProductTitles(newResults);
            }
          } else {
            setSearchResults(prev => {
              const updated = [...prev, ...newResults];
              // Translate new products if language is not English
              if (language !== 'en') {
                translateProductTitles(newResults);
              }
              return updated;
            });
          }
          
          setCurrentPage(wholesaleData.result.result.currentPage);
          setTotalPages(wholesaleData.result.result.totalPage);
          setTotalRecords(wholesaleData.result.result.totalRecords);
          setHasMore(wholesaleData.result.result.currentPage < wholesaleData.result.result.totalPage);
        } else {
          throw new Error('Search failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Chinese Search Logic ---
  const performChineseSearch = async (
    query: string,
    page: number = 1,
    sortValue: string = '',
    minPrice: number = 0,
    maxPrice: number = 1000,
    reset: boolean = false
  ) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setBlockedSearch(false);
    setBlockedMessage("");
    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        user: "0",
        country: "CN",
      });
      if (sortValue && sortValue !== 'default') params.append('sort', sortValue);
      if (minPrice > 0) params.append('min_price', minPrice.toString());
      if (maxPrice < 1000) params.append('max_price', maxPrice.toString());
      // Optionally, add user id if available (see web logic)
      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/search/local?${params}`, {
        headers
      });
      const data = await response.json();
      if (data.blocked === true && data.status === "error") {
        setBlockedSearch(true);
        setBlockedMessage(data.message || "");
        setSearchResults([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasMore(false);
        setLoading(false);
        return;
      } else {
        setBlockedSearch(false);
        setBlockedMessage("");
      }
      if (data.data) {
        // Convert local API data to SearchProduct[]
        const convertedResults: SearchProduct[] = data.data.map((item: any) => ({
          imageUrl: item.images?.[0] || '',
          subject: item.title,
          subjectTrans: item.title,
          offerId: item.id,
          priceInfo: {
            price: item.variants?.[0]?.price?.toString() || '0',
            consignPrice: item.variants?.[0]?.price?.toString() || '0',
            originalPrice: item.variants?.[0]?.price?.toString() || '0',
          },
          repurchaseRate: 'N/A',
          monthSold: 0,
          tradeScore: 'N/A',
          isSelect: false,
          minOrderQuantity: 1,
          searchSource: 'Chinese',
          stock: item.stock || 0,
        }));
        if (reset) {
          setSearchResults(convertedResults);
          // Translate titles if language is not English
          if (language !== 'en') {
            translateProductTitles(convertedResults);
          }
        } else {
          setSearchResults(prev => {
            const updated = [...prev, ...convertedResults];
            // Translate new products if language is not English
            if (language !== 'en') {
              translateProductTitles(convertedResults);
            }
            return updated;
          });
        }
        setCurrentPage(page);
        setTotalPages(data.last_page || 1);
        setTotalRecords(data.total || 0);
        setHasMore(page < (data.last_page || 1));
      } else {
        setSearchResults([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      setSearchResults([]);
      setTotalPages(1);
      setTotalRecords(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // --- Local Search Logic ---
  const performLocalSearch = async (
    query: string,
    page: number = 1,
    sortValue: string = '',
    minPrice: number = 0,
    maxPrice: number = 1000,
    reset: boolean = false
  ) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setBlockedSearch(false);
    setBlockedMessage("");
    try {
      // Get geo-data from AsyncStorage
      let countryCode = 'US';
      try {
        const geoDataStr = await AsyncStorage.getItem('geo-data');
        if (geoDataStr) {
          const geoData = JSON.parse(geoDataStr);
          if (geoData.countryCode) countryCode = geoData.countryCode;
        }
      } catch (e) {
        // fallback to US
      }
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        user: "0",
        country: countryCode,
      });
      if (sortValue && sortValue !== 'default') params.append('sort', sortValue);
      if (minPrice > 0) params.append('min_price', minPrice.toString());
      if (maxPrice < 1000) params.append('max_price', maxPrice.toString());
      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/search/local?${params}`, {
        headers
      });
      const data = await response.json();
      if (data && data.error === 'Invalid country or service not available') {
        setBlockedSearch(true);
        setBlockedMessage('Service not available for your country.');
        setSearchResults([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasMore(false);
        setLoading(false);
        return;
      }
      if (data.blocked === true && data.status === "error") {
        setBlockedSearch(true);
        setBlockedMessage(data.message || "");
        setSearchResults([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasMore(false);
        setLoading(false);
        return;
      } else {
        setBlockedSearch(false);
        setBlockedMessage("");
      }
      if (data.data) {
        // Convert local API data to SearchProduct[]
        const convertedResults: SearchProduct[] = data.data.map((item: any) => ({
          imageUrl: item.images?.[0] || '',
          subject: item.title,
          subjectTrans: item.title,
          offerId: item.id,
          priceInfo: {
            price: item.variants?.[0]?.price?.toString() || '0',
            consignPrice: item.variants?.[0]?.price?.toString() || '0',
            originalPrice: item.variants?.[0]?.price?.toString() || '0',
          },
          repurchaseRate: 'N/A',
          monthSold: 0,
          tradeScore: 'N/A',
          isSelect: false,
          minOrderQuantity: 1,
          searchSource: 'Local',
          stock: item.stock || 0,
        }));
        if (reset) {
          setSearchResults(convertedResults);
          // Translate titles if language is not English
          if (language !== 'en') {
            translateProductTitles(convertedResults);
          }
        } else {
          setSearchResults(prev => {
            const updated = [...prev, ...convertedResults];
            // Translate new products if language is not English
            if (language !== 'en') {
              translateProductTitles(convertedResults);
            }
            return updated;
          });
        }
        setCurrentPage(page);
        setTotalPages(data.last_page || 1);
        setTotalRecords(data.total || 0);
        setHasMore(page < (data.last_page || 1));
      } else {
        setSearchResults([]);
        setTotalPages(1);
        setTotalRecords(0);
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      setSearchResults([]);
      setTotalPages(1);
      setTotalRecords(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (
    query: string, 
    category: string, 
    page: number = 1, 
    reset: boolean = false
  ) => {
    if (category === 'chinese') {
      await performChineseSearch(query, page, sortBy, minPrice, maxPrice, reset);
      return;
    }
    if (category === 'local') {
      await performLocalSearch(query, page, sortBy, minPrice, maxPrice, reset);
      return;
    }
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);

      let apiUrl = `https://api.wanslu.shop/api/search/${category}?q=${encodeURIComponent(query)}&page=${page}&language=en&limit=20&user=0`;
      
      // Add filter parameters for 1688 category
      if (category === '1688') {
        const params = new URLSearchParams();
        
        // Sort parameter - always include if not empty
        if (sortBy && sortBy.trim() !== '') {
          params.append('sort', sortBy);
        }
        
        // Rating filter
        if (ratingFilter && ratingFilter !== 'all') {
          params.append('rating', ratingFilter);
        }
        
        // Price range
        if (minPrice > 0) {
          params.append('min_price', minPrice.toString());
        }
        if (maxPrice < 1000) {
          params.append('max_price', maxPrice.toString());
        }
        
        // Certified factory
        if (certifiedFactory) {
          params.append('certifiedFactory', '1');
        }
        
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        
        // Debug: Log the API URL to see what parameters are being sent
        console.log('API URL with filters:', apiUrl);
      } else if (category === 'tb') {
        const params = new URLSearchParams();
        if (sortBy && sortBy.trim() !== '' && sortBy !== 'default') {
          params.append('sort', sortBy);
        }
        const filterParams = params.toString();
        if (filterParams) {
          apiUrl += `&${filterParams}`;
        }
        console.log('TB API URL with sort:', apiUrl);
      }
      
      const headers = await getApiHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
      });
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (category === 'tb') {
        // Handle retail API response
        const retailData: RetailApiResponse = data;
        const convertedResults: SearchProduct[] = retailData.data.data.map((item: RetailProduct) => ({
          imageUrl: item.main_image_url,
          subject: item.title,
          subjectTrans: item.multi_language_info?.title || item.title,
          offerId: item.item_id,
          priceInfo: {
            price: item.price.toFixed(2),
            consignPrice: item.price.toFixed(2),
            originalPrice: item.price.toFixed(2),
          },
          repurchaseRate: 'N/A',
          monthSold: 0,
          tradeScore: 'N/A',
          isSelect: false,
          minOrderQuantity: 1,
          searchSource: 'Retail',
          stock: item.inventory // Add stock information
        }));
        
        if (reset) {
          setSearchResults(convertedResults);
          // Translate titles if language is not English
          if (language !== 'en') {
            translateProductTitles(convertedResults);
          }
        } else {
          setSearchResults(prev => {
            const updated = [...prev, ...convertedResults];
            // Translate new products if language is not English
            if (language !== 'en') {
              translateProductTitles(convertedResults);
            }
            return updated;
          });
        }
        
        // For retail, we don't have pagination info, so we'll estimate
        setCurrentPage(page);
        setTotalPages(Math.ceil(convertedResults.length / 20));
        setTotalRecords(convertedResults.length);
        setHasMore(convertedResults.length === 20);
      } else {
        // Handle wholesale API response
        const wholesaleData: SearchApiResponse = data;
        
        if (wholesaleData.result.success) {
          const newResults = wholesaleData.result.result.data.map(item => ({
            ...item,
            searchSource: 'Wholesale'
          }));
          
          if (reset) {
            setSearchResults(newResults);
            // Translate titles if language is not English
            if (language !== 'en') {
              translateProductTitles(newResults);
            }
          } else {
            setSearchResults(prev => {
              const updated = [...prev, ...newResults];
              // Translate new products if language is not English
              if (language !== 'en') {
                translateProductTitles(newResults);
              }
              return updated;
            });
          }
          
          setCurrentPage(wholesaleData.result.result.currentPage);
          setTotalPages(wholesaleData.result.result.totalPage);
          setTotalRecords(wholesaleData.result.result.totalRecords);
          setHasMore(wholesaleData.result.result.currentPage < wholesaleData.result.result.totalPage);
        } else {
          throw new Error('Search failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  // Translate existing products when language changes (only when results exist)
  useEffect(() => {
    if (searchResults.length > 0) {
      if (language !== 'en') {
        translateProductTitles(searchResults);
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

  const handleSearch = () => {
    if (searchText.trim()) {
      performSearch(searchText, selectedCategory, 1, true);
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
  };

  const loadMore = () => {
    if (!loading && hasMore && searchText.trim()) {
      if (selectedCategory === 'chinese') {
        performChineseSearch(searchText, currentPage + 1, sortBy, minPrice, maxPrice, false);
      } else if (selectedCategory === 'local') {
        performLocalSearch(searchText, currentPage + 1, sortBy, minPrice, maxPrice, false);
      } else {
        performSearch(searchText, selectedCategory, currentPage + 1, false);
      }
    }
  };

  const handleCategoryChange = (categoryKey: string) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    setSelectedCategory(categoryKey);
    if (searchText.trim()) {
      if (categoryKey === 'chinese') {
        performChineseSearch(searchText, 1, sortBy, minPrice, maxPrice, true);
      } else if (categoryKey === 'local') {
        performLocalSearch(searchText, 1, sortBy, minPrice, maxPrice, true);
      } else {
        performSearch(searchText, categoryKey, 1, true);
      }
    }
  };

  const handleSortChange = async (sortValue: string) => {
    setSortBy(sortValue);
    setShowSortDropdown(false);
    if (searchText.trim()) {
      setFilterLoading(true);
      if (selectedCategory === 'chinese') {
        await performChineseSearch(searchText, 1, sortValue, minPrice, maxPrice, true);
      } else if (selectedCategory === 'local') {
        await performLocalSearch(searchText, 1, sortValue, minPrice, maxPrice, true);
      } else {
        await performSearchWithSort(searchText, selectedCategory, sortValue, 1, true);
      }
      setFilterLoading(false);
    }
  };

  const handleRatingChange = async (ratingValue: string) => {
    setRatingFilter(ratingValue);
    setShowRatingDropdown(false);
    if (searchText.trim()) {
      setFilterLoading(true);
      // Pass the rating value directly to avoid state timing issues
      await performSearchWithRating(searchText, selectedCategory, ratingValue, 1, true);
      setFilterLoading(false);
    }
  };

  const handleProductPress = (product: SearchProduct) => {
    // Determine src for detail page
    const src = normalizeSrc(product.searchSource || selectedCategory);
    const productData = {
      id: product.offerId.toString(),
      title: product.subjectTrans || product.subject,
      price: product.priceInfo.price,
      originalPrice: product.priceInfo.consignPrice,
      images: [{ imageUrl: product.imageUrl }],
      description: product.subjectTrans || product.subject,
      minOrder: product.minOrderQuantity,
      stock: product.stock,
      source: src,
    };

    router.push({
      pathname: '/product-detail',
      params: {
        id: product.offerId.toString(),
        src, // pass normalized src
        productData: JSON.stringify(productData)
      }
    });
  };

  const renderProduct = ({ item }: { item: SearchProduct }) => {
    const productId = item.offerId.toString();
    const numericProductId = item.offerId;
    const src = normalizeSrc(item.searchSource || selectedCategory);
    // Check if item is in wishlist - the wishlist API returns pid as string
    const isInWishlist = wishlistItems.has(productId);
    
    const discountPercentage = Math.round((Number(item.priceInfo.consignPrice) - Number(item.priceInfo.price))/Number(item.priceInfo.consignPrice)*100);
    
    // Get translated title or use original
    const displayTitle = language !== 'en' && translatedTitles.has(numericProductId)
      ? translatedTitles.get(numericProductId)!
      : (item.subjectTrans || item.subject);
    
    // Check if this product is being translated
    const isTranslating = language !== 'en' && translatingProducts.has(numericProductId);
    const titleOpacity = getTitleAnimation(numericProductId);
    
    return (
      <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
        {/* Search Source Badge */}
        <View style={styles.searchSourceBadge}>
          <Text style={styles.searchSourceText}>{src === 'tb' ? 'Retail' : src === '1688' ? 'Wholesale' : src.charAt(0).toUpperCase() + src.slice(1)}</Text>
        </View>
        
        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercentage}%</Text>
          </View>
        )}
        
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
              name={isInWishlist ? "heart" : "heart-outline"} 
              size={20} 
              color={isInWishlist ? "#E53E3E" : "#666"} 
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
          {item.priceInfo.price && item.priceInfo.price !== item.priceInfo.consignPrice ? (
  <Text style={styles.price}>
    {convertPrice(item.priceInfo.price)}
  </Text>
) : (
  <Text style={styles.price}>
    {convertPrice(item.priceInfo.consignPrice)}
  </Text>
)}

            {item.priceInfo.consignPrice && item.priceInfo.price !== item.priceInfo.consignPrice &&  (
              <Text style={styles.promotionPrice}>{convertPrice(item.priceInfo.consignPrice)}</Text>
            )}
          </View>
          
          {/* Show product stats only if they exist and are not N/A */}
          {(item.monthSold > 0 || item.tradeScore !== 'N/A' || item.repurchaseRate !== 'N/A' || item.stock) && (
            <View style={styles.productStats}>
              {item.monthSold > 0 && (
                <Text style={styles.statText}>{t('search.stats.sold')}: {item.monthSold}</Text>
              )}
              {item.tradeScore !== 'N/A' && (
                <Text style={styles.statText}>{t('search.stats.rating')}: {item.tradeScore}</Text>
              )}
              {item.stock && (
                <Text style={styles.statText}>{t('search.stats.stock')}: {item.stock}</Text>
              )}
            </View>
          )}
          
          {/* Show repurchase rate only if it exists and is not N/A */}
          {item.repurchaseRate !== 'N/A' && (
            <View style={styles.badgeContainer}>
              {item.isSelect && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('search.badge.select')}</Text>
                </View>
              )}
              <View style={styles.repurchaseBadge}>
                <Text style={styles.repurchaseText}>{t('search.stats.repurchase')} : {item.repurchaseRate}</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#E53E3E" />
        <Text style={styles.loadingText}>{t('search.loadingMore')}</Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    blockedSearch ? (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle" size={64} color="#ed2027" />
        <Text style={styles.emptyTitle}>{blockedMessage || t('search.oopsNoRelated')}</Text>
        <Text style={styles.emptySubtitle}>{t('search.tryDifferentKeyword')}</Text>
        {blockedMessage ? <Text style={styles.emptySubtitle}>{t('search.reason')}: {blockedMessage}</Text> : null}
      </View>
    ) : (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>{t('search.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('search.emptySubtitle')}
        </Text>
      </View>
    )
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} searchText={searchText} onSearchTextChange={setSearchText} />
      
      <View style={styles.container}>
        {(showSortDropdown || showRatingDropdown) && (
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1} 
            onPress={() => {
              setShowSortDropdown(false);
              setShowRatingDropdown(false);
            }}
          />
        )}
      
             {/* Animated Container for Category and Filters */}
       <Animated.View style={[
         styles.animatedContainer,
         {
           transform: [{ translateY: categoryContainerAnimation }]
         }
       ]}>
         {/* Category Pills */}
         <View style={styles.categoryContainer}>
           <ScrollView 
             horizontal 
             showsHorizontalScrollIndicator={false} 
             contentContainerStyle={styles.categoryScrollContainer}
           >
             {categories.map((category, index) => (
               <TouchableOpacity
                 key={category.key}
                 style={[
                   styles.categoryPill,
                   index === 0 && styles.firstCategoryPill,
                   index === categories.length - 1 && styles.lastCategoryPill,
                   selectedCategory === category.key && styles.selectedCategoryPill
                 ]}
                 onPress={() => handleCategoryChange(category.key)}
                 activeOpacity={0.7}
               >
                 <Text style={[
                   styles.categoryPillText,
                   selectedCategory === category.key && styles.selectedCategoryPillText
                 ]}>
                   {category.label}
                 </Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>

         {/* Sort and Filter Section - 1688 has Filters+Sort; TB has Sort only */}
         {(selectedCategory === '1688' || selectedCategory === 'tb') && (
           <View style={styles.filterSection}>
           <View style={styles.filterRow}>
            {selectedCategory === '1688' && (
              <TouchableOpacity 
                style={styles.filterButton}
                onPress={() => setShowFilters(true)}
              >
                <Ionicons name="filter" size={16} color="white" />
                <Text style={styles.filterButtonText}>{t('search.filters')}</Text>
              </TouchableOpacity>
            )}
             
                           <View style={styles.sortContainer}>
                                 <View style={styles.dropdownContainer}>
                   <TouchableOpacity 
                     style={[styles.sortDropdown, filterLoading && styles.dropdownDisabled]}
                     onPress={() => !filterLoading && setShowSortDropdown(!showSortDropdown)}
                     disabled={filterLoading}
                   >
                     {filterLoading ? (
                       <ActivityIndicator size="small" color="#666" />
                     ) : (
                       <>
                         <Text style={styles.sortText}>
                           {(selectedCategory === 'tb' ? tbSortOptions : sortOptions).find(opt => opt.value === sortBy)?.label || t('search.sort.sortBy')}
                         </Text>
                         <Ionicons 
                           name={showSortDropdown ? "chevron-up" : "chevron-down"} 
                           size={16} 
                           color="#666" 
                         />
                       </>
                     )}
                   </TouchableOpacity>
                  
                  {showSortDropdown && (
                    <View style={styles.dropdownMenu}>
                      {(selectedCategory === 'tb' ? tbSortOptions : sortOptions).map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.dropdownItem,
                            sortBy === option.value && styles.selectedDropdownItem
                          ]}
                          onPress={() => handleSortChange(option.value)}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            sortBy === option.value && styles.selectedDropdownItemText
                          ]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                
               {selectedCategory === '1688' && (
                 <View style={styles.dropdownContainer}>
                   <TouchableOpacity 
                     style={[styles.sortDropdown, filterLoading && styles.dropdownDisabled]}
                     onPress={() => !filterLoading && setShowRatingDropdown(!showRatingDropdown)}
                     disabled={filterLoading}
                   >
                     {filterLoading ? (
                       <ActivityIndicator size="small" color="#666" />
                     ) : (
                       <>
                         <Text style={styles.sortText}>
                           {ratingOptions.find(opt => opt.value === ratingFilter)?.label || t('search.rating.all')}
                         </Text>
                         <Ionicons 
                           name={showRatingDropdown ? "chevron-up" : "chevron-down"} 
                           size={16} 
                           color="#666" 
                         />
                       </>
                     )}
                   </TouchableOpacity>
                  
                  {showRatingDropdown && (
                    <View style={styles.dropdownMenu}>
                      {ratingOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.dropdownItem,
                            ratingFilter === option.value && styles.selectedDropdownItem
                          ]}
                          onPress={() => handleRatingChange(option.value)}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            ratingFilter === option.value && styles.selectedDropdownItemText
                          ]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
               )}
              </View>
           </View>
         </View>
       )}
       </Animated.View>

      {/* Results Info */}
      {/* {searchResults.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            {totalRecords} results found
          </Text>
          <Text style={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>
      )} */}

             {/* Search Results */}
       <Animated.View style={{ 
         flex: 1, 
         opacity: fadeAnim, 
         transform: [{ scale: scaleAnim }] 
       }}>
         {error ? (
           <View style={styles.errorContainer}>
             <Text style={styles.errorText}>{error}</Text>
             <TouchableOpacity style={styles.retryButton} onPress={() => handleSearch()}>
               <Text style={styles.retryButtonText}>Retry</Text>
             </TouchableOpacity>
           </View>
         ) : (
           <View style={styles.resultsContainer}>
             <FlatList
               data={searchResults}
               renderItem={renderProduct}
               keyExtractor={(item, index) => `${item.offerId}-${index}`}
               numColumns={2}
               columnWrapperStyle={styles.productRow}
               contentContainerStyle={styles.productList}
               onEndReached={loadMore}
               onEndReachedThreshold={0.1}
               ListFooterComponent={renderFooter}
               ListEmptyComponent={!loading ? renderEmptyState : null}
               showsVerticalScrollIndicator={false}
               onScroll={handleScroll}
               scrollEventThrottle={16}
             />
             
             {/* Filter Loading Overlay */}
             {filterLoading && (
               <View style={styles.filterLoadingOverlay}>
                 <View style={styles.filterLoadingContent}>
                   <ActivityIndicator size="large" color="#ed2027" />
                   <Text style={styles.filterLoadingText}>{t('search.modal.applying')}</Text>
                 </View>
               </View>
             )}
           </View>
         )}
       </Animated.View>

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
                        <View style={[styles.sliderFill, { width: `${(maxPrice / 1000) * 100}%` }]} />
                        <TouchableOpacity
                          style={[
                            styles.sliderThumb,
                            { left: `${(maxPrice / 1000) * 100}%` }
                          ]}
                          onPressIn={() => {}} // Placeholder for slider interaction
                        />
                      </View>
                    </View>
                    <Text style={styles.priceText}>$1000</Text>
                  </View>
                  <Text style={styles.priceRangeText}>
                    ${minPrice} - ${maxPrice}
                  </Text>
                  
                  {/* Price Range Buttons */}
                  <View style={styles.priceButtonsContainer}>
                    <TouchableOpacity
                      style={styles.priceButton}
                      onPress={() => {
                        setMinPrice(0);
                        setMaxPrice(100);
                      }}
                    >
                      <Text style={styles.priceButtonText}>$0 - $100</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.priceButton}
                      onPress={() => {
                        setMinPrice(100);
                        setMaxPrice(500);
                      }}
                    >
                      <Text style={styles.priceButtonText}>$100 - $500</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.priceButton}
                      onPress={() => {
                        setMinPrice(500);
                        setMaxPrice(1000);
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
                     value={certifiedFactory}
                     onValueChange={setCertifiedFactory}
                     trackColor={{ false: '#ddd', true: '#ed2027' }}
                     thumbColor={certifiedFactory ? '#fff' : '#f4f3f4'}
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
                    if (searchText.trim()) {
                      setFilterLoading(true);
                      if (selectedCategory === 'chinese') {
                        await performChineseSearch(searchText, 1, sortBy, minPrice, maxPrice, true);
                      } else if (selectedCategory === 'local') {
                        await performLocalSearch(searchText, 1, sortBy, minPrice, maxPrice, true);
                      } else {
                        await performSearch(searchText, selectedCategory, 1, true);
                      }
                      setFilterLoading(false);
                    }
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
        
                 {/* Navbar */}
         <Navbar 
           activeTab='search' 
           onTabPress={(tab) => {
             if (tab === 'home') {
               setCurrentScreen('home');
               router.push('/');
             } else if (tab === 'orders') {
               setCurrentScreen('orders');
               router.push('/orders');
             } else if (tab === 'wishlist') {
               setCurrentScreen('wishlist');
               router.push('/wishlist');
             } else if (tab === 'account') {
               setCurrentScreen('account');
               router.push('/account');
             }
           }} 
         />
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
  animatedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  categoryContainer: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  
  filterSection: {
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
    backgroundColor: '#ed2027',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  filterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortText: {
    fontSize: 14,
    color: '#333',
    marginRight: 6,
  },
  
  dropdownContainer: {
    position: 'relative',
    zIndex: 2000,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 12,
    zIndex: 9999,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedDropdownItem: {
    backgroundColor: '#f8f8f8',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  selectedDropdownItemText: {
    color: '#ed2027',
    fontWeight: '600',
  },
  
  dropdownDisabled: {
    opacity: 0.6,
  },
  
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  pageInfo: {
    fontSize: 12,
    color: '#999',
  },
  productList: {
    paddingHorizontal: 16,
    paddingTop: 135,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    lineHeight: 16,
  },
  translatingText: {
    fontSize: 10,
    color: '#4CAF50',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  promotionPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 4,
  },
  productStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statText: {
    fontSize: 10,
    color: '#666',
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  repurchaseBadge: {
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
  searchSourceBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#ed2027',
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
  discountBadge: {
    position: 'absolute',
    bottom: '50%',
    right: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  discountText: {
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
    zIndex: 2,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
    maxHeight: '80%',
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
  filterGroup: {
    marginBottom: 24,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    color: '#666',
    minWidth: 40,
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
  priceRangeText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  applyButton: {
    backgroundColor: '#ed2027',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    flex: 1,
    position: 'relative',
  },
  filterLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  filterLoadingContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
  },
  filterLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#ed2027',
    borderRadius: 10,
    top: -8,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  priceButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  priceButton: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  priceButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
});
