import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';

export interface TrendingProduct {
  pid: string;
  src: string;
  title: string;
  img: string;
  price: number;
  view_count: number;
  monthSold?: number;
  repurchaseRate?: string;
}

interface ProductCardProps {
  product: TrendingProduct;
  onPress?: () => void;
  showWishlistButton?: boolean;
  isInWishlist?: boolean;
  onWishlistToggle?: (product: TrendingProduct) => void;
  hideViewCount?: boolean;
  titleOpacity?: Animated.Value;
  showTranslating?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onPress, 
  showWishlistButton = true,
  isInWishlist = false,
  onWishlistToggle,
  hideViewCount = false,
  titleOpacity,
  showTranslating = false
}) => {
  const [wishlistId, setWishlistId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localIsInWishlist, setLocalIsInWishlist] = useState(isInWishlist);
  const { convertPrice } = useCurrency();
  const { t } = useI18n();

  // Check if item is in wishlist on mount
  useEffect(() => {
    if (showWishlistButton) {
      checkWishlistStatus();
    }
  }, [product.pid]);

  // Update local state when prop changes
  useEffect(() => {
    setLocalIsInWishlist(isInWishlist);
  }, [isInWishlist]);

  const checkWishlistStatus = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch(`https://api.wanslu.shop/api/account/wishlist?offset=0&limit=10000`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        const wishlistItem = data.data?.find((item: any) => item.pid === product.pid);
        if (wishlistItem) {
          setWishlistId(wishlistItem.id);
          setLocalIsInWishlist(true);
        } else {
          setLocalIsInWishlist(false);
        }
      }
    } catch (error) {
      console.error('Failed to check wishlist status:', error);
    }
  };

  const handleWishlistToggle = async () => {
    if (onWishlistToggle) {
      // Use parent's wishlist toggle if provided
      onWishlistToggle(product);
      return;
    }

    // Default wishlist toggle logic
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        Alert.alert(t('common.error'), t('home.pleaseLoginToUseWishlist'));
        return;
      }

      setProcessing(true);

      if (localIsInWishlist) {
        // Remove from wishlist
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
          setLocalIsInWishlist(false);
          setWishlistId(null);
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
          setWishlistId(responseData.id || responseData.data?.id || null);
          setLocalIsInWishlist(true);
        } else if (responseData.status === "error" && responseData.message === "Item already exists in wishlist") {
          // Item already exists, save the ID and update state
          Alert.alert(t('common.info'), t('home.itemAlreadyInWishlist'));
          setWishlistId(responseData.data?.id || null);
          setLocalIsInWishlist(true);
        } else {
          Alert.alert(t('common.error'), responseData.message || t('home.failedToAddToWishlist'));
        }
      }
    } catch (error) {
      console.error('Wishlist action failed:', error);
      Alert.alert(t('common.error'), t('home.wishlistActionFailed'));
    } finally {
      setProcessing(false);
    }
  };

  // Normalize src for display and logic
  const normalizeSrc = (src: string) => {
    if (!src) return '1688';
    if (src.toLowerCase() === 'retail') return 'tb';
    if (src.toLowerCase() === 'wholesale') return '1688';
    return src.toLowerCase();
  };

  const normalizedSrc = normalizeSrc(product.src);

  const getBadgeText = (src: string): string => {
    switch (normalizeSrc(src)) {
      case '1688':
        return t('product.wholesale');
      case 'tb':
        return t('product.retail');
      case 'chinese':
        return (t('search.categories.chinese') || 'Chinese').toUpperCase();
      case 'local':
        return (t('search.categories.local') || 'Local').toUpperCase();
      default:
        return src.toUpperCase();
    }
  };
  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress}>
      <View style={styles.productImageContainer}>
        <Image source={{ uri: product.img }} style={styles.productImage} />
        <View style={styles.wholesaleTag}>
          <Text style={styles.wholesaleText}>{getBadgeText(product.src)}</Text>
        </View>
        
        {/* Wishlist Button */}
        {showWishlistButton && (
          <TouchableOpacity 
            style={styles.wishlistButton}
            onPress={handleWishlistToggle}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#E53E3E" />
            ) : (
              <Ionicons 
                name={localIsInWishlist ? "heart" : "heart-outline"} 
                size={20} 
                color={localIsInWishlist ? "#E53E3E" : "#666"} 
              />
            )}
          </TouchableOpacity>
        )}
        
        {/* View Count Indicator */}
        {!hideViewCount && (
          <View style={styles.viewCountContainer}>
            <Ionicons name="eye" size={12} color="#666" />
            <Text style={styles.viewCountText}>{product.view_count}</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        {titleOpacity ? (
          <Animated.Text 
            style={[
              styles.productTitle,
              { opacity: titleOpacity }
            ]} 
            numberOfLines={2}
          >
            {product.title}
          </Animated.Text>
        ) : (
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
        )}
        {showTranslating && (
          <Text style={styles.translatingText}>Translating</Text>
        )}
        {/* Sales and Repurchase Info */}
        
        {(product.monthSold !== undefined || product.repurchaseRate !== undefined) && (
          <View style={styles.salesInfoContainer}>
            {product.monthSold !== undefined && product.monthSold > 0 && (
              <View style={styles.salesInfoItem}>
                <Ionicons name="trending-up" size={12} color="#666" />
                <Text style={styles.salesInfoText}>{t('search.stats.sold')}: {product.monthSold}</Text>
              </View>
            )}
            {product.repurchaseRate && (
              <View style={styles.repurchaseBadge}>
              <Text style={styles.repurchaseText}>{t('search.stats.repurchase')} : {product.repurchaseRate}</Text>
            </View>
            )}
          </View>
        )}
        
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>{convertPrice(product.price)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  productCard: {
    width: '100%',
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
  productImageContainer: {
    position: 'relative',
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
  productImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  wholesaleTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E53E3E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  wholesaleText: {
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
  },
  viewCountContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCountText: {
    color: 'white',
    fontSize: 10,
    marginLeft: 2,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ed2027',
  },
  salesInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  salesInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  salesInfoItem2: {
 flexWrap: 'nowrap',
 color: 'green',
  },
  salesInfoText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  salesInfoText2: {
    fontSize: 10,
    color: 'green',
    marginLeft: 4,
  },
  sourceText: {
    fontSize: 10,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
});

export default ProductCard;
