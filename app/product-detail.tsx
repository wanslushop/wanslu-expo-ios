import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Modal from 'react-native-modal';
import ProductCard from './components/ProductCard';
import { useAuth } from './context/AuthContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { useLangCurrency } from './context/LangCurrencyContext';
import { getApiHeaders } from './utils/api-helpers';
import { createShareMessage, generateProductShareData } from './utils/share-utils';
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

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated, authToken } = useAuth();
  const { currency } = useLangCurrency();
  const { convertPrice } = useCurrency();
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [isInWishlist, setIsInWishlist] = useState<boolean>(false);
  const [wishlistId, setWishlistId] = useState<number | null>(null);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [cartCount, setCartCount] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [relatedTbProducts, setRelatedTbProducts] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Map<string, number>>(new Map());
  const [wishlistFetched, setWishlistFetched] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistCheckLoading, setWishlistCheckLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [youMayAlsoLikeProducts, setYouMayAlsoLikeProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'vendor'>('description');
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const [vendorProductsLoading, setVendorProductsLoading] = useState(false);
  const [vendorProductsError, setVendorProductsError] = useState<string | null>(null);
  const [accordionStates, setAccordionStates] = useState({ return: false, delivery: false, sensitive: false });
  const [showAddToCartSheet, setShowAddToCartSheet] = useState(false);
  const [showImagePopup, setShowImagePopup] = useState(false);
  const [popupImageUri, setPopupImageUri] = useState<string>('');
  const [cartQuantity, setCartQuantity] = useState(1);
  
  // Translation state for product titles in sections
  const [translatingRelatedProducts, setTranslatingRelatedProducts] = useState<Set<string>>(new Set());
  const [translatedRelatedProductTitles, setTranslatedRelatedProductTitles] = useState<Map<string, string>>(new Map());
  const [translatingYouMayAlsoLike, setTranslatingYouMayAlsoLike] = useState<Set<string>>(new Set());
  const [translatedYouMayAlsoLikeTitles, setTranslatedYouMayAlsoLikeTitles] = useState<Map<string, string>>(new Map());
  const relatedProductTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  const youMayAlsoLikeTitleAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  
  // Translation state for main product title
  const [translatedMainProductTitle, setTranslatedMainProductTitle] = useState<string | null>(null);
  const [isTranslatingMainTitle, setIsTranslatingMainTitle] = useState(false);
  const mainProductTitleAnim = useRef(new Animated.Value(0.5)).current;
  
  // Translation state for specifications
  const [translatedSpecifications, setTranslatedSpecifications] = useState<Map<number, { attributeName: string; value: string }>>(new Map());
  const [translatingSpecifications, setTranslatingSpecifications] = useState<Set<number>>(new Set());
  const [isTranslatingSpecs, setIsTranslatingSpecs] = useState(false);
  const specificationAnimations = useRef<Map<number, Animated.Value>>(new Map()).current;
  
  // Initialize animation for a product title
  const getRelatedProductTitleAnimation = (productId: string): Animated.Value => {
    if (!relatedProductTitleAnimations.has(productId)) {
      relatedProductTitleAnimations.set(productId, new Animated.Value(0.5));
    }
    return relatedProductTitleAnimations.get(productId)!;
  };
  
  const getYouMayAlsoLikeTitleAnimation = (productId: string): Animated.Value => {
    if (!youMayAlsoLikeTitleAnimations.has(productId)) {
      youMayAlsoLikeTitleAnimations.set(productId, new Animated.Value(0.5));
    }
    return youMayAlsoLikeTitleAnimations.get(productId)!;
  };
  
  const getSpecificationAnimation = (index: number): Animated.Value => {
    if (!specificationAnimations.has(index)) {
      specificationAnimations.set(index, new Animated.Value(0.5));
    }
    return specificationAnimations.get(index)!;
  };
  // --- Add state for variant selection and quantity per variant ---
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [variantQuantities, setVariantQuantities] = useState<{ [key: number]: number }>({});
  const [showPreview, setShowPreview] = useState(false);
  // --- Variant modal state ---
  const [selectedFirstAttr, setSelectedFirstAttr] = useState<string | null>(null);
  const [quantityData, setQuantityData] = useState<{ [key: string]: { quantity: number, price: number, specId: string, imageUrl: string } }>({});
  // Add state for cart operations
  const [addingCart, setAddingCart] = useState(false);
  // --- Add state for product source (1688 or tb) ---
  const normalizeSrc = (src: string | undefined) => {
    if (!src) return '1688';
    if (src.toLowerCase() === 'retail') return 'tb';
    if (src.toLowerCase() === 'wholesale') return '1688';
    if (src.toLowerCase() === 'local') return 'local';
    if (src.toLowerCase() === 'chinese') return 'chinese';
    return src.toLowerCase();
  };
  const rawSource = (params.source as string) || (params.src as string) || undefined;
  const srcParam = normalizeSrc(rawSource);
  console.log('Debug - rawSource:', rawSource);
  console.log('Debug - srcParam:', srcParam);
  const [productSource, setProductSource] = useState<'1688' | 'tb' | 'local' | 'chinese'>(
    srcParam === 'tb' ? 'tb' :
    srcParam === 'local' ? 'local' :
    srcParam === 'chinese' ? 'chinese' :
    '1688'
  );

  // Extract product ID and src from params
  const productId = params.id as string;

  const [localChineseError, setLocalChineseError] = useState<string | null>(null);

  useEffect(() => {
    setProductSource(
      srcParam === 'tb' ? 'tb' :
      srcParam === 'local' ? 'local' :
      srcParam === 'chinese' ? 'chinese' :
      '1688'
    );
    fetchProduct();
  }, [productId, srcParam]);

  useEffect(() => {
    fetchCartCount();
  }, []);

  // Check wishlist status when product loads and auth status changes
  useEffect(() => {
    if (apiResponse?.product && isAuthenticated) {
      const productId = apiResponse.product.offerId?.toString();
      if (productId) {
        // Get the correct product ID based on source
        const correctProductId = productSource === 'tb' ? 
          apiResponse.product.item_id?.toString() : 
          productSource === 'local' || productSource === 'chinese' ?
          apiResponse.product.id?.toString() :
          apiResponse.product.offerId?.toString();
        
        // Check if product is in wishlist
        const isInWishlist = wishlistItems.has(correctProductId);
        const wishlistId = wishlistIds.get(correctProductId);
        
        // If not in local cache, check API directly
        if (!isInWishlist && !wishlistId) {
          console.log(`Product ${correctProductId} not in local cache, checking API on load...`);
          setWishlistCheckLoading(true);
          checkWishlistStatus(correctProductId).then((apiCheck) => {
            if (apiCheck.isInWishlist && apiCheck.wishlistId) {
              console.log(`Product ${correctProductId} found in wishlist via API check on load`);
              setWishlistItems(prev => new Set([...prev, correctProductId]));
              setWishlistIds(prev => new Map(prev).set(correctProductId, apiCheck.wishlistId!));
              setIsInWishlist(true);
              setWishlistId(apiCheck.wishlistId);
            } else {
              console.log(`Product ${correctProductId} not in wishlist via API check on load`);
              setIsInWishlist(false);
              setWishlistId(null);
            }
            setWishlistCheckLoading(false);
          }).catch(() => {
            setWishlistCheckLoading(false);
          });
        } else {
          // Use local cache
          console.log(`Product ${productId} wishlist status from local cache:`, { isInWishlist, wishlistId });
          setIsInWishlist(isInWishlist);
          setWishlistId(wishlistId || null);
        }
      }
    } else if (!isAuthenticated) {
      setIsInWishlist(false);
      setWishlistId(null);
    }
  }, [apiResponse, isAuthenticated, wishlistItems, wishlistIds]);

  useFocusEffect(
    useCallback(() => {
      fetchCartCount();
      // Refresh wishlist status when screen is focused
      if (isAuthenticated && apiResponse?.product) {
        const correctProductId = productSource === 'tb' ? 
          apiResponse.product.item_id?.toString() : 
          productSource === 'local' || productSource === 'chinese' ?
          apiResponse.product.id?.toString() :
          apiResponse.product.offerId?.toString();
        if (correctProductId) {
          // Check if product is in wishlist
          const isInWishlist = wishlistItems.has(correctProductId);
          const wishlistId = wishlistIds.get(correctProductId);
          
          // If not in local cache, check API directly
          if (!isInWishlist && !wishlistId) {
            console.log(`Product ${correctProductId} not in local cache, checking API on focus...`);
            setWishlistCheckLoading(true);
            checkWishlistStatus(correctProductId).then((apiCheck) => {
              if (apiCheck.isInWishlist && apiCheck.wishlistId) {
                console.log(`Product ${correctProductId} found in wishlist via API check on focus`);
                setWishlistItems(prev => new Set([...prev, correctProductId]));
                setWishlistIds(prev => new Map(prev).set(correctProductId, apiCheck.wishlistId!));
                setIsInWishlist(true);
                setWishlistId(apiCheck.wishlistId);
              } else {
                console.log(`Product ${correctProductId} not in wishlist via API check on focus`);
                setIsInWishlist(false);
                setWishlistId(null);
              }
              setWishlistCheckLoading(false);
            }).catch(() => {
              setWishlistCheckLoading(false);
            });
          } else {
            // Use local cache
            console.log(`Product ${correctProductId} wishlist status from local cache on focus:`, { isInWishlist, wishlistId });
            setIsInWishlist(isInWishlist);
            setWishlistId(wishlistId || null);
          }
        }
      }
    }, [isAuthenticated, apiResponse, wishlistItems, wishlistIds])
  );

  useEffect(() => {
    if (apiResponse?.product) {
      if (productSource === 'tb') {
        // tb: only images
        const items: any[] = [];
        if (Array.isArray(apiResponse.product.pic_urls)) {
          apiResponse.product.pic_urls.forEach((imageUrl: string) => {
            items.push({ type: 'image', url: imageUrl });
          });
        }
        setMediaItems(items);
      } else if (productSource === '1688') {
        // 1688: video + images
        const product = apiResponse.product;
        const items: any[] = [];
        if (product.mainVideo) {
          items.push({ type: 'video', url: product.mainVideo });
        }
        if (product.productImage?.images) {
          product.productImage.images.forEach((imageUrl: string) => {
            items.push({ type: 'image', url: imageUrl });
          });
        }
        setMediaItems(items);
      } else if (productSource === 'local') {
        // local: images array
        const items: any[] = [];
        if (Array.isArray(apiResponse.product.images)) {
          apiResponse.product.images.forEach((imageUrl: string) => {
            items.push({ type: 'image', url: imageUrl });
          });
        }
        setMediaItems(items);
      } else if (productSource === 'chinese') {
        // chinese: images array
        const items: any[] = [];
        if (Array.isArray(apiResponse.product.images)) {
          apiResponse.product.images.forEach((imageUrl: string) => {
            items.push({ type: 'image', url: imageUrl });
          });
        }
        setMediaItems(items);
      }
    }
  }, [apiResponse, productSource]);

  useEffect(() => {
    if (apiResponse?.product?.offerId) {
      fetchRelatedProducts(apiResponse.product.offerId);
      fetchYouMayAlsoLikeProducts(apiResponse.product.offerId);
    }
  }, [apiResponse]);

  // Translate main product title when language changes or product loads
  useEffect(() => {
    const translateMainTitle = async () => {
      if (!apiResponse?.product) return;
      
      if (language === 'en') {
        // Clear translation when switching back to English
        setTranslatedMainProductTitle(null);
        setIsTranslatingMainTitle(false);
        Animated.timing(mainProductTitleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
        return;
      }

      const targetLang = mapLanguageToTranslationCode(language);
      let originalTitle = '';
      
      if (productSource === '1688') {
        originalTitle = apiResponse.product.subjectTrans || apiResponse.product.subject || '';
      } else if (productSource === 'tb') {
        originalTitle = apiResponse.product.multi_language_info?.title || apiResponse.product.title || '';
      } else if (productSource === 'local' || productSource === 'chinese') {
        originalTitle = apiResponse.product.title || '';
      }
      
      if (!originalTitle) return;
      
      setIsTranslatingMainTitle(true);
      
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(mainProductTitleAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(mainProductTitleAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      try {
        const translated = await translateWithCache(originalTitle, targetLang);
        setTranslatedMainProductTitle(translated);
        setIsTranslatingMainTitle(false);
        
        // Stop animation and set full opacity
        mainProductTitleAnim.stopAnimation(() => {
          Animated.timing(mainProductTitleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      } catch (error) {
        console.error('Failed to translate main product title:', error);
        setIsTranslatingMainTitle(false);
        mainProductTitleAnim.stopAnimation(() => {
          Animated.timing(mainProductTitleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }
    };

    translateMainTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, apiResponse?.product, productSource]);

  // Translate specifications when language changes or product loads (for 1688 only)
  // This runs after main title translation completes
  useEffect(() => {
    const translateSpecifications = async () => {
      // Wait for main title translation to complete first
      if (isTranslatingMainTitle) {
        return;
      }
      
      if (language === 'en' || productSource !== '1688' || !apiResponse?.product?.productAttribute) {
        // Clear translations when switching back to English or not 1688
        setTranslatedSpecifications(new Map());
        setTranslatingSpecifications(new Set());
        setIsTranslatingSpecs(false);
        specificationAnimations.forEach((animValue) => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
        return;
      }

      const targetLang = mapLanguageToTranslationCode(language);
      const attributes = apiResponse.product.productAttribute || [];
      
      if (attributes.length === 0) {
        setIsTranslatingSpecs(false);
        return;
      }
      
      setIsTranslatingSpecs(true);
      
      // Mark all as translating
      const allIndices = attributes.map((_: any, index: number) => index);
      setTranslatingSpecifications(new Set(allIndices));
      
      // Start animations for all specifications
      attributes.forEach((_: any, index: number) => {
        const animValue = getSpecificationAnimation(index);
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
      
      try {
        // Collect all texts to translate
        const translationPromises: Promise<string>[] = [];
        const translationMap: Array<{ index: number; nameIndex: number; valueIndex: number }> = [];
        
        attributes.forEach((attr: any, index: number) => {
          const originalAttributeName = attr.attributeNameTrans || attr.attributeName || '';
          const originalValue = attr.valueTrans || attr.value || '';
          
          let nameIndex = -1;
          let valueIndex = -1;
          
          if (originalAttributeName) {
            nameIndex = translationPromises.length;
            translationPromises.push(translateWithCache(originalAttributeName, targetLang));
          }
          
          if (originalValue) {
            valueIndex = translationPromises.length;
            translationPromises.push(translateWithCache(originalValue, targetLang));
          }
          
          if (nameIndex >= 0 || valueIndex >= 0) {
            translationMap.push({ index, nameIndex, valueIndex });
          }
        });
        
        // Translate all at once
        const translatedTexts = await Promise.all(translationPromises);
        
        // Update all translated specifications at once
        const newTranslatedSpecs = new Map<number, { attributeName: string; value: string }>();
        
        translationMap.forEach(({ index, nameIndex, valueIndex }) => {
          const attr = attributes[index];
          const originalAttributeName = attr.attributeNameTrans || attr.attributeName || '';
          const originalValue = attr.valueTrans || attr.value || '';
          
          newTranslatedSpecs.set(index, {
            attributeName: nameIndex >= 0 ? translatedTexts[nameIndex] : originalAttributeName,
            value: valueIndex >= 0 ? translatedTexts[valueIndex] : originalValue,
          });
        });
        
        setTranslatedSpecifications(newTranslatedSpecs);
        setTranslatingSpecifications(new Set());
        setIsTranslatingSpecs(false);
        
        // Stop all animations and set full opacity
        attributes.forEach((_: any, index: number) => {
          const animValue = specificationAnimations.get(index);
          if (animValue) {
            animValue.stopAnimation(() => {
              Animated.timing(animValue, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }).start();
            });
          }
        });
      } catch (error) {
        console.error('Failed to translate specifications:', error);
        setTranslatingSpecifications(new Set());
        setIsTranslatingSpecs(false);
        attributes.forEach((_: any, index: number) => {
          const animValue = specificationAnimations.get(index);
          if (animValue) {
            animValue.stopAnimation(() => {
              Animated.timing(animValue, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }).start();
            });
          }
        });
      }
    };

    translateSpecifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, apiResponse?.product?.productAttribute, productSource, isTranslatingMainTitle]);

  // Translate product titles in Related Products and You May Also Like sections
  // This runs after main title and specs translation completes
  useEffect(() => {
    const translateProductTitles = async () => {
      // Wait for main title translation to complete first
      if (isTranslatingMainTitle) {
        return;
      }
      
      // Wait for specs translation to complete (if applicable)
      if (productSource === '1688' && isTranslatingSpecs) {
        return;
      }
      
      if (language === 'en') {
        // Clear translations when switching back to English
        setTranslatedRelatedProductTitles(new Map());
        setTranslatedYouMayAlsoLikeTitles(new Map());
        setTranslatingRelatedProducts(new Set());
        setTranslatingYouMayAlsoLike(new Set());
        
        // Reset all animations to full opacity
        relatedProductTitleAnimations.forEach((animValue) => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
        youMayAlsoLikeTitleAnimations.forEach((animValue) => {
          Animated.timing(animValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
        return;
      }

      const targetLang = mapLanguageToTranslationCode(language);
      
      // Translate Related Products titles
      const allRelatedProducts = [...relatedProducts, ...relatedTbProducts];
      allRelatedProducts.forEach(async (product) => {
        const productId = product.offerId?.toString() || product.item_id?.toString() || product.id?.toString() || '';
        if (!productId) return;
        
        const originalTitle = product.subjectTrans || product.subject || product.title || '';
        if (!originalTitle) return;
        
        // Add to translating set immediately
        setTranslatingRelatedProducts(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        
        const animValue = getRelatedProductTitleAnimation(productId);
        
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
        
        try {
          const translated = await translateWithCache(originalTitle, targetLang);
          
          // Update translated title immediately
          setTranslatedRelatedProductTitles(prev => {
            const newMap = new Map(prev);
            newMap.set(productId, translated);
            return newMap;
          });
          
          // Remove from translating set
          setTranslatingRelatedProducts(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
          
          // Stop animation and set full opacity
          animValue.stopAnimation(() => {
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        } catch (error) {
          console.error(`Failed to translate related product ${productId}:`, error);
          setTranslatingRelatedProducts(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
          animValue.stopAnimation(() => {
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        }
      });
      
      // Translate You May Also Like product titles
      youMayAlsoLikeProducts.forEach(async (product) => {
        const productId = product.offerId?.toString() || '';
        if (!productId) return;
        
        const originalTitle = product.subjectTrans || product.subject || '';
        if (!originalTitle) return;
        
        // Add to translating set immediately
        setTranslatingYouMayAlsoLike(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        
        const animValue = getYouMayAlsoLikeTitleAnimation(productId);
        
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
        
        try {
          const translated = await translateWithCache(originalTitle, targetLang);
          
          // Update translated title immediately
          setTranslatedYouMayAlsoLikeTitles(prev => {
            const newMap = new Map(prev);
            newMap.set(productId, translated);
            return newMap;
          });
          
          // Remove from translating set
          setTranslatingYouMayAlsoLike(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
          
          // Stop animation and set full opacity
          animValue.stopAnimation(() => {
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        } catch (error) {
          console.error(`Failed to translate you may also like product ${productId}:`, error);
          setTranslatingYouMayAlsoLike(prev => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
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

    translateProductTitles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, relatedProducts, relatedTbProducts, youMayAlsoLikeProducts, isTranslatingMainTitle, isTranslatingSpecs, productSource]);

  // Fetch wishlist on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated && !wishlistFetched) {
      fetchWishlistItems();
    } else if (!isAuthenticated) {
      setWishlistItems(new Set());
      setWishlistIds(new Map());
      setWishlistFetched(false);
    }
  }, [isAuthenticated]);

  // Periodic refresh to sync with changes from other devices (every 30 seconds)
  useEffect(() => {
    if (isAuthenticated && wishlistFetched) {
      const interval = setInterval(() => {
        fetchWishlistItems();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, wishlistFetched]);

  // Fetch vendor products when vendor tab is active
  useEffect(() => {
    if (activeTab === 'vendor' && apiResponse?.product?.offerId) {
      fetchVendorProducts(apiResponse.product.offerId);
    }
  }, [activeTab, apiResponse?.product?.offerId]);

  // Fetch related products for tb
  const fetchRelatedTbProducts = async (itemId: string | number) => {
    try {
      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/product/related/tb/${itemId}`, {
        headers
      });
      const data = await response.json();
      if (data.data) {
        setRelatedTbProducts(data.data);
      } else {
        setRelatedTbProducts([]);
      }
    } catch (e) {
      setRelatedTbProducts([]);
    }
  };

  // ... existing code ...
  // Fetch related products on apiResponse change (tb)
  useEffect(() => {
    if (apiResponse?.product && productSource === 'tb') {
      const itemId = apiResponse.product.item_id || apiResponse.product.id;
      if (itemId) {
        fetchRelatedTbProducts(itemId);
      }
    }
  }, [apiResponse, productSource]);
  // ... existing code ...

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      setApiResponse(null);
      setLocalChineseError(null);
      let response, data;
      console.log('Fetching product from:', productSource);
      const headers = await getApiHeaders();
      if (productSource === 'tb') {
        response = await fetch(`https://api.wanslu.shop/api/product/details/tb/${productId}`, {
          headers
        });
        data = await response.json();
        // For tb, the product is under data.product.data
        if (response.ok) {
          setApiResponse({ product: data.product.data, shipping: data.shipping, weight: data.weight });
        } else {
          setError(t('error.apiError', { status: response.status, message: data.message || t('error.unknown') }));
        }
      } else if (productSource === '1688') {
        response = await fetch(`https://api.wanslu.shop/api/product/details/1688/${productId}?language=en`, {
          headers
        });
        data = await response.json();
        if (response.ok) {
          setApiResponse(data);
        } else {
          setError(t('error.apiError', { status: response.status, message: data.message || t('error.unknown') }));
        }
      } else if (productSource === 'local') {
        response = await fetch(`https://api.wanslu.shop/api/product/details/local/${productId}`, {
          headers
        });
        data = await response.json();
        if (data && data.error === 'Invalid country or service not available') {
          setLocalChineseError('Service not available for this country or product.');
          setApiResponse(null);
        } else if (response.ok && data.product) {
          setApiResponse(data);
        } else {
          setError(t('error.apiError', { status: response.status, message: data.message || t('error.unknown') }));
        }
      } else if (productSource === 'chinese') {
        response = await fetch(`https://api.wanslu.shop/api/product/details/chinese/${productId}`, {
          headers
        });
        data = await response.json();
        if (data && data.error === 'Invalid country or service not available') {
          setLocalChineseError('Service not available for this country or product.');
          setApiResponse(null);
        } else if (response.ok && data.product) {
          setApiResponse(data);
        } else {
          setError(t('error.apiError', { status: response.status, message: data.message || t('error.unknown') }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failedToFetchProduct'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCartCount = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const headers = await getApiHeaders({
        'Authorization': `Bearer ${authToken}`,
      });
      const response = await fetch('https://api.wanslu.shop/api/account/cart/count', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setCartCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  const handleShare = async () => {
    if (!apiResponse?.product) return;
    try {
      const product = apiResponse.product;
      let productId = '';
      let productName = '';
      let source: '1688' | 'tb' | 'local' | 'chinese' = '1688';
      if (product.offerId) {
        productId = product.offerId.toString();
        productName = product.subjectTrans || product.subject || '';
        source = '1688';
      } else if (product.item_id) {
        productId = product.item_id.toString();
        productName = product.multi_language_info?.title || product.title || '';
        source = 'tb';
      } else if (product.id && (productSource === 'local' || productSource === 'chinese')) {
        productId = product.id.toString();
        productName = product.title || '';
        source = productSource;
      }
      // Generate share data using utility function
      const shareData = generateProductShareData(productId, productName, source);
      const shareMessage = createShareMessage(shareData);
      const result = await Share.share({
        message: shareMessage,
        url: shareData.webFallback, // Fallback URL for platforms that support it
        title: productName,
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
          console.log('Shared with activity type:', result.activityType);
        } else {
          // shared
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert(t('common.error'), t('product.failedToShareProduct'));
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

  const handleWishlistToggle = async (product: any) => {
    if (!isAuthenticated) {
      showResponseMessage(t('product.pleaseLoginToUseWishlist'), 'error');
      return;
    }
    if (!authToken) return;
    
    console.log('Wishlist toggle called with product:', product);
    
    try {
      const productId = product.pid;
      
      if (!productId) {
        console.error('Product ID is missing:', product);
        showResponseMessage(t('product.productIDMissing'), 'error');
        return;
      }
      
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
          showResponseMessage(t('product.wishlistItemNotFound'), 'error');
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
          showResponseMessage(t('product.removedFromWishlist'), 'success');
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
          showResponseMessage(t('product.failedToRemoveFromWishlist'), 'error');
        }
      } else {
        // Add to wishlist
        console.log('Adding to wishlist with data:', {
          src: product.src,
          pid: product.pid,
          img: product.img,
          title: product.title,
          price: product.price.toString(),
        });
        
        const headers = await getApiHeaders({
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        });
        const response = await fetch('https://api.wanslu.shop/api/actions/wishlist', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            src: product.src,
            pid: product.pid,
            img: product.img,
            title: product.title,
            price: product.price.toString(),
          })
        });

        const responseData = await response.json();
        console.log('Wishlist API response:', responseData);

        if (response.ok) {
          showResponseMessage(t('product.addedToWishlist'), 'success');
          const wishlistId = responseData.id || responseData.data?.id;
          if (wishlistId) {
            setWishlistItems(prev => new Set([...prev, productId]));
            setWishlistIds(prev => new Map(prev).set(productId, wishlistId ?? 0));
            console.log(`Added product ${productId} to wishlist`);
          }
        } else if (responseData.status === "error" && responseData.message === "Item already exists in wishlist") {
          showResponseMessage(t('product.itemAlreadyExistsInWishlist'), 'success');
          const wishlistId = responseData.data?.id;
          if (wishlistId) {
            setWishlistItems(prev => new Set([...prev, productId]));
            setWishlistIds(prev => new Map(prev).set(productId, wishlistId ?? 0));
            console.log(`Product ${productId} already in wishlist, updated state`);
          }
        } else {
          showResponseMessage(responseData.message || t('product.failedToAddToWishlist'), 'error');
        }
      }
    } catch (error) {
      console.error('Wishlist action failed:', error);
      Alert.alert(t('common.error'), t('product.wishlistActionFailed'));
    }
  };

  const refreshCartCount = () => {
    fetchCartCount();
  };

  const handleAddToCart = () => {
    setShowAddToCartSheet(true);
  };

  const handleCloseAddToCartSheet = () => {
    setShowAddToCartSheet(false);
    setCartQuantity(1);
  };

  const closeImagePopup = useCallback(() => {
    setShowImagePopup(false);
    setPopupImageUri('');
  }, []);

  // Helper functions for Add to Cart
  const getSource = () => {
    if (apiResponse?.product?.offerId || apiResponse?.product?.subjectTrans || apiResponse?.product?.subject) return '1688';
    if (apiResponse?.product?.item_id) return 'tb';
    if (apiResponse?.product?.category === 'Local Products') return 'local';
    if (apiResponse?.product?.category === 'Chinese Products') return 'chinese';
    // Fallback to route-derived productSource if category is missing
    return productSource;
  };

  const getProductData = () => {
    const source = getSource();
    console.log("Final src+ "+ source);
    if (source === '1688') {
      return {
        pid: String(apiResponse?.product?.offerId || apiResponse?.product?.id),
        title: apiResponse?.product?.subjectTrans || apiResponse?.product?.subject,
        price: apiResponse?.product?.productSaleInfo?.priceRangeList?.[0]?.price || apiResponse?.product?.productSkuInfos?.[0]?.price || '0',
        originalPrice: apiResponse?.product?.productSkuInfos?.[0]?.consignPrice,
        minOrder: apiResponse?.product?.minOrderQuantity || apiResponse?.product?.productSaleInfo?.fenxiaoSaleInfo?.startQuantity || 1,
        stock: apiResponse?.product?.productSaleInfo?.amountOnSale,
        img: Array.isArray(apiResponse?.product?.images) && apiResponse?.product?.images.length > 0 ? apiResponse?.product?.images[0].imageUrl : (apiResponse?.product?.imageUrl || apiResponse?.product?.image || apiResponse?.product?.productImage || ''),
        weight: apiResponse?.product?.productShippingInfo?.weight,
      };
    } else if (source === 'tb') {
      return {
        pid: String(apiResponse?.product?.item_id || apiResponse?.product?.id),
        title: apiResponse?.product?.multi_language_info?.title || apiResponse?.product?.title,
        price: apiResponse?.product?.coupon_price || apiResponse?.product?.price,
        originalPrice: apiResponse?.product?.price,
        minOrder: 1,
        stock: apiResponse?.product?.inventory,
        img: Array.isArray(apiResponse?.product?.pic_urls) && apiResponse?.product?.pic_urls.length > 0 ? apiResponse?.product?.pic_urls[0] : (apiResponse?.product?.main_image_url || ''),
        weight: apiResponse?.product?.weight,
      };
    } else if (source === 'local' || source === 'chinese') {
      // Calculate price from variants (least price)
      const variants = apiResponse?.variants || [];
      const prices = variants.map((v: any) => parseFloat(v.price || 0)).filter((p: number) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      
      // Calculate total stock from all variants
      const totalStock = variants.reduce((sum: number, v: any) => sum + (parseInt(v.quantity) || 0), 0);
      
      const baseImage = Array.isArray(apiResponse?.product?.images) && apiResponse?.product?.images.length > 0 ? apiResponse?.product?.images[0] : '';
      const resolvedImage = typeof baseImage === 'string' ? (baseImage.startsWith('http') ? baseImage : `https://merchants.wanslu.shop/${baseImage}`) : (baseImage?.imageUrl || '');
      return {
        pid: String(apiResponse?.product?.id),
        title: apiResponse?.product?.title,
        price: minPrice.toString(),
        originalPrice: minPrice.toString(), // Use same price for original
        minOrder: apiResponse?.product?.moq || 1,
        stock: totalStock,
        img: resolvedImage,
        weight: apiResponse?.product?.weight || 0,
      };
    } else {
      return {
        pid: String(apiResponse?.product?.id || apiResponse?.product?.offerId || apiResponse?.product?.item_id),
        title: apiResponse?.product?.title || apiResponse?.product?.subject || apiResponse?.product?.name || '',
        price: apiResponse?.product?.price || apiResponse?.product?.original_price || '0',
        originalPrice: apiResponse?.product?.original_price,
        minOrder: 1,
        stock: 0,
        img: apiResponse?.product?.image || apiResponse?.product?.imageUrl || apiResponse?.product?.img || '',
        weight: apiResponse?.product?.weight || 0,
      };
    }
  };

  const handleConfirmAddToCart = async () => {
    console.log('=== PRODUCT VARIANTS ADD TO CART CALLED ===');
    const source = getSource();
    const productData = getProductData();
    console.log('Source:', source);
    console.log('Product data:', productData);
    console.log('Quantity data:', quantityData);
    
    // Debug logging for tb products
    console.log('Debug - productSource:', productSource);
    console.log('Debug - productSource === "tb":', productSource === 'tb');
    if (productSource === 'tb') {
      console.log('TB Debug - selectedTbVariant:', selectedTbVariant);
      console.log('TB Debug - tbQuantity:', tbQuantity);
      console.log('TB Debug - skuList length:', skuList.length);
    } else {
      console.log('Debug - Not tb product, using 1688 logic');
    }
    
    if (!authToken) {
      showResponseMessage(t('product.pleaseLoginToAddToCart'), 'error');
      setShowAddToCartSheet(false);
      setCartQuantity(1);
      setTimeout(() => {
        router.push('/login');
      }, 1000);
      return;
    }
    
    setAddingCart(true);
    try {
      // Get all variants with quantities from quantityData
      let variants;
      if (productSource === 'tb') {
        // For tb products, use selected variant with quantity
        if (!selectedTbVariant) {
          showResponseMessage(t('product.pleaseSelectVariant'), 'error');
          setAddingCart(false);
          return;
        }
        if (tbQuantity < 1) {
          showResponseMessage(t('product.pleaseSelectAtLeast1Quantity'), 'error');
          setAddingCart(false);
          return;
        }
        const variantData = { quantity: tbQuantity, price: getTbVariantPrice(selectedTbVariant), specId: selectedTbVariant.sku_id, imageUrl: getTbVariantImage(selectedTbVariant) };
        console.log('TB Debug - variantData:', variantData);
        variants = [['tb_variant', variantData]];
      } else {
        // For 1688 products, use existing logic
        variants = Object.entries(quantityData).filter(([_, data]) => data.quantity > 0);
        if (variants.length === 0) {
          showResponseMessage(t('product.pleaseSelectAtLeastOneVariant'), 'error');
          setAddingCart(false);
          return;
        }
      }
      
              // Check total quantity against minimum order
        let totalQuantity;
        if (productSource === 'tb') {
          totalQuantity = tbQuantity;
        } else {
          totalQuantity = Object.values(quantityData).reduce((sum, data) => sum + data.quantity, 0);
        }
        const minOrder = productData.minOrder || 1;
        if (totalQuantity < minOrder) {
          showResponseMessage(t('product.minimumOrderQuantityIs', { quantity: minOrder }), 'error');
          setAddingCart(false);
          return;
        }
      
              // Make separate requests for each variant
        const requests = variants.map(async ([key, data]) => {
          let skuItem;
          if (productSource === 'tb') {
            // For tb products, use selected variant
            skuItem = selectedTbVariant;
          } else if (productSource === 'local' || productSource === 'chinese') {
            // For local/chinese products, find the SKU item based on attributes
            const [firstAttr, secondAttr] = (key as string).split('_');
            skuItem = skuList.find((item: any) => {
              const matchesFirstAttr = getFirstAttributeValue(item) === firstAttr;
              const matchesSecondAttr = !secondAttr || getSecondAttributeValue(item) === secondAttr;
              return matchesFirstAttr && matchesSecondAttr;
            });
          } else {
            // For 1688 products, use existing logic
            const [firstAttr, secondAttr] = (key as string).split('_');
            skuItem = skuList.find((item: any) => {
              const matchesFirstAttr = getFirstAttributeValue(item) === firstAttr;
              const matchesSecondAttr = !secondAttr || getSecondAttributeValue(item) === secondAttr;
              return matchesFirstAttr && matchesSecondAttr;
            });
          }
          
          if (!skuItem) return null;
          
          // Prepare variant info
          let vinfo = '';
          let variant = '';
          let image = '';
          
          if (productSource === 'tb') {
            image = getTbVariantImage(skuItem);
          } else if (productSource === 'local' || productSource === 'chinese') {
            image = getSkuImage(skuItem) || (data as any).imageUrl || productData.img;
          } else {
            image = (data as any).imageUrl || productData.img;
          }
        
        if (productSource === 'tb') {
          vinfo = skuItem.sku_id.toString() || '';
          variant = skuItem.properties?.map((prop: any) => `${prop.prop_name}: ${prop.value_name}`).join(', ') || '';
        } else if (productSource === 'local' || productSource === 'chinese') {
          vinfo = getSkuSpecId(skuItem);
          variant = skuItem.variant || skuItem.properties?.map((prop: any) => `${prop.propName}: ${prop.valueName}`).join(', ') || '';
        } else {
          vinfo = getSkuSpecId(skuItem);
          variant = skuItem.skuAttributes?.map((attr: any) => `${attr.attributeNameTrans}: ${attr.valueTrans}`).join(', ') || '';
        }
        
        // Get shipping info for this variant
        let weight = Math.round((productData.weight || 0) * 1000);
        let volume = 0;
        
        if (productSource === 'tb') {
          // For tb products, use default weight or try to get from product data
          weight = Math.round((apiResponse?.product?.weight || 0) * 1000);
        } else if (productSource === 'local' || productSource === 'chinese') {
          // For local/chinese products, use default weight
          weight = Math.round((apiResponse?.product?.weight || 0) * 1000);
        } else {
          // For 1688 products, use shipping info
          const shippingInfo = apiResponse?.product?.productShippingInfo?.skuShippingDetails?.find((detail: any) => detail.skuId === skuItem.skuId);
          if (shippingInfo?.weight) {
            weight = Math.round(shippingInfo.weight * 1000);
          }
          if (shippingInfo) {
            volume = Math.round((shippingInfo.length || 0) * (shippingInfo.width || 0) * (shippingInfo.height || 0));
          }
        }
        
                  // Prepare payload
          const payload = {
            src: source,
            pid: productData.pid,
            title: productData.title,
            image: image,
            price: productSource === 'tb' ? getTbVariantPrice(skuItem).toString() : (data as any).price.toString(),
            quantity: productSource === 'tb' ? tbQuantity : (data as any).quantity,
            variant,
            vinfo,
            weight,
            volume,
            min_quantity: productData.minOrder || 1,
            dom_shipping: shippingFee.toString(),
            tax: 0,
            country: '0',
            seller: productSource === 'tb' ? 'tb' : 
                   productSource === 'local' || productSource === 'chinese' ? 
                   (apiResponse?.product?.musername || 'local') : 
                   (apiResponse?.product?.sellerOpenId || apiResponse?.product?.seller || '1688')
          };
        
        // Add to cart
        const headers = await getApiHeaders({
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        });
        const response = await fetch('https://api.wanslu.shop/api/actions/cart', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to add variant to cart: ${response.statusText}`);
        }
        
        return response.json();
      });
      
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        showResponseMessage(t('product.added', { count: successful }) + (successful > 1 ? t('product.variants') : ''), 'success');
        if (failed > 0) {
          showResponseMessage(t('product.failedToAdd', { count: failed }) + (failed > 1 ? t('product.variants') : ''), 'error');
        }
        setShowAddToCartSheet(false);
        setQuantityData({});
        fetchCartCount();
        
        // Navigate to cart after a short delay
        setTimeout(() => {
          router.push('/cart');
        }, 1000);
      } else {
        showResponseMessage(t('product.failedToAddToCart'), 'error');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      showResponseMessage(t('product.failedToAddToCart'), 'error');
    } finally {
      setAddingCart(false);
    }
  };

  const renderMediaItem = ({ item, index }: { item: any; index: number }) => {
    if (item.type === 'video' && productSource === '1688') {
      return (
        <View style={styles.mediaItem}>
          <ExpoVideo
            source={{ uri: item.url }}
            style={styles.video}
            useNativeControls={true}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
            isMuted={false}
          />
        </View>
      );
    } else {
      return (
        <View style={styles.mediaItem}>
          <Image 
            source={{ uri: item.url }} 
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      );
    }
  };

  const renderThumbnails = () => {
    if (mediaItems.length === 0) return null;
    
    return (
      <View style={styles.thumbnailsContainer}>
        <FlatList
          data={mediaItems}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              style={[
                styles.thumbnail, 
                currentSlideIndex === index && styles.selectedThumbnail
              ]}
              onPress={() => {
                setCurrentSlideIndex(index);
                flatListRef.current?.scrollToIndex({ index, animated: true });
              }}
            >
              {item.type === 'video' ? (
                <View style={styles.videoThumbnail}>
                  {/* Use first available image as video thumbnail preview */}
                  <Image 
                    source={{ uri: mediaItems.find(m => m.type === 'image')?.url || item.url }} 
                    style={styles.thumbnailImage}
                  />
                  <View style={styles.videoIcon}>
                    <Ionicons name="play" size={16} color="#fff" />
            </View>
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={styles.thumbnailImage} />
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.thumbnailsList}
        />
            </View>
    );
  };

  const renderProductInfo = () => {
    if (!apiResponse?.product) return null;
    const product = apiResponse.product;
    if (productSource === 'tb') {
      // tb: show only basic info
      const currentPrice = product.coupon_price || product.price || '0';
      const originalPrice = product.price || '0';
      const shippingFee = apiResponse?.shipping?.fee ?? '1.00';
      const stock = product.quantity || 0;
      return (
        <>
       
        <View style={styles.productInfoCustom}>
        {/* WHOLESALE Badge */}
        <View style={styles.badgesContainerCustom}>
          <View style={styles.wholesaleBadgeCustom}>
            <Text style={styles.badgeTextCustom}>{t('product.retail')}</Text>
          </View>
        </View>

        {/* Product Title */}
        {language !== 'en' ? (
          <>
            <Animated.Text 
              style={[
                styles.productTitleCustom,
                { opacity: mainProductTitleAnim }
              ]}
            >
              {translatedMainProductTitle || product.title}
            </Animated.Text>
            {isTranslatingMainTitle && (
              <Text style={styles.translatingText}>Translating</Text>
            )}
          </>
        ) : (
          <Text style={styles.productTitleCustom}>{product.title}</Text>
        )}

        <View style={styles.priceBoxCustom}>
            <View style={styles.priceRowCustom}>
              <Text style={styles.priceLabelCustom}>{t('product.price')}</Text>
              <Text style={styles.priceValueCustom}>{convertPrice(currentPrice/100)}</Text>
            </View>
            <View style={styles.priceRowCustom}>
              <Text style={styles.priceLabelCustom}>{t('product.stock')}</Text>
              <Text style={styles.priceValueCustom}>{stock}</Text>
            </View>

          
          </View>
       

      

        {/* Pricing Information */}
        <View style={styles.pricingSection}>
          {/* Current and Original Price */}
          {/* <View style={styles.priceDisplayRow}>
            <Text style={styles.currentPriceText}>{convertPrice(currentPrice / 100)}</Text>
            <Text style={styles.originalPriceText}>{convertPrice(originalPrice / 100)}</Text>
          </View> */}

          {/* Shipping Details */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.sellerToWarehouse')}</Text>
            </View>
            <Text style={styles.shippingFeeText}>{t('product.chinaShippingFee')} <Text style={styles.highlightText}>{convertPrice(shippingFee)}</Text></Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.warehouseToAddress')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/shipping-estimate')}>
              <Text style={styles.estimateText}>{t('product.estimate')}</Text>
            </TouchableOpacity>
          </View>

          {/* Procurement and Control Time */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>{t('product.procurementAndControlTime')}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.orderFrom3OrMoreSuppliers')}</Text>
            </View>
            <Text style={styles.processingTimeText}>{t('product.workingDays10')}</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.orderFromLessThan3Suppliers')}</Text>
            </View>
            <Text style={styles.processingTimeText}>{t('product.workingDays5')}</Text>
          </View>

          {/* Repurchase Statistic */}
          <Text style={styles.repurchaseText}>{apiResponse.product.sellerDataInfo && typeof apiResponse.product.sellerDataInfo.repeatPurchasePercent === 'number' ? (apiResponse.product.sellerDataInfo.repeatPurchasePercent*100).toFixed(2)+"% " + t('product.peopleBoughtThisProductAgain') : ""}</Text>
        </View>
          {/* Fulfilled by wanslu.shop */}
          <Text style={styles.fulfilledByText}>{t('product.fulfilledByWansluShop')}</Text>
      </View>
        </>
      );
    }
    
    // Local and Chinese products
    if (productSource === 'local' || productSource === 'chinese') {
      // Calculate price from variants (least price)
      const variants = apiResponse?.variants || [];
      const prices = variants.map((v: any) => parseFloat(v.price || 0)).filter((p: number) => p > 0);
      const currentPrice = prices.length > 0 ? Math.min(...prices) : 0;
      
      // Calculate total stock from all variants
      const totalStock = variants.reduce((sum: number, v: any) => sum + (parseInt(v.quantity) || 0), 0);
      
      // Get MOQ from product
      const moq = product.moq || 1;
      
      return (
        <View style={styles.productInfoCustom}>
          {/* LOCAL/CHINESE Badge */}
          <View style={styles.badgesContainerCustom}>
            <View style={styles.wholesaleBadgeCustom}>
              <Text style={styles.badgeTextCustom}>
                {productSource === 'local' ? t('product.local') : t('product.chinese')}
              </Text>
            </View>
          </View>

          {/* Product Title */}
          <Text style={styles.productTitleCustom}>{product.title}</Text>

          {/* Price Section - No ratings/sales for local/chinese */}
          <View style={styles.priceBoxCustom}>
            <View style={styles.priceRowCustom}>
              <Text style={styles.priceLabelCustom}>{t('product.price')}</Text>
              <Text style={styles.priceValueCustom}>
                {convertPrice(currentPrice.toFixed(2))}
              </Text>
            </View>
            <View style={styles.priceRowCustom}>
              <Text style={styles.priceLabelCustom}>{t('product.moq')}</Text>
              <Text style={styles.priceValueCustom}>{moq}</Text>
            </View>
            <View style={styles.priceRowCustom}>
              <Text style={styles.priceLabelCustom}>{t('product.stock')}</Text>
              <Text style={styles.priceValueCustom}>{totalStock}</Text>
            </View>
          </View>

          {/* Fulfilled by wanslu.shop */}
          <Text style={styles.fulfilledByText}>{t('product.fulfilledByWansluShop')}</Text>
        </View>
      );
    }
    
    // ... existing 1688 code ...
    const currentPrice = product.productSkuInfos?.[0]?.price || '0';
    const originalPrice = product.productSkuInfos?.[0]?.price || '0';
    const shippingFee = apiResponse?.shipping?.freight ?? '1.00';
    const rating = product.tradeScore || 2.5; // fallback
    const sales = product.soldOut || 0; // fallback
    const batchMOQ = product.productSaleInfo?.priceRangeList?.[0]?.startQuantity || 0;
    const avaliableQuantity = product.productSaleInfo?.amountOnSale || 0;
    const isLoadingPrice = false; // Set to true if price is loading

    return (
      <View style={styles.productInfoCustom}>
        {/* WHOLESALE Badge */}
        <View style={styles.badgesContainerCustom}>
          <View style={styles.wholesaleBadgeCustom}>
            <Text style={styles.badgeTextCustom}>{t('product.wholesale')}</Text>
          </View>
        </View>

        {/* Product Title */}
        {language !== 'en' ? (
          <>
            <Animated.Text 
              style={[
                styles.productTitleCustom,
                { opacity: mainProductTitleAnim }
              ]}
            >
              {translatedMainProductTitle || product.subjectTrans}
            </Animated.Text>
            {isTranslatingMainTitle && (
              <Text style={styles.translatingText}>Translating</Text>
            )}
          </>
        ) : (
          <Text style={styles.productTitleCustom}>{product.subjectTrans}</Text>
        )}

        {/* Rating and Sales */}
        <View style={styles.ratingSalesContainerCustom}>
          <View style={styles.ratingCustom}>
            <Ionicons name="star" size={18} color="#FFD700" />
            <Text style={styles.ratingTextCustom}>{rating}</Text>
          </View>
          <Text style={styles.salesTextCustom}>{sales.toLocaleString()} {t('product.soldThisMonth')}</Text>
        </View>
          {/* Dynamic Price Range for 1688 */}
          {productSource === '1688' && apiResponse?.product?.productSaleInfo?.priceRangeList?.length > 0 && (
            <View style={styles.priceRangeContainer}>
              {/* Left labels column */}
              <View style={styles.priceRangeLabels}>
                <Text style={styles.priceRangeLabel}>{t('product.price')}</Text>
                <Text style={styles.priceRangeLabel}>{t('product.batchMoq')}</Text>
              </View>
              
              {/* Grid of price + MOQ columns */}
              <View style={styles.priceRangeGrid}>
                {(() => {
                  const priceRanges = apiResponse.product.productSaleInfo.priceRangeList;
                  const currentTotalQuantity = Object.values(quantityData).reduce((sum, data) => sum + data.quantity, 0);
                  let activeIdx = 0;
                  for (let i = 0; i < priceRanges.length; i++) {
                    if (currentTotalQuantity >= priceRanges[i].startQuantity) {
                      activeIdx = i;
                    }
                  }
                  
                  return priceRanges.map((range: any, idx: number) => (
                    <View
                      key={range.startQuantity || idx}
                      style={[
                        styles.priceRangeItem,
                        activeIdx === idx && currentTotalQuantity > 0 && styles.priceRangeItemActive
                      ]}
                    >
                      <Text style={styles.priceRangePrice}>
                        {isLoadingPrice ? t('common.loading') : convertPrice(range.price)}
                      </Text>
                      <Text style={styles.priceRangeMOQ}>
                        {range.startQuantity}&lt;
                      </Text>
                    </View>
                  ));
                })()}
              </View>
            </View>
          )}
        {/* Price Section */}
        <View style={styles.priceBoxCustom}>


          {/* Fallback for non-1688 or when no price ranges */}
          {(productSource !== '1688' || !apiResponse?.product?.productSaleInfo?.priceRangeList?.length) && (
            <>
              <View style={styles.priceRowCustom}>
                <Text style={styles.priceLabelCustom}>{t('product.price')}</Text>
                <Text style={styles.priceValueCustom}>{isLoadingPrice ? t('common.loading') : convertPrice(currentPrice)}</Text>
              </View>
              <View style={styles.priceRowCustom}>
                <Text style={styles.priceLabelCustom}>{t('product.batchMoq')}</Text>
                <Text style={styles.priceValueCustom}>{batchMOQ}&lt;</Text>
              </View>
            </>
          )}

          <View style={styles.priceRowCustom}>
            <Text style={styles.priceLabelCustom}>{t('product.stock')}</Text>
            <Text style={styles.priceValueCustom}>{avaliableQuantity}</Text>
          </View>

          {/* Weight and Volume (for 1688) */}
          {productSource === '1688' && (
            <>
              {apiResponse?.product?.productShippingInfo?.weight && (
                <View style={styles.priceRowCustom}>
                  <Text style={styles.priceLabelCustom}>{t('product.weight')}</Text>
                  <Text style={styles.priceValueCustom}>{apiResponse.product.productShippingInfo.weight.toFixed(2)} kg</Text>
                </View>
              )}
              {apiResponse?.product?.productShippingInfo?.skuShippingDetails?.[0] && apiResponse.product.productShippingInfo.skuShippingDetails[0].length != 0 && (
                <View style={styles.priceRowCustom}>
                  <Text style={styles.priceLabelCustom}>{t('product.volume')}</Text>
                  <Text style={styles.priceValueCustom}>
                    {Math.round((apiResponse.product.productShippingInfo.skuShippingDetails[0].length || 0) * 
                      (apiResponse.product.productShippingInfo.skuShippingDetails[0].width || 0) * 
                      (apiResponse.product.productShippingInfo.skuShippingDetails[0].height || 0))} cm³
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

      

        {/* Pricing Information */}
        <View style={styles.pricingSection}>
          {/* Current and Original Price */}
          {/* <View style={styles.priceDisplayRow}>
            <Text style={styles.currentPriceText}>{convertPrice(currentPrice)}</Text>
            <Text style={styles.originalPriceText}>{convertPrice(originalPrice)}</Text>
          </View> */}

          {/* Shipping Details */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.sellerToWarehouse')}</Text>
            </View>
            <Text style={styles.shippingFeeText}>{t('product.chinaShippingFee')} <Text style={styles.highlightText}>{convertPrice(shippingFee)}</Text></Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.warehouseToAddress')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/shipping-estimate')}>
              <Text style={styles.estimateText}>{t('product.estimate')}</Text>
            </TouchableOpacity>
          </View>

          {/* Procurement and Control Time */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>{t('product.procurementAndControlTime')}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.orderFrom3OrMoreSuppliers')}</Text>
            </View>
            <Text style={styles.processingTimeText}>{t('product.workingDays10')}</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ed2027" />
              <Text style={styles.infoLabel}>{t('product.orderFromLessThan3Suppliers')}</Text>
            </View>
            <Text style={styles.processingTimeText}>{t('product.workingDays5')}</Text>
          </View>

          {/* Repurchase Statistic */}
          <Text style={styles.repurchaseText}>{apiResponse.product.sellerDataInfo  ? (apiResponse.product.sellerDataInfo.repeatPurchasePercent*100).toFixed(2)+"% " + t('product.peopleBoughtThisProductAgain') : ""}</Text>
        </View>
          {/* Fulfilled by wanslu.shop */}
          <Text style={styles.fulfilledByText}>{t('product.fulfilledByWansluShop')}</Text>
      </View>
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentSlideIndex(newIndex);
      
    }
  }).current;

  const fetchRelatedProducts = async (offerId: string | number) => {
    try {
      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/product/related/1688/${offerId}?language=en`, {
        headers
      });
      const data = await response.json();
      console.log('Related Products API response:', data);
      if (data.result && data.result.result) {
        setRelatedProducts(data.result.result);
        console.log('Related products set:', data.result.result);
      }
    } catch (e) {
      console.error('Error fetching related products:', e);
      setRelatedProducts([]);
    }
  };

  const fetchYouMayAlsoLikeProducts = async (offerId: string | number) => {
    try {
      const headers = await getApiHeaders();
      const response = await fetch(`https://api.wanslu.shop/api/product/like/1688/${offerId}?language=en`, {
        headers
      });
      const data = await response.json();
      console.log('You May Also Like API response:', data);
      if (data.result && data.result.result) {
        setYouMayAlsoLikeProducts(data.result.result);
        console.log('You May Also Like products set:', data.result.result);
      }
    } catch (e) {
      console.error('Error fetching You May Also Like products:', e);
      setYouMayAlsoLikeProducts([]);
    }
  };

  const fetchVendorProducts = async (offerId: string | number) => {
    try {
      setVendorProductsLoading(true);
      setVendorProductsError(null);
      
      const url = new URL(`https://api.wanslu.shop/api/product/vendor/1688/${offerId}`);
      url.searchParams.append("seller", apiResponse?.product?.sellerOpenId || '');
      url.searchParams.append("language", "en");
      
      console.log('Fetching vendor products from:', url.toString());
      
      const headers = await getApiHeaders({
        "Content-Type": "application/json",
      });
      const response = await fetch(url.toString(), {
        method: "GET",
        headers
      });

      if (!response.ok) {
        throw new Error("No other products for this vendor");
      }

      const data = await response.json();
      console.log('Vendor products API response:', data);
      
      if (data.result?.success) {
        setVendorProducts(data.result.result.data || []);
        console.log('Vendor products set:', data.result.result.data);
      } else {
        throw new Error(data.result?.message || "Failed to get vendor products");
      }
    } catch (err: any) {
      console.error('Error fetching vendor products:', err);
      setVendorProductsError(err.message);
    } finally {
      setVendorProductsLoading(false);
    }
  };

  const fetchWishlistItems = async (forceRefresh = false) => {
    if (!authToken) return;
    
    // Check if we need to refresh (either forced or if data is stale)
    const now = Date.now();
    if (!forceRefresh && wishlistFetched && (now - lastFetchTime) < 30000) {
      return; // Data is fresh, no need to refresh
    }
    
    try {
      setWishlistLoading(true);
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
          wishlistSet.add(item.pid);
          wishlistMap.set(item.pid, item.id);
        });
        setWishlistItems(wishlistSet);
        setWishlistIds(wishlistMap);
        setWishlistFetched(true);
        setLastFetchTime(now);
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

  // Helper functions for vendor catalog colors
  const getScoreColor = (score: string | number) => {
    const numScore = typeof score === "string" ? Number.parseFloat(score) : score;
    if (numScore >= 4.5) return { color: '#4CAF50' }; // Green
    if (numScore >= 4.0) return { color: '#FF9800' }; // Orange
    return { color: '#F44336' }; // Red
  };

  const getPercentageColor = (percent: string | number) => {
    const numPercent = typeof percent === "string" ? Number.parseFloat(percent) * 100 : percent * 100;
    if (numPercent >= 95) return { color: '#4CAF50' }; // Green
    if (numPercent >= 85) return { color: '#FF9800' }; // Orange
    return { color: '#F44336' }; // Red
  };

  const getQualityRefundColor = (refundRate: string | number) => {
    const numRate = typeof refundRate === "string" ? Number.parseFloat(refundRate) : refundRate;
    if (numRate < 0.01) return { color: '#4CAF50' }; // Green
    return { color: '#F44336' }; // Red
  };

  const checkWishlistStatus = async (productId: string): Promise<{ isInWishlist: boolean; wishlistId?: number }> => {
    if (!authToken) return { isInWishlist: false };
    try {
      console.log(`Checking wishlist status for productId: ${productId}`);
      const headers = await getApiHeaders({
        'Authorization': `Bearer ${authToken}`
      });
      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`Wishlist API response data:`, data.data);
        const wishlistItem = data.data?.find((item: any) => item.pid === productId);
        console.log(`Found wishlist item for ${productId}:`, wishlistItem);
        if (wishlistItem) {
          return { isInWishlist: true, wishlistId: wishlistItem.id };
        }
      }
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    }
    return { isInWishlist: false };
  };

  // --- Parse SKUs for attribute structure ---
  const skuList = (() => {
    if (productSource === 'tb') {
      return apiResponse?.product?.sku_list || [];
    } else if (productSource === 'local' || productSource === 'chinese') {
      // For local and Chinese products, convert variants array to sku-like format
      const variants = apiResponse?.variants || apiResponse?.product?.variants || [];
      return variants.map((variant: any) => ({
        id: variant.id,
        sku_id: variant.id.toString(),
        specId: variant.id.toString(),
        price: variant.price,
        original_price: variant.original_price,
        quantity: variant.quantity,
        amountOnSale: variant.quantity,
        variant: variant.variant,
        image: variant.image,
        pic_url: variant.image?.startsWith('http') ? variant.image : `https://merchants.wanslu.shop/${variant.image}`,
        // Create properties array for compatibility with existing functions
        properties: [{
          propName: 'Variant',
          prop_name: 'Variant',
          valueName: variant.variant,
          value_name: variant.variant
        }],
        // Create skuAttributes array for compatibility
        skuAttributes: [{
          attributeName: 'Variant',
          attributeNameTrans: 'Variant',
          valueTrans: variant.variant,
          skuImageUrl: variant.image?.startsWith('http') ? variant.image : `https://merchants.wanslu.shop/${variant.image}`
        }]
      }));
    } else {
      return apiResponse?.product?.productSkuInfos || [];
    }
  })();
  
  const currencySymbol = (() => {
    if (productSource === 'tb' || productSource === 'chinese' || productSource === '1688') return 'CNY';
    if (productSource === 'local') {
      if (apiResponse?.product?.country === 'IN') return '₹';
      // Fallback to context currency symbol mapping
      const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', CNY: 'CNY', AED: 'AED', SAR: 'SAR' };
      return map[currency] || currency;
    }
    return 'CNY';
  })();
  const shippingFee = apiResponse?.shipping?.freight ?? '1.00';

  const currencyRate = 1; // Placeholder, update if you have real currency rate

  // Simple state for tb products
  const [selectedTbVariant, setSelectedTbVariant] = useState<any>(null);
  const [tbQuantity, setTbQuantity] = useState<number>(1);

  // Initialize tb variant selection
  useEffect(() => {
    if (productSource === 'tb' && skuList.length > 0) {
      setSelectedTbVariant(skuList[0]);
    }
  }, [skuList, productSource]);

  // Helper functions for tb products
  const getTbVariantPrice = (sku: any) => {
    const priceInCents = sku.coupon_price || sku.price || '0';
    return parseFloat(priceInCents) / 100;
  };

  const getTbVariantImage = (sku: any) => {
    return sku.pic_url || '';
  };

  const getTbVariantStock = (sku: any) => {
    return sku.quantity || 0;
  };

  // Helper function to get the first attribute value from a SKU
  const getFirstAttributeValue = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format - use the first property value
      return sku.properties?.[0]?.value_name || '';
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - use the variant name
      return sku.variant || sku.properties?.[0]?.valueName || '';
    } else {
      // 1688 format
      return sku.skuAttributes?.[0]?.valueTrans || '';
    }
  };

  // Helper function to get the second attribute value from a SKU
  const getSecondAttributeValue = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format - use the second property value
      return sku.properties?.[1]?.value_name || '';
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - no second attribute for now
      return '';
    } else {
      // 1688 format
      return sku.skuAttributes?.[1]?.valueTrans || '';
    }
  };

  // Helper function to get SKU image
  const getSkuImage = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format
      return sku.pic_url || '';
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - use the image field
      return sku.pic_url || sku.image || '';
    } else {
      // 1688 format
      return sku.skuAttributes?.find((attr: any) => attr.skuImageUrl)?.skuImageUrl || '';
    }
  };

  // Helper function to get SKU price
  const getSkuPrice = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format - use coupon_price if available, otherwise price (both in cents)
      const priceInCents = sku.coupon_price || sku.price || '0';
      return parseFloat(priceInCents) / 100;
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - price is already in the correct unit
      return parseFloat(sku.price || '0');
    } else {
      // 1688 format
      return parseFloat(sku.price || sku.consignPrice || '0');
    }
  };

  // Helper function to get SKU stock
  const getSkuStock = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format
      return sku.quantity || 0;
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - use quantity field
      return sku.quantity || sku.amountOnSale || 0;
    } else {
      // 1688 format
      return sku.amountOnSale || 0;
    }
  };

  // Helper function to get SKU spec ID
  const getSkuSpecId = (sku: any) => {
    if (productSource === 'tb') {
      // Taobao format
      return sku.sku_id || '';
    } else if (productSource === 'local' || productSource === 'chinese') {
      // Local/Chinese format - use id field
      return sku.id?.toString() || sku.sku_id || sku.specId || '';
    } else {
      // 1688 format
      return sku.specId || '';
    }
  };







  // Group by first attribute
  const uniqueFirstAttrs: { [key: string]: any } = {};
  skuList.forEach((item: any) => {
    const attrValue = getFirstAttributeValue(item);
    if (!attrValue) return;
    
    if (!uniqueFirstAttrs[attrValue]) {
      uniqueFirstAttrs[attrValue] = {
        imageUrl: getSkuImage(item),
        attributeName: productSource === 'tb' ? 
          (item.properties?.[0]?.propName || 'Variant') : 
          productSource === 'local' || productSource === 'chinese' ?
          'Variant' :
          (item.skuAttributes?.[0]?.attributeName || 'Variant'),
        valueTrans: attrValue,
        value: attrValue,
      };
    }
  });
  const firstAttrList = Object.values(uniqueFirstAttrs);



  // On mount, select first attribute (keep existing logic for backward compatibility)
  useEffect(() => {
    if (firstAttrList.length > 0 && !selectedFirstAttr) {
      setSelectedFirstAttr(firstAttrList[0].valueTrans);
    }
  }, [apiResponse, firstAttrList.length, productSource]);

  // Get matching SKUs for selected first attribute
  const safeSelectedFirstAttr = selectedFirstAttr || firstAttrList[0]?.valueTrans || '';
  const matchingSKUs = skuList.filter((item: any) => getFirstAttributeValue(item) === safeSelectedFirstAttr);
  





  // Subtotal calculation
  const subtotal = productSource === 'tb' ? 
    (selectedTbVariant ? getTbVariantPrice(selectedTbVariant) * tbQuantity : 0) :
    Object.values(quantityData).reduce((sum, { price, quantity }) => sum + price * quantity, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Details</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerCartButton} onPress={() => router.push('/cart')}>
              <Ionicons name="cart-outline" size={24} color="#333" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerShareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Details</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerCartButton} onPress={() => router.push('/cart')}>
              <Ionicons name="cart-outline" size={24} color="#333" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerShareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.errorContainer}>
          {/* <Text style={styles.errorText}>{error}</Text> */}
          <TouchableOpacity style={styles.retryButton} onPress={fetchProduct}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (localChineseError) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Ionicons name="alert-circle" size={64} color="#ed2027" />
        <Text style={{ fontSize: 18, color: '#ed2027', marginTop: 16, textAlign: 'center' }}>{localChineseError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerCartButton} onPress={() => router.push('/cart')}>
            <Ionicons name="cart-outline" size={24} color="#333" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerShareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
            {/* Response Message Display */}
            {showMessage && (
        <View style={[styles.messageContainer, messageType === 'success' ? styles.successMessage : styles.errorMessage]}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Main Media Slider */}
        {mediaItems.length > 0 && (
          <View style={styles.sliderContainer}>
            <FlatList
              ref={flatListRef}
              data={mediaItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={renderMediaItem}
              keyExtractor={(item, index) => index.toString()}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              style={styles.mediaSlider}
            />
            
            {/* Slide Indicators */}
            {mediaItems.length > 1 && (
              <View style={styles.indicatorsContainer}>
                {mediaItems.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      currentSlideIndex === index && styles.activeIndicator
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
        
        {/* Thumbnails */}
        {renderThumbnails()}
        
        {/* Product Info */}
        {renderProductInfo()}

        {/* Related Products Slider for TB */}
        {productSource === 'tb' && relatedTbProducts.length > 0 && (
          <View style={styles.relatedProductsSection}>
            <Text style={styles.relatedProductsTitle}>{t('product.relatedProducts')}</Text>
            <FlatList
              data={relatedTbProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.item_id?.toString() || item.id?.toString()}
              renderItem={({ item }) => {
                const productId = item.item_id?.toString() || item.id?.toString() || '';
                const originalTitle = item.title || '';
                const displayTitle = language !== 'en' && translatedRelatedProductTitles.has(productId)
                  ? translatedRelatedProductTitles.get(productId)!
                  : originalTitle;
                const isTranslating = language !== 'en' && translatingRelatedProducts.has(productId);
                const titleOpacity = getRelatedProductTitleAnimation(productId);
                
                return (
                  <View style={{ width: 180, marginRight: 12 }}>
                    <ProductCard
                      product={{
                        pid: productId,
                        src: 'tb',
                        title: displayTitle,
                        img: Array.isArray(item.pic_urls) && item.pic_urls.length > 0 ? item.pic_urls[0] : '',
                        price: item.promotion_price ? item.promotion_price / 100 : (item.price ? item.price / 100 : 0),
                        view_count: 0,
                      }}
                      showWishlistButton={true}
                      isInWishlist={wishlistItems.has(productId)}
                      onWishlistToggle={handleWishlistToggle}
                      onPress={() => router.push({ pathname: '/product/[id]', params: { id: productId } })}
                      hideViewCount={true}
                      titleOpacity={language !== 'en' ? titleOpacity : undefined}
                      showTranslating={isTranslating}
                    />
                  </View>
                );
              }}
            />
          </View>
        )}
        {/* Related Products Slider for 1688 */}
        {productSource === '1688' && relatedProducts.length > 0 && (
          <View style={styles.relatedProductsSection}>
            <Text style={styles.relatedProductsTitle}>{t('product.relatedProducts')}</Text>
            <FlatList
              data={relatedProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.offerId.toString()}
              renderItem={({ item }) => {
                const productId = item.offerId.toString();
                const originalTitle = item.subjectTrans || item.subject;
                const displayTitle = language !== 'en' && translatedRelatedProductTitles.has(productId)
                  ? translatedRelatedProductTitles.get(productId)!
                  : originalTitle;
                const isTranslating = language !== 'en' && translatingRelatedProducts.has(productId);
                const titleOpacity = getRelatedProductTitleAnimation(productId);
                
                return (
                  <View style={{ width: 180, marginRight: 12 }}>
                    <ProductCard
                      product={{
                        pid: productId,
                        src: '1688',
                        title: displayTitle,
                        img: item.imageUrl,
                        price: parseFloat(item.priceInfo?.price || '0'),
                        view_count: 0,
                      }}
                      showWishlistButton={true}
                      isInWishlist={wishlistItems.has(productId)}
                      onWishlistToggle={handleWishlistToggle}
                      onPress={() => router.push({ pathname: '/product/[id]', params: { id: productId } })}
                      hideViewCount={true}
                      titleOpacity={language !== 'en' ? titleOpacity : undefined}
                      showTranslating={isTranslating}
                    />
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Product Details Tabs Section */}
        {productSource === '1688' && (
          <View style={styles.productDetailsTabsSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.tabsContainer}
              contentContainerStyle={styles.tabsContentContainer}
            >
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'description' && styles.activeTabButton]}
                onPress={() => setActiveTab('description')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'description' && styles.activeTabButtonText]}>
                  {t('product.description')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'specifications' && styles.activeTabButton]}
                onPress={() => setActiveTab('specifications')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'specifications' && styles.activeTabButtonText]}>
                  {t('product.specifications')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'vendor' && styles.activeTabButton]}
                onPress={() => setActiveTab('vendor')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'vendor' && styles.activeTabButtonText]}>
                  {t('product.vendorCatalog')}
                </Text>
              </TouchableOpacity>
              
            </ScrollView>
            
            <View style={styles.tabContent}>
              {activeTab === 'description' && (
                <View style={styles.descriptionTab}>
                  {apiResponse?.product?.description ? (
                    <View>
                      {/* Extract and display images from HTML */}
                      {(() => {
                        const desc = apiResponse.product.description;
                        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
                        const images: string[] = [];
                        let match;
                        
                        while ((match = imgRegex.exec(desc)) !== null) {
                          if (match[1] && !match[1].includes('spaceball.gif') && !match[1].includes('desc_anchor')) {
                            images.push(match[1]);
                          }
                        }
                        
                        return images.length > 0 ? (
                          <View style={styles.imagesContainer}>
                            {images.map((imgSrc, index) => (
                              <Image
                                key={index}
                                source={{ uri: imgSrc }}
                                style={styles.descriptionImage}
                                resizeMode="contain"
                              />
                            ))}
                          </View>
                        ) : null;
                      })()}
                      
                      {/* Extract meaningful text content */}
                      <Text style={styles.descriptionText}>
                        {(() => {
                          const desc = apiResponse.product.description;
                          // Extract text content more intelligently
                          const textContent = desc
                            .replace(/<div[^>]*>.*?<\/div>/g, '') // Remove div tags and content
                            .replace(/<img[^>]*>/g, '') // Remove img tags
                            .replace(/<br[^>]*>/g, '\n') // Replace br with newlines
                            .replace(/<p[^>]*>/g, '') // Remove p opening tags
                            .replace(/<\/p>/g, '\n\n') // Replace p closing tags with double newlines
                            .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
                            .replace(/&nbsp;/g, ' ') // Replace HTML entities
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
                            .trim();
                          
                          return textContent || '';
                        })()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noDescriptionText}>
                      {t('product.noDescriptionFallback')}
                    </Text>
                  )}
                  
                  {/* Fallback to subject if no description */}
                  {!apiResponse?.product?.description && apiResponse?.product?.subjectTrans && (
                    <View style={styles.fallbackDescription}>
                      <Text style={styles.fallbackTitle}>{t('product.productInformation')}:</Text>
                      <Text style={styles.descriptionText}>
                        {apiResponse.product.subjectTrans}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {activeTab === 'specifications' && (
                <View style={styles.specificationsTab}>
                  {apiResponse?.product?.productAttribute ? (
                    <View>
                      <View style={styles.attributesContainer}>
                        {apiResponse.product.productAttribute.map((attr: any, index: number) => {
                          const translatedSpec = language !== 'en' && translatedSpecifications.has(index)
                            ? translatedSpecifications.get(index)!
                            : null;
                          const displayAttributeName = translatedSpec
                            ? translatedSpec.attributeName
                            : (attr.attributeNameTrans || attr.attributeName);
                          const displayValue = translatedSpec
                            ? translatedSpec.value
                            : (attr.valueTrans || attr.value);
                          const isTranslating = language !== 'en' && translatingSpecifications.has(index);
                          const specOpacity = language !== 'en' ? getSpecificationAnimation(index) : undefined;
                          
                          return (
                            <View key={index} style={styles.attributeRow}>
                              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                {specOpacity ? (
                                  <Animated.Text 
                                    style={[
                                      styles.attributeName,
                                      { opacity: specOpacity }
                                    ]}
                                  >
                                    {displayAttributeName}:
                                  </Animated.Text>
                                ) : (
                                  <Text style={styles.attributeName}>
                                    {displayAttributeName}:
                                  </Text>
                                )}
                                {specOpacity ? (
                                  <Animated.Text 
                                    style={[
                                      styles.attributeValue,
                                      { opacity: specOpacity }
                                    ]}
                                  >
                                    {displayValue}
                                  </Animated.Text>
                                ) : (
                                  <Text style={styles.attributeValue}>
                                    {displayValue}
                                  </Text>
                                )}
                              </View>
                              {isTranslating && (
                                <Text style={styles.translatingTextSpec}>Translating</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noSpecificationsContainer}>
                      <Text style={styles.noSpecificationsText}>{t('product.noSpecificationsTitle')}</Text>
                      <Text style={styles.noSpecificationsSubtext}>
                        {t('product.noSpecificationsSubtitle')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'vendor' && (
                <View style={styles.vendorTab}>
                  {apiResponse?.product?.sellerDataInfo ? (
                    <View>
                      {/* Vendor Metrics Grid */}
                      <View style={styles.vendorMetricsGrid}>
                        {/* Trade Score */}
                        <View style={styles.vendorMetric}>
                          <View style={styles.vendorMetricIcon}>
                            <Ionicons name="star" size={20} color="#FFD700" />
                          </View>
                          <Text style={[styles.vendorMetricValue, getScoreColor(apiResponse.product.tradeScore || 0)]}>
                            {apiResponse.product.tradeScore || "N/A"}
                          </Text>
                          <Text style={styles.vendorMetricLabel}>{t('product.overallRating')}</Text>
                        </View>

                        {/* Service Score */}
                        <View style={styles.vendorMetric}>
                          <View style={styles.vendorMetricIcon}>
                            <Ionicons name="shield" size={20} color="#E53E3E" />
                          </View>
                          <Text style={[styles.vendorMetricValue, getScoreColor(apiResponse.product.sellerDataInfo.compositeServiceScore || 0)]}>
                            {apiResponse.product.sellerDataInfo.compositeServiceScore || "N/A"}
                          </Text>
                          <Text style={styles.vendorMetricLabel}>{t('product.serviceScore')}</Text>
                        </View>

                        {/* Logistics Score */}
                        <View style={styles.vendorMetric}>
                          <View style={styles.vendorMetricIcon}>
                            <Ionicons name="car" size={20} color="#4CAF50" />
                          </View>
                          <Text style={[styles.vendorMetricValue, getScoreColor(apiResponse.product.sellerDataInfo.logisticsExperienceScore || 0)]}>
                            {apiResponse.product.sellerDataInfo.logisticsExperienceScore || "N/A"}
                          </Text>
                          <Text style={styles.vendorMetricLabel}>{t('product.logisticsScore')}</Text>
                        </View>

                        {/* Medal Level */}
                        <View style={styles.vendorMetric}>
                          <View style={styles.vendorMetricIcon}>
                            <Ionicons name="trophy" size={20} color="#9C27B0" />
                          </View>
                          <Text style={[styles.vendorMetricValue, { color: '#9C27B0' }]}>
                            {apiResponse.product.sellerDataInfo.tradeMedalLevel || "N/A"}
                          </Text>
                          <Text style={styles.vendorMetricLabel}>{t('product.medalLevel')}</Text>
                        </View>
                      </View>

                      {/* Additional Metrics */}
                      <View style={styles.additionalMetricsContainer}>
                        <View style={styles.additionalMetric}>
                          <Text style={styles.additionalMetricLabel}>{t('product.repurchaseRate')}</Text>
                          <Text style={[styles.additionalMetricValue, getPercentageColor(apiResponse.product.sellerDataInfo?.repeatPurchasePercent || 0)]}>
                            {apiResponse.product.repurchaseRate 
                              ? (typeof apiResponse.product.repurchaseRate === 'string' 
                                  ? apiResponse.product.repurchaseRate 
                                  : `${apiResponse.product.repurchaseRate}%`)
                              : (apiResponse.product.sellerDataInfo && apiResponse.product.sellerDataInfo.repeatPurchasePercent
                                  ? `${(Number.parseFloat(apiResponse.product.sellerDataInfo.repeatPurchasePercent) * 100).toFixed(1)}%`
                                  : "N/A")}
                          </Text>
                        </View>

                        {apiResponse.product.monthSold && (
                          <View style={styles.additionalMetric}>
                            <Text style={styles.additionalMetricLabel}>{t('search.stats.sold')}</Text>
                            <Text style={[styles.additionalMetricValue, { color: '#4CAF50' }]}>
                              {apiResponse.product.monthSold.toLocaleString()}
                            </Text>
                          </View>
                        )}

                        <View style={styles.additionalMetric}>
                          <Text style={styles.additionalMetricLabel}>{t('product.delivery48hRate')}</Text>
                          <Text style={[styles.additionalMetricValue, getPercentageColor(apiResponse.product.sellerDataInfo.collect30DayWithin48HPercent || 0)]}>
                            {apiResponse.product.sellerDataInfo.collect30DayWithin48HPercent
                              ? `${(Number.parseFloat(apiResponse.product.sellerDataInfo.collect30DayWithin48HPercent) * 100).toFixed(1)}%`
                              : "N/A"}
                          </Text>
                        </View>

                        <View style={styles.additionalMetric}>
                          <Text style={styles.additionalMetricLabel}>{t('product.qualityRefundRate')}</Text>
                          <Text style={[styles.additionalMetricValue, getQualityRefundColor(apiResponse.product.sellerDataInfo.qualityRefundWithin30Day || 0)]}>
                            {apiResponse.product.sellerDataInfo.qualityRefundWithin30Day
                              ? `${(Number.parseFloat(apiResponse.product.sellerDataInfo.qualityRefundWithin30Day) * 100).toFixed(2)}%`
                              : "N/A"}
                          </Text>
                        </View>
                      </View>

                      {/* More from this Vendor */}
                      <View style={styles.vendorProductsSection}>
                        <Text style={styles.vendorProductsTitle}>{t('product.moreFromVendor')}</Text>
                        
                        {vendorProductsLoading && (
                          <View style={styles.vendorProductsLoading}>
                            <View style={styles.vendorProductsGrid}>
                              {Array.from({ length: 6 }).map((_, index) => (
                                <View key={index} style={styles.vendorProductCard}>
                                  <View style={styles.vendorProductSkeleton}>
                                    <View style={styles.skeletonImage} />
                                    <View style={styles.skeletonTitle} />
                                    <View style={styles.skeletonPrice} />
                                  </View>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        
                        {vendorProductsError && (
                          <Text style={styles.vendorProductsError}>{vendorProductsError}</Text>
                        )}
                        
                        {!vendorProductsLoading && !vendorProductsError && vendorProducts.length > 0 && (
                          <View style={styles.vendorProductsGrid}>
                            {vendorProducts.map((item) => (
                              <View key={item.offerId} style={styles.vendorProductCard}>
                                <ProductCard
                                  product={{
                                    pid: item.offerId.toString(),
                                    src: '1688',
                                    title: item.subjectTrans || item.subject,
                                    img: item.imageUrl,
                                    price: parseFloat(item.priceInfo?.price || '0'),
                                    view_count: 0,
                                    monthSold: item.monthSold,
                                    repurchaseRate: item.repurchaseRate,
                                  }}
                                  showWishlistButton={true}
                                  isInWishlist={wishlistItems.has(item.offerId.toString())}
                                  onWishlistToggle={handleWishlistToggle}
                                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.offerId.toString() } })}
                                  hideViewCount={true}
                                />
                              </View>
                            ))}
                          </View>
                        )}
                        
                        {!vendorProductsLoading && !vendorProductsError && vendorProducts.length === 0 && (
                          <Text style={styles.noVendorProductsText}>{t('product.noOtherProductsForVendor')}</Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noVendorContainer}>
                      <Text style={styles.noVendorText}>{t('product.noVendorInfo')}</Text>
                      <Text style={styles.noVendorSubtext}>
                        {t('product.vendorDetailsWillAppear')}
                      </Text>
                    </View>
                  )}
                </View>
              )}


            </View>
          </View>
        )}

{productSource !== '1688' && (
          <View style={styles.productDetailsTabsSection}>
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tabButtontb, activeTab === 'description' && styles.activeTabButton]}
                onPress={() => setActiveTab('description')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'description' && styles.activeTabButtonText]}>
                  Description
                </Text>
              </TouchableOpacity>          
            </View>
            
            <View style={styles.tabContent}>
              {activeTab === 'description' && (
                <View style={styles.descriptionTab}>
                  {apiResponse?.product?.description ? (
                    <View>
                      {/* Extract and display images from HTML */}
                      {(() => {
                        const desc = apiResponse.product.description;
                        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
                        const images: string[] = [];
                        let match;
                        
                        while ((match = imgRegex.exec(desc)) !== null) {
                          if (match[1] && !match[1].includes('spaceball.gif') && !match[1].includes('desc_anchor')) {
                            images.push(match[1]);
                          }
                        }
                        
                        return images.length > 0 ? (
                          <View style={styles.imagesContainer}>
                            {images.map((imgSrc, index) => (
                              <Image
                                key={index}
                                source={{ uri: imgSrc }}
                                style={styles.descriptionImage}
                                resizeMode="contain"
                              />
                            ))}
                          </View>
                        ) : null;
                      })()}
                      
                      {/* Extract meaningful text content */}
                      <Text style={styles.descriptionText}>
                        {(() => {
                          const desc = apiResponse.product.description;
                          // Extract text content more intelligently
                          const textContent = desc
                            .replace(/<div[^>]*>.*?<\/div>/g, '') // Remove div tags and content
                            .replace(/<img[^>]*>/g, '') // Remove img tags
                            .replace(/<br[^>]*>/g, '\n') // Replace br with newlines
                            .replace(/<p[^>]*>/g, '') // Remove p opening tags
                            .replace(/<\/p>/g, '\n\n') // Replace p closing tags with double newlines
                            .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
                            .replace(/&nbsp;/g, ' ') // Replace HTML entities
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
                            .trim();
                          
                          return textContent || '';
                        })()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noDescriptionText}>
                      No description available. Using subject as fallback.
                    </Text>
                  )}
                  
                  {/* Fallback to subject if no description */}
                  {!apiResponse?.product?.description && apiResponse?.product?.subjectTrans && (
                    <View style={styles.fallbackDescription}>
                      <Text style={styles.fallbackTitle}>{t('product.productInformation')}:</Text>
                      <Text style={styles.descriptionText}>
                        {apiResponse.product.subjectTrans}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
            


            </View>
          </View>
        )}

        {/* You May Also Like Section */}
        {productSource === '1688' && youMayAlsoLikeProducts.length > 0 && (
          <View style={styles.youMayAlsoLikeSection}>
            <Text style={styles.youMayAlsoLikeTitle}>{t('product.youMayAlsoLike')}</Text>
            <FlatList
              data={youMayAlsoLikeProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.offerId.toString()}
              renderItem={({ item }) => {
                const productId = item.offerId.toString();
                const originalTitle = item.subjectTrans || item.subject;
                const displayTitle = language !== 'en' && translatedYouMayAlsoLikeTitles.has(productId)
                  ? translatedYouMayAlsoLikeTitles.get(productId)!
                  : originalTitle;
                const isTranslating = language !== 'en' && translatingYouMayAlsoLike.has(productId);
                const titleOpacity = getYouMayAlsoLikeTitleAnimation(productId);
                
                return (
                  <View style={{ width: 180, marginRight: 12 }}>
                    <ProductCard
                      product={{
                        pid: productId,
                        src: '1688',
                        title: displayTitle,
                        img: item.imageUrl,
                        price: parseFloat(item.priceInfo?.price || '0'),
                        view_count: 0,
                        monthSold: item.monthSold,
                        repurchaseRate: item.repurchaseRate,
                      }}
                      showWishlistButton={true}
                      isInWishlist={wishlistItems.has(productId)}
                      onWishlistToggle={handleWishlistToggle}
                      onPress={() => router.push({ pathname: '/product/[id]', params: { id: productId } })}
                      hideViewCount={true}
                      titleOpacity={language !== 'en' ? titleOpacity : undefined}
                      showTranslating={isTranslating}
                    />
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Product Information Accordion Section */}
        <View style={styles.accordionSection}>
          {/* Return Policy Accordion */}
          <View style={styles.accordionItem}>
            <TouchableOpacity 
              style={styles.accordionHeader}
              onPress={() => setAccordionStates(prev => ({ ...prev, return: !prev.return }))}
            >
              <Text style={styles.accordionHeaderText}>{t('productAccordion.returnPolicy.title')}</Text>
              <Ionicons 
                name={accordionStates.return ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            {accordionStates.return && (
              <View style={styles.accordionContent}>
                <View style={styles.returnSection}>
                  <Text style={styles.returnText}>
                    {t('productAccordion.returnPolicy.p1')}
                  </Text>
                  <Text style={styles.returnText}>
                    {t('productAccordion.returnPolicy.p2')}
                  </Text>
                </View>

                <View style={styles.returnSection}>
                  <Text style={styles.returnSectionTitle}>{t('productAccordion.returnPolicy.refundsTitle')}</Text>
                  <Text style={styles.returnText}>
                    {t('productAccordion.returnPolicy.p3')}
                  </Text>
                  <Text style={styles.returnText}>
                    {t('productAccordion.returnPolicy.p4')}
                  </Text>
                </View>

                <View style={styles.returnSection}>
                  <Text style={styles.returnSectionTitle}>{t('productAccordion.returnPolicy.shippingTitle')}</Text>
                  <Text style={styles.returnText}>
                    {t('productAccordion.returnPolicy.p5')}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Delivery & Payment Accordion */}
          <View style={styles.accordionItem}>
            <TouchableOpacity 
              style={styles.accordionHeader}
              onPress={() => setAccordionStates(prev => ({ ...prev, delivery: !prev.delivery }))}
            >
              <Text style={styles.accordionHeaderText}>{t('productAccordion.delivery.title')}</Text>
              <Ionicons 
                name={accordionStates.delivery ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            {accordionStates.delivery && (
              <View style={styles.accordionContent}>
                 {/* Shipping Information */}
                 {apiResponse?.product?.productShippingInfo && (
                  <View style={styles.shippingInfoContainer}>
                    <Text style={styles.shippingInfoTitle}>{t('productAccordion.delivery.infoTitle')}</Text>
                    
                    <View style={styles.shippingInfoGrid}>
                      {/* Shipping From */}
                      <View style={styles.shippingInfoItem}>
                        <Ionicons name="cube-outline" size={20} color="#E53E3E" />
                        <View style={styles.shippingInfoContent}>
                          <Text style={styles.shippingInfoLabel}>{t('productAccordion.delivery.shipsFrom')}</Text>
                          <Text style={styles.shippingInfoValue}>
                            {apiResponse.product.productShippingInfo.sendGoodsAddressText || t('common.notSpecified')}
                          </Text>
                        </View>
                      </View>

                      {/* Shipping Time */}
                      <View style={styles.shippingInfoItem}>
                        <Ionicons name="time-outline" size={20} color="#22C55E" />
                        <View style={styles.shippingInfoContent}>
                          <Text style={styles.shippingInfoLabel}>{t('productAccordion.delivery.shippingTimeFromSupplier')}</Text>
                          <Text style={styles.shippingInfoValue}>
                            {apiResponse.product.productShippingInfo.shippingTimeGuarantee === 'shipIn48Hours'
                              ? t('productAccordion.delivery.shipsIn48Hours')
                              : t('productAccordion.delivery.standardShippingTime')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Product Weight */}
                    {apiResponse.product.productShippingInfo.weight && (
                      <View style={styles.productWeightContainer}>
                        <View style={styles.productWeightItem}>
                          <Ionicons name="cube-outline" size={16} color="#666" />
                          <Text style={styles.productWeightText}>
                            {t('productAccordion.delivery.productWeight', { weight: apiResponse.product.productShippingInfo.weight })}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.deliverySection}>
                  <Text style={styles.deliveryText}>
                    {t('productAccordion.delivery.processIntro')}
                  </Text>
                </View>

               
                <View style={styles.deliverySection}>
                  <Text style={styles.deliveryPhaseTitle}>{t('productAccordion.delivery.phase1Title')}</Text>
                  
                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.s1Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s1b1')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s1b2')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s1b3')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s1b4')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s1b5')}</Text>
                  </View>

                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.s2Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s2bIntro')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.s2b1')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.s2b2')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.s2b3')}</Text>
                  </View>

                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.s3Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s3b1')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s3b2')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.s3b3')}</Text>
                  </View>
                </View>

                <View style={styles.deliverySection}>
                  <Text style={styles.deliveryPhaseTitle}>{t('productAccordion.delivery.phase2Title')}</Text>
                  
                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.p2s1Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s1b1')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s1b2')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s1b3')}</Text>
                  </View>

                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.p2s2Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s2b1')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s2b2')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.p2s2b2a')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.p2s2b2b')}</Text>
                    <Text style={styles.deliveryStepText}>  - {t('productAccordion.delivery.p2s2b2c')}</Text>
                  </View>

                  <View style={styles.deliveryStep}>
                    <Text style={styles.deliveryStepTitle}>{t('productAccordion.delivery.p2s3Title')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s3b1')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s3b2')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s3b3')}</Text>
                    <Text style={styles.deliveryStepText}>• {t('productAccordion.delivery.p2s3b4')}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Sensitive Products Accordion */}
          <View style={styles.accordionItem}>
            <TouchableOpacity 
              style={styles.accordionHeader}
              onPress={() => setAccordionStates(prev => ({ ...prev, sensitive: !prev.sensitive }))}
            >
              <Text style={styles.accordionHeaderText}>{t('productAccordion.sensitive.title')}</Text>
              <Ionicons 
                name={accordionStates.sensitive ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            {accordionStates.sensitive && (
              <View style={styles.accordionContent}>
                <View style={styles.sensitiveWarning}>
                  <Text style={styles.sensitiveWarningText}>
                    {t('productAccordion.sensitive.warning')}
                  </Text>
                </View>

                <View style={styles.sensitiveIconsContainer}>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>🚬</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>💊</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>🔥</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>💣</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>✂️</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>💄</Text>
                  </View>
                  <View style={styles.sensitiveIcon}>
                    <Text style={styles.sensitiveIconText}>🧪</Text>
                  </View>
                </View>

                <View style={styles.sensitiveDivider} />

                <Text style={styles.sensitiveListTitle}>{t('productAccordion.sensitive.listTitle')}</Text>
                <Text style={styles.sensitiveListText}>
                  {t('productAccordion.sensitive.listBody')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* API Response (hidden for now) */}
        {/* <View style={styles.apiResponseContainer}>
          <Text style={styles.apiResponseTitle}>API Response:</Text>
          <Text style={styles.apiResponseText}>
            {JSON.stringify(apiResponse, null, 2)}
          </Text>
        </View> */}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
                      <TouchableOpacity style={styles.bottomBarButton} onPress={() => router.push('/')}>
              <Ionicons name="home-outline" size={24} color="#333" />
            </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bottomBarButton, isInWishlist && styles.bottomWishlistButtonActive]} 
            onPress={() => {
              
              // Check for required ID based on product source
              const requiredId = productSource === 'tb' ? apiResponse?.product?.item_id : 
                                 productSource === 'local' || productSource === 'chinese' ? apiResponse?.product?.id :
                                 apiResponse?.product?.offerId;
              if (!requiredId) {
                showResponseMessage(t('product.productInformationNotAvailable'), 'error');
                return;
              }
              
              console.log('Complete product data:', apiResponse.product);
              console.log('Product source:', productSource);
              console.log('Product fields:', {
                item_id: apiResponse.product.item_id,
                offerId: apiResponse.product.offerId,
                src: apiResponse.product.src,
                productImage: apiResponse.product.productImage,
                mainImage: apiResponse.product.mainImage,
                img: apiResponse.product.img,
                pic_urls: apiResponse.product.pic_urls,
                subjectTrans: apiResponse.product.subjectTrans,
                subject: apiResponse.product.subject,
                productSkuInfos: apiResponse.product.productSkuInfos
              });
              
              const productData = {
                pid: requiredId.toString(),
                src: productSource,
                img: (() => {
                  if (productSource === 'tb') {
                    // For tb products, use first image from pic_urls array
                    const image = apiResponse.product.pic_urls?.[0] || 
                                 apiResponse.product.img ||
                                 'https://via.placeholder.com/300x300?text=No+Image';
                    return image;
                  } else if (productSource === 'local' || productSource === 'chinese') {
                    // For local/chinese products, use first image from images array
                    const baseImage = Array.isArray(apiResponse.product.images) && apiResponse.product.images.length > 0 ? apiResponse.product.images[0] : '';
                    const resolvedImage = typeof baseImage === 'string' ? 
                      (baseImage.startsWith('http') ? baseImage : `https://merchants.wanslu.shop/${baseImage}`) : 
                      (baseImage?.imageUrl || '');
                    return resolvedImage || 'https://via.placeholder.com/300x300?text=No+Image';
                  } else {
                    // For 1688 products, use existing logic
                    const image = apiResponse.product.productImage?.images?.[0] || 
                                 apiResponse.product.mainImage || 
                                 apiResponse.product.img ||
                                 'https://via.placeholder.com/300x300?text=No+Image';
                    return image;
                  }
                })(),
                title: (() => {
                  // Try multiple title sources
                  const title1 = apiResponse.product.subjectTrans;
                  const title2 = apiResponse.product.subject;
                  const title3 = apiResponse.product.title;
                  const title4 = apiResponse.product.name;
                  
                  console.log('Title sources:', { title1, title2, title3, title4 });
                  
                  const finalTitle = title1 || title2 || title3 || title4 || 'Product';
                  console.log('Final title:', finalTitle);
                  return finalTitle;
                })(),
                price: (() => {
                  // Try multiple price sources
                  const price1 = apiResponse.product.productSkuInfos?.[0]?.price;
                  const price2 = apiResponse.product.productSkuInfos?.[0]?.consignPrice;
                  const price3 = apiResponse.product.price;
                  const price4 = apiResponse.product.priceInfo?.price;
                  const price5 = apiResponse.variants?.[0]?.price;
                  
                  console.log('Price sources:', { price1, price2, price3, price4, price5});
                  
                  const price = parseFloat(price1 || price2 || price3 || price4 || '0');
                  const finalPrice = isNaN(price) ? 0 : price;
                  
                  console.log('Final price:', finalPrice);
                  if (productSource === 'tb') {
                    return finalPrice / 100;
                  } else {
                    return finalPrice;
                  }
                })()
              };
              
              // Validate required fields
              if (!productData.pid || !productData.title || productData.price === 0) {
                showResponseMessage(t('product.productInformationIncomplete'), 'error');
                console.log('Product data is incomplete:', productData);
                return;
              }
              
              console.log('Calling wishlist toggle with:', productData);
              handleWishlistToggle(productData);
            }}
            disabled={wishlistCheckLoading}
          >
            {wishlistCheckLoading ? (
              <ActivityIndicator size="small" color="#E53E3E" />
            ) : (
              <Ionicons 
                name={isInWishlist ? "heart" : "heart-outline"} 
                size={24} 
                color={isInWishlist ? "#E53E3E" : "#333"} 
              />
            )}
          </TouchableOpacity>
          
        </View>
        
        <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
          <Text style={styles.addToCartButtonText}>{t('product.addToCart')}</Text>
        </TouchableOpacity>
      </View>

      {/* Add to Cart Dropup Modal */}
      <Modal
        isVisible={showAddToCartSheet}
        onBackdropPress={handleCloseAddToCartSheet}
        onBackButtonPress={handleCloseAddToCartSheet}
        style={{ margin: 0 }}
        backdropOpacity={0.4}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        useNativeDriver
      >
        <View style={styles.addToCartModalRoot}>
          {showImagePopup && (
            <View style={styles.imagePopupOverlay}>
              <TouchableWithoutFeedback onPress={closeImagePopup}>
                <View style={styles.imagePopupBackdrop} />
              </TouchableWithoutFeedback>
              <View style={styles.imagePopupContainer}>
                <TouchableOpacity
                  style={styles.imagePopupCloseButton}
                  onPress={closeImagePopup}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Image
                  source={{
                    uri: popupImageUri || (
                      productSource === 'tb' ?
                        (selectedTbVariant ? getTbVariantImage(selectedTbVariant) : apiResponse?.product?.pic_urls?.[0]) :
                        productSource === 'local' || productSource === 'chinese' ?
                        (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl ||
                         (Array.isArray(apiResponse?.product?.images) && apiResponse?.product?.images.length > 0 ?
                          (apiResponse.product.images[0].startsWith('http') ? apiResponse.product.images[0] : `https://merchants.wanslu.shop/${apiResponse.product.images[0]}`) :
                          'https://via.placeholder.com/100x100?text=No+Image')) :
                        (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl || apiResponse?.product?.mainImage) ||
                        apiResponse?.product?.img ||
                        'https://via.placeholder.com/100x100?text=No+Image'
                    )
                  }}
                  style={styles.imagePopupImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}
          <View style={[styles.addToCartSheetContainer, { maxHeight: '90%' }]}>  
          {/* Top section: selected image, name, price, stock, close btn */}
          <View style={styles.addToCartSheetHeader}>
            <TouchableOpacity 
              onPress={() => {
                // Set popup image based on current selection
                const imageUri = productSource === 'tb' ? 
                  (selectedTbVariant ? getTbVariantImage(selectedTbVariant) : apiResponse?.product?.pic_urls?.[0]) : 
                  productSource === 'local' || productSource === 'chinese' ?
                  (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl || 
                   (Array.isArray(apiResponse?.product?.images) && apiResponse?.product?.images.length > 0 ? 
                    (apiResponse.product.images[0].startsWith('http') ? apiResponse.product.images[0] : `https://merchants.wanslu.shop/${apiResponse.product.images[0]}`) : 
                    'https://via.placeholder.com/100x100?text=No+Image')) :
                  (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl || apiResponse?.product?.mainImage) || 
                  apiResponse?.product?.img || 
                  'https://via.placeholder.com/100x100?text=No+Image';
                setPopupImageUri(imageUri);
                setShowImagePopup(true);
              }}
              activeOpacity={0.8}
            >
              <Image 
                source={{ 
                  uri: productSource === 'tb' ? 
                    (selectedTbVariant ? getTbVariantImage(selectedTbVariant) : apiResponse?.product?.pic_urls?.[0]) : 
                    productSource === 'local' || productSource === 'chinese' ?
                    (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl || 
                     (Array.isArray(apiResponse?.product?.images) && apiResponse?.product?.images.length > 0 ? 
                      (apiResponse.product.images[0].startsWith('http') ? apiResponse.product.images[0] : `https://merchants.wanslu.shop/${apiResponse.product.images[0]}`) : 
                      'https://via.placeholder.com/100x100?text=No+Image')) :
                    (uniqueFirstAttrs[safeSelectedFirstAttr]?.imageUrl || apiResponse?.product?.mainImage) || 
                    apiResponse?.product?.img || 
                    'https://via.placeholder.com/100x100?text=No+Image' 
                }} 
                style={styles.addToCartSheetImage} 
              />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.addToCartSheetTitle} numberOfLines={2}>
                {productSource === 'tb' ? 
                  (apiResponse?.product?.title || apiResponse?.product?.name || 'Product') : 
                  (apiResponse?.product?.subjectTrans || apiResponse?.product?.subject || 'Product')
                }
              </Text>
              <Text style={styles.addToCartSheetPrice}>
                {convertPrice(productSource === 'tb' ? 
                  (selectedTbVariant ? getTbVariantPrice(selectedTbVariant).toFixed(2) : '0.00') : 
                  (matchingSKUs.length > 0 ? getSkuPrice(matchingSKUs[0]).toFixed(2) : '0.00'))}
              </Text>
              <Text style={styles.addToCartSheetStock}>
                In stock: {productSource === 'tb' ? 
                  (selectedTbVariant ? getTbVariantStock(selectedTbVariant) : '0') : 
                  (matchingSKUs.length > 0 ? getSkuStock(matchingSKUs[0]) : '0')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCloseAddToCartSheet} style={styles.addToCartSheetCloseBtn}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          {(productSource === '1688' || productSource === 'local' || productSource === 'chinese') && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addToCartSheetThumbnailsRow}>
            {firstAttrList.map((attribute: any, index: number) => {
              const totalQuantity = Object.keys(quantityData)
                .filter(k => k.startsWith(attribute.valueTrans))
                .reduce((acc, k) => acc + (quantityData[k]?.quantity || 0), 0);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.addToCartSheetThumbnailWrap, selectedFirstAttr === attribute.valueTrans && styles.addToCartSheetThumbnailSelected]}
                  onPress={() => setSelectedFirstAttr(attribute.valueTrans)}
                >
                  {attribute.imageUrl?.trim() ? (
                    <Image source={{ uri: attribute.imageUrl }} style={styles.addToCartSheetThumbnail} />
                  ) : (
                    <View style={{ width: 56, height: 56, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee', borderRadius: 8 }}>
                      <Text>{attribute.valueTrans}</Text>
                    </View>
                  )}
                  {totalQuantity > 0 && (
                    <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: 'red', borderRadius: 8, paddingHorizontal: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>{totalQuantity}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          )}
                    {/* Simple variant selection for tb products */}
          {productSource === 'tb' && (
            <ScrollView 
              style={{ maxHeight: 300, paddingHorizontal: 16, marginTop: 8 }}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' }}>
                Select Variant:
              </Text>
              {skuList.map((sku: any, index: number) => {
                const variantImageUri = getTbVariantImage(sku) || 'https://via.placeholder.com/60x60?text=No+Image';
                const isSelected = selectedTbVariant?.sku_id === sku.sku_id;
                return (
                  <View
                    key={index}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderWidth: 2,
                        borderColor: '#ddd',
                        borderRadius: 8,
                        marginBottom: 8,
                        backgroundColor: '#f8f8f8',
                      },
                      isSelected && {
                        borderColor: '#E53E3E',
                        backgroundColor: '#FEE',
                      }
                    ]}
                  >
                    {/* Variant Image - Clickable to open popup */}
                    <View style={{ marginRight: 12 }}>
                      <TouchableOpacity 
                        onPress={() => {
                          setPopupImageUri(variantImageUri);
                          setShowImagePopup(true);
                        }}
                        activeOpacity={0.8}
                        style={{ width: 60, height: 60 }}
                      >
                        <Image 
                          source={{ uri: variantImageUri }} 
                          style={{ width: 60, height: 60, borderRadius: 6 }}
                        />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Variant Details - Clickable to select variant */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedTbVariant(sku);
                      }}
                      activeOpacity={0.7}
                      style={{ flex: 1 }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '500', 
                          color: '#333',
                          marginBottom: 4 
                        }}>
                          {sku.properties?.[0]?.value_name || 'Variant'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                          Stock: {getTbVariantStock(sku)}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#E53E3E' }}>
                         {convertPrice(getTbVariantPrice(sku).toFixed(2))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Selection Indicator */}
                    {isSelected && (
                      <View style={{ 
                        width: 20, 
                        height: 20, 
                        borderRadius: 10, 
                        backgroundColor: '#E53E3E',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
          {/* Quantity selector for selected variant */}
          <ScrollView style={{ maxHeight: 150, marginTop: 8 }}>
            {productSource === 'tb' ? (
              // For tb products, show simple quantity selector
              selectedTbVariant && (
                <View style={styles.addToCartSheetOptionRow}>
                  <Text style={styles.addToCartSheetOptionLabel}>
                    Selected: {selectedTbVariant.properties?.[0]?.value_name || 'Variant'}
                  </Text>
                  <Text style={styles.addToCartSheetOptionValue}>
                    {convertPrice((getTbVariantPrice(selectedTbVariant) * currencyRate).toFixed(2))}
                  </Text>
                  <Text style={styles.addToCartSheetOptionStock}>
                    Stock: {getTbVariantStock(selectedTbVariant)}
                  </Text>
                  <View style={styles.addToCartSheetQtySelector}>
                    <TouchableOpacity
                      style={styles.addToCartSheetQtyBtn}
                      onPress={() => setTbQuantity(prev => Math.max(1, prev - 1))}
                      disabled={tbQuantity <= 1}
                    >
                      <Text style={styles.addToCartSheetQtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.addToCartSheetQtyValue}>{tbQuantity}</Text>
                    <TouchableOpacity
                      style={styles.addToCartSheetQtyBtn}
                      onPress={() => setTbQuantity(prev => Math.min(getTbVariantStock(selectedTbVariant), prev + 1))}
                      disabled={tbQuantity >= getTbVariantStock(selectedTbVariant)}
                    >
                      <Text style={styles.addToCartSheetQtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : (
              // For 1688 products, use existing logic
              matchingSKUs.length > 0 ? (
                matchingSKUs.map((item: any, idx: number) => {
                  const price = getSkuPrice(item);
                  const stock = getSkuStock(item);
                  const firstAttr = getFirstAttributeValue(item);
                  const secondAttr = getSecondAttributeValue(item);
                  const compositeKey = `${firstAttr}_${secondAttr}`;
                  const quantity = quantityData[compositeKey]?.quantity || 0;
                  return (
                    <View key={idx} style={styles.addToCartSheetOptionRow}>
                      <Text style={styles.addToCartSheetOptionLabel}>{getSecondAttributeValue(item)}</Text>
                      <Text style={styles.addToCartSheetOptionValue}>{convertPrice((price * currencyRate).toFixed(2))}</Text>
                      <Text style={styles.addToCartSheetOptionStock}>Stock: {stock}</Text>
                      <View style={styles.addToCartSheetQtySelector}>
                        <TouchableOpacity
                          style={styles.addToCartSheetQtyBtn}
                          onPress={() => {
                            setQuantityData(prev => ({
                              ...prev,
                              [compositeKey]: {
                                quantity: Math.max(0, quantity - 1),
                                price,
                                specId: getSkuSpecId(item),
                                imageUrl: getSkuImage(item),
                              },
                            }));
                          }}
                          disabled={quantity <= 0}
                        >
                          <Text style={styles.addToCartSheetQtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.addToCartSheetQtyValue}>{quantity}</Text>
                        <TouchableOpacity
                          style={styles.addToCartSheetQtyBtn}
                          onPress={() => {
                            setQuantityData(prev => ({
                              ...prev,
                              [compositeKey]: {
                                quantity: Math.min(stock, quantity + 1),
                                price,
                                specId: getSkuSpecId(item),
                                imageUrl: getSkuImage(item),
                              },
                            }));
                          }}
                          disabled={quantity >= stock}
                        >
                          <Text style={styles.addToCartSheetQtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
            ) : (
              // Multiple attributes
              (() => {
                // Get unique second attributes
                const uniqueSecondAttrs: { [key: string]: any } = {};
                matchingSKUs.forEach((item: any) => {
                  const secondAttrValue = getSecondAttributeValue(item);
                  if (secondAttrValue && !uniqueSecondAttrs[secondAttrValue]) {
                    uniqueSecondAttrs[secondAttrValue] = {
                      attribute: { valueTrans: secondAttrValue },
                      price: getSkuPrice(item),
                      stock: getSkuStock(item),
                      specId: getSkuSpecId(item),
                      imageUrl: getSkuImage(item),
                    };
                  }
                });
                return Object.keys(uniqueSecondAttrs).map((key, idx) => {
                  const attributeData = uniqueSecondAttrs[key];
                  const quantity = quantityData[`${selectedFirstAttr}_${attributeData.attribute.valueTrans}`]?.quantity || 0;
                  return (
                    <View key={idx} style={styles.addToCartSheetOptionRow}>
                      <Text style={styles.addToCartSheetOptionLabel}>{attributeData.attribute.valueTrans}</Text>
                      <Text style={styles.addToCartSheetOptionValue}>{currencySymbol}{(attributeData.price * currencyRate).toFixed(2)}</Text>
                      <Text style={styles.addToCartSheetOptionStock}>Stock: {attributeData.stock}</Text>
                      <View style={styles.addToCartSheetQtySelector}>
                        <TouchableOpacity
                          style={styles.addToCartSheetQtyBtn}
                          onPress={() => {
                            setQuantityData(prev => ({
                              ...prev,
                              [`${selectedFirstAttr}_${attributeData.attribute.valueTrans}`]: {
                                quantity: Math.max(0, quantity - 1),
                                price: attributeData.price,
                                specId: attributeData.specId,
                                imageUrl: attributeData.imageUrl,
                              },
                            }));
                          }}
                          disabled={quantity <= 0}
                        >
                          <Text style={styles.addToCartSheetQtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.addToCartSheetQtyValue}>{quantity}</Text>
                        <TouchableOpacity
                          style={styles.addToCartSheetQtyBtn}
                          onPress={() => {
                            setQuantityData(prev => ({
                              ...prev,
                              [`${selectedFirstAttr}_${attributeData.attribute.valueTrans}`]: {
                                quantity: Math.min(attributeData.stock, quantity + 1),
                                price: attributeData.price,
                                specId: attributeData.specId,
                                imageUrl: attributeData.imageUrl,
                              },
                            }));
                          }}
                          disabled={quantity >= attributeData.stock}
                        >
                          <Text style={styles.addToCartSheetQtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                });
              })()
            )
            )}
          </ScrollView>
          {/* Shipping Fee & Subtotal */}
          <View style={styles.addToCartSheetSummaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.addToCartSheetSummaryLabel}>{t('product.chinaShippingFee')}</Text>
              <Text style={styles.addToCartSheetSummaryValue}>{convertPrice(shippingFee)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.addToCartSheetSummaryLabel}>Subtotal</Text>
              <Text style={styles.addToCartSheetSummaryValue}>{convertPrice(subtotal.toFixed(2))}</Text>
            </View>
          </View>
          {/* Add to Cart Button */}
          <TouchableOpacity 
            style={[styles.addToCartSheetBtn, addingCart && { opacity: 0.7 }]} 
            onPress={handleConfirmAddToCart}
            disabled={addingCart}
          >
            {addingCart ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.addToCartSheetBtnText}>{t('product.adding')}</Text>
              </View>
            ) : (
              <Text style={styles.addToCartSheetBtnText}>{t('product.addToCart')}</Text>
            )}
          </TouchableOpacity>
        </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center0: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginTop: Platform.OS === 'ios' ? 0 : 40,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerShareButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCartButton: {
    padding: 8,
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  sliderContainer: {
    position: 'relative',
    height: width,
  },
  mediaSlider: {
    flex: 1,
  },
  mediaItem: {
    width: width,
    height: width,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  priceOverlay: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  birthdayText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  wholesaleBanner: {
    backgroundColor: '#FFD700',
    padding: 8,
    borderRadius: 8,
  },
  wholesaleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  factoryText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: '#fff',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  thumbnailsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingBottom: 0,
  },
  thumbnailsList: {
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#eee',
    position: 'relative',
  },
  selectedThumbnail: {
    borderColor: '#E53E3E',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  videoIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  wholesaleBadge: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    lineHeight: 24,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  salesText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  apiResponseContainer: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 100,
  },
  apiResponseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  apiResponseText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  bottomBarLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  bottomBarButton: {
    padding: 8,
    marginRight: 16,
  },
  addToCartButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 2,
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  liveChatButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#E53E3E',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  originalPrice: {
    fontSize: 16,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  shippingContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  shippingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  shippingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shippingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  shippingFee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53E3E',
  },
  estimateButton: {
    backgroundColor: '#E53E3E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  estimateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  procurementContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  procurementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  procurementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  procurementText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53E3E',
  },
  socialProofContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  socialProofText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  wishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  wishlistButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#E53E3E',
  },
  wishlistButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  wishlistButtonTextActive: {
    color: '#E53E3E',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  shareButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  totalPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalPriceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E53E3E',
  },
  fulfilledText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  errorMessage: {
    backgroundColor: '#F44336',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomCartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bottomCartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomWishlistButtonActive: {

  },
  priceBreakdownContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  priceBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceBreakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  productInfoCustom: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgesContainerCustom: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  wholesaleBadgeCustom: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  badgeTextCustom: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  productTitleCustom: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
    lineHeight: 21,
  },
  translatingText: {
    fontSize: 10,
    color: '#4CAF50',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  ratingSalesContainerCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingTextCustom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginLeft: 4,
  },
  salesTextCustom: {
    fontSize: 14,
    color: '#888',
  },
  priceBoxCustom: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  priceRowCustom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabelCustom: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  priceValueCustom: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53E3E',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'lightgray',
    padding: 0,
    paddingHorizontal: 16,
    maxWidth: '100%',
    borderRadius: 8,
  },
  priceRangeLabels: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 16,
    paddingVertical: 6,
  },
  priceRangeLabel: {
    color: '#000',
    fontWeight: '500',
    fontSize: 14,
    marginBottom: 8,
  },
  priceRangeGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  priceRangeItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 50,
  },
  priceRangeItemActive: {
    backgroundColor: '#edcbcb',
  },
  priceRangePrice: {
    color: '#E53E3E',
    fontWeight: '600',
    fontSize: 14,
  },
  priceRangeMOQ: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  relatedProductsSection: {
    marginTop: 24,
    marginBottom: 24,
    marginHorizontal: 12,
  },
  relatedProductsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    marginLeft: 8,
  },
  youMayAlsoLikeSection: {
    marginTop: 0,
    marginBottom: 24,
    marginHorizontal: 12,
  },
  youMayAlsoLikeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    marginLeft: 8,
  },
  productDetailsTabsSection: {
    marginTop: 12,
    marginBottom: 24,
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  tabsContentContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    minWidth: 100,
  },
  tabButtontb: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: '#E53E3E',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabButtonText: {
    color: '#E53E3E',
    fontWeight: '700',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  descriptionTab: {
    paddingVertical: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
  noDescriptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fallbackDescription: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  specificationsTab: {
    paddingVertical: 16,
  },
  noSpecificationsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noSpecificationsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSpecificationsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  imagesContainer: {
    width: '100%',
    marginBottom: 16,
    padding: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  imagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  descriptionImage: {
    width: '100%',
    height: undefined, // Auto height
    aspectRatio: 1, // Maintain aspect ratio
    marginBottom: 10,
    borderRadius: 8,
    alignSelf: 'stretch', // Stretch to fit container width
  },
  specificationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
    marginLeft: 8,
  },
  attributesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  attributeRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  attributeName: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  attributeValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  translatingTextSpec: {
    fontSize: 10,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 4,
    width: '100%',
  },
  vendorTab: {
    paddingVertical: 16,
  },
  vendorMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    paddingBottom: 10
  },
  vendorMetric: {
    alignItems: 'center',
    width: '25%',
  },
  vendorMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vendorMetricLabel: {
    fontSize: 10,
    color: '#666',
  },
  additionalMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  additionalMetric: {
    alignItems: 'center',
  },
  additionalMetricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  additionalMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  vendorProductsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  vendorProductsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
    marginLeft: 8,
  },
  vendorProductsSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginLeft: 8,
  },
  noVendorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noVendorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noVendorSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  vendorProductsLoading: {
    paddingVertical: 16,
  },
  vendorProductsError: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  noVendorProductsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  vendorProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  vendorProductCard: {
    width: '48%',
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  vendorProductSkeleton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  skeletonImage: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  skeletonTitle: {
    width: '100%',
    height: 20,
    marginTop: 10,
    backgroundColor: '#eee',
  },
  skeletonPrice: {
    width: '100%',
    height: 20,
    marginTop: 5,
    backgroundColor: '#ddd',
  },
  returnTab: {
    paddingVertical: 16,
  },
  returnTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  returnSection: {
    marginBottom: 16,
  },
  returnSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  returnText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
    marginBottom: 8,
  },
  deliveryTab: {
    paddingVertical: 16,
  },
  deliveryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  deliverySection: {
    marginBottom: 16,
  },
  deliverySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  deliveryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
    marginBottom: 8,
  },
  deliveryPhaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  deliveryStep: {
    marginBottom: 12,
  },
  deliveryStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deliveryStepText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
    marginBottom: 4,
  },
  shippingInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'lightgray',
  },
  shippingInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  shippingInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shippingInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  shippingInfoContent: {
    marginLeft: 8,
    flex: 1,
  },
  shippingInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  shippingInfoValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  productWeightContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productWeightItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productWeightText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  sensitiveTab: {
    paddingVertical: 16,
  },
  sensitiveTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sensitiveWarning: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sensitiveWarningText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sensitiveWarningBold: {
    fontWeight: '700',
  },
  sensitiveIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  sensitiveIcon: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  sensitiveIconText: {
    fontSize: 24,
    color: '#333',
  },
  sensitiveDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginBottom: 16,
  },
  sensitiveListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sensitiveListText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
  accordionSection: {
    marginBottom: 100,
    marginHorizontal: 12,
  },
  accordionSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  accordionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  accordionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  accordionContent: {
    padding: 12,
  },
  addToCartSheetContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    marginBottom: 0,
  },
  
  addToCartSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  
  addToCartSheetImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  
  addToCartSheetTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  
  addToCartSheetPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  
  addToCartSheetStock: {
    fontSize: 14,
    color: '#666',
  },
  
  addToCartSheetCloseBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 6,
  },
  
  addToCartSheetThumbnailsRow: {
    marginVertical: 12,
  },
  
  addToCartSheetThumbnailWrap: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 8,
    padding: 2,
  },
  
  addToCartSheetThumbnailSelected: {
    borderColor: '#E53E3E',
  },
  
  addToCartSheetThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 6,
  },
  
  addToCartSheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  
  addToCartSheetOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  
  addToCartSheetOptionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginHorizontal: 6,
  },
  
  addToCartSheetOptionStock: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 6,
  },
  
  addToCartSheetQtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  
  addToCartSheetQtyBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
  },
  
  addToCartSheetQtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  
  addToCartSheetQtyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 8,
  },
  
  addToCartSheetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  
  addToCartSheetSummaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  
  addToCartSheetSummaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ed2027',
  },
  
  addToCartSheetBtn: {
    backgroundColor: '#E53E3E',
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  
  addToCartSheetBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  
  fulfilledByText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  pricingSection: {
    marginTop: 16,
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoBox: {
    backgroundColor: '#ffe2e2',
    borderWidth: 1,
    borderColor: '#ed2027',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  shippingFeeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginLeft: 24,
  },
  estimateText: {
    fontSize: 14,
    color: '#ed2027',
    marginBottom: 8,
    marginLeft: 24,
    textDecorationLine: 'underline',
  },
  processingTimeText: {
    fontSize: 14,
    color: '#ed2027',
    marginBottom: 8,
    marginLeft: 24,
    fontWeight: 'bold',
  },
  repurchaseText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  addToCartModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  imagePopupOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  imagePopupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  imagePopupContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imagePopupCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePopupImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 100,
    maxWidth: '100%',
    maxHeight: '100%',
  },
  priceDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPriceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ed2027',
  },
  originalPriceText: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
});
