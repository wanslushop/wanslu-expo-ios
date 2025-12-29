import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { translateWithCache } from '../utils/translation-cache';
import ProductCard, { TrendingProduct } from './ProductCard';

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

  interface HotSearchesProps {
  wishlistItems: Set<string>;
  onWishlistToggle: (product: TrendingProduct) => void;
}

// Remove the hardcoded hotKeywords
// const hotKeywords = ["Shirt", "toys", "laptop", "phone"];

export default function HotSearches({ wishlistItems, onWishlistToggle }: HotSearchesProps) {
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [hotTab, setHotTab] = useState<string>('');
  const [loadingKeywords, setLoadingKeywords] = useState(true);
  const [hotProducts, setHotProducts] = useState<Record<string, TrendingProduct[]>>({});
  const [loadingHot, setLoadingHot] = useState<Record<string, boolean>>({});
  const { isAuthenticated, authToken } = useAuth();
  const router = useRouter();
  const { t, language } = useI18n();
  
  // Translation state
  const [translatingHotProducts, setTranslatingHotProducts] = useState<Set<string>>(new Set());
  const [translatedHotTitles, setTranslatedHotTitles] = useState<Map<string, string>>(new Map());
  const hotTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  
  // Initialize animation for a product title
  const getTitleAnimation = (productId: string): Animated.Value => {
    if (!hotTitleAnimations.has(productId)) {
      hotTitleAnimations.set(productId, new Animated.Value(0.5));
    }
    return hotTitleAnimations.get(productId)!;
  };
  
  // Translate product titles
  const translateProductTitles = async (products: TrendingProduct[]) => {
    if (language === 'en') {
      setTranslatedHotTitles(new Map());
      setTranslatingHotProducts(new Set());
      return;
    }

    const targetLang = mapLanguageToTranslationCode(language);

    // Start pulse animation for all products and mark as translating
    products.forEach(product => {
      const productId = product.pid;
      
      setTranslatingHotProducts(prev => {
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
      const productId = product.pid;
      const originalTitle = product.title;
      
      try {
        const translated = await translateWithCache(originalTitle, targetLang);
        
        setTranslatedHotTitles(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, translated);
          return newMap;
        });
        
        setTranslatingHotProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        
        const animValue = getTitleAnimation(productId);
        animValue.stopAnimation(() => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      } catch (error) {
        console.error(`Failed to translate product ${productId}:`, error);
        setTranslatingHotProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        const animValue = getTitleAnimation(productId);
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

  // Fetch hot search keywords from API
  useEffect(() => {
    const fetchKeywords = async () => {
      setLoadingKeywords(true);
      try {
        // Get countryCode from geo-data stored in AsyncStorage
        let countryCode = 'CM'; // fallback default
        try {
          const geoDataStr = await AsyncStorage.getItem('geo-data');
          if (geoDataStr) {
            const geoData = JSON.parse(geoDataStr);
            if (geoData.countryCode) {
              countryCode = geoData.countryCode;
            }
          }
        } catch (e) {
          console.log('Failed to load geo-data, using fallback:', e);
        }

        const res = await fetch(`https://api.wanslu.shop/api/home/hot-searches?limit=10&country=${countryCode}`);
        const data = await res.json();
        setHotKeywords(data.data || []);
        if (data.data && data.data.length > 0) setHotTab(data.data[0]);
      } catch (e) {
        setHotKeywords([]);
      } finally {
        setLoadingKeywords(false);
      }
    };
    fetchKeywords();
  }, []);

  // Fetch products for the first tab after keywords are loaded
  useEffect(() => {
    if (hotTab && !hotProducts[hotTab]) {
      fetchHotProducts(hotTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotTab]);

  // Translate products when language changes or products are loaded
  useEffect(() => {
    if (hotTab && hotProducts[hotTab] && hotProducts[hotTab].length > 0) {
      translateProductTitles(hotProducts[hotTab]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, hotProducts, hotTab]);

  const fetchHotProducts = async (keyword: string) => {
    setLoadingHot(prev => ({ ...prev, [keyword]: true }));
    try {
      const params = new URLSearchParams({
        q: keyword,
        page: '1',
        language: 'en',
        limit: '8',
      });
      const res = await fetch(`https://api.wanslu.shop/api/search/1688?${params}`);
      const data = await res.json();
      // Extract products from the correct path in the API response
      const products = data.result?.result?.data || [];
      // Transform the API data to match our TrendingProduct interface
      const transformedProducts = products.map((product: any) => ({
        pid: product.offerId?.toString() || '',
        title: product.subjectTrans || product.subject || '',
        price: parseFloat(product.priceInfo?.price || '0'),
        img: product.imageUrl || '',
        monthSold: product.monthSold || 0,
        repurchaseRate: product.repurchaseRate || 0,
        src: '1688'
      }));
      // Filter out products with missing required properties
      const validProducts = transformedProducts.filter((product: any) =>
        product.pid && product.title && product.price > 0
      );
      setHotProducts(prev => ({
        ...prev,
        [keyword]: validProducts
      }));
    } catch (error) {
      setHotProducts(prev => ({ ...prev, [keyword]: [] }));
    } finally {
      setLoadingHot(prev => ({ ...prev, [keyword]: false }));
    }
  };

  const handleTabChange = (keyword: string) => {
    setHotTab(keyword);
    if (!hotProducts[keyword]) {
      fetchHotProducts(keyword);
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

  const renderProductItem = ({ item }: { item: TrendingProduct }) => {
    // Skip rendering if product is missing required properties
    if (!item || !item.pid || !item.title || !item.price) {
      return null;
    }
    const isInWishlist = wishlistItems.has(item.pid);
    const productId = item.pid;
    const originalTitle = item.title;
    const displayTitle = language !== 'en' && translatedHotTitles.has(productId)
      ? translatedHotTitles.get(productId)!
      : originalTitle;
    const isTranslating = language !== 'en' && translatingHotProducts.has(productId);
    const titleOpacity = getTitleAnimation(productId);
    
    return (
      <View style={styles.productItem}>
        <ProductCard
          product={{ ...item, title: displayTitle }}
          onPress={() => handleProductPress(item)}
          isInWishlist={isInWishlist}
          onWishlistToggle={onWishlistToggle}
          titleOpacity={language !== 'en' ? titleOpacity : undefined}
          showTranslating={isTranslating}
        />
      </View>
    );
  };

  if (loadingKeywords) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53E3E" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!hotKeywords.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.hotSearches')}</Text>
      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {hotKeywords.map((keyword, index) => (
          <View key={keyword} style={styles.tabWrapper}>
            <TouchableOpacity
              style={[
                styles.tab,
                hotTab === keyword && styles.activeTab
              ]}
              onPress={() => handleTabChange(keyword)}
            >
              <Text style={[
                styles.tabText,
                hotTab === keyword && styles.activeTabText
              ]}>
                {keyword}
              </Text>
            </TouchableOpacity>
            {/* Vertical Divider */}
            {index < hotKeywords.length - 1 && (
              <View style={styles.tabDivider} />
            )}
          </View>
        ))}
      </ScrollView>
      {/* Tab Content */}
      {loadingHot[hotTab] ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={hotProducts[hotTab] || []}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.pid.toString()}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={styles.productList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabsContainer: {
    marginBottom: 16,
    paddingBottom: 2
  },
  tabWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 6,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTab: {
    backgroundColor: '#FEE2E2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  activeTabText: {
    color: '#DC2626',
  },
  tabDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
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
  productList: {
    paddingBottom: 16,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productItem: {
    flex: 1,
    marginHorizontal: 4,
  },
});
