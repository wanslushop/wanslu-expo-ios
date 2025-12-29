import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useI18n } from '../context/I18nContext';

// Import all category language files
import arCategories from '../context/cats/ar.json';
import deCategories from '../context/cats/de.json';
import enCategories from '../context/cats/en.json';
import esCategories from '../context/cats/es.json';
import frCategories from '../context/cats/fr.json';
import itCategories from '../context/cats/it.json';
import jaCategories from '../context/cats/ja.json';
import koCategories from '../context/cats/ko.json';
import nlCategories from '../context/cats/nl.json';
import plCategories from '../context/cats/pl.json';
import ptCategories from '../context/cats/pt.json';
import ruCategories from '../context/cats/ru.json';
import svCategories from '../context/cats/sv.json';
import trCategories from '../context/cats/tr.json';
import zhHansCategories from '../context/cats/zh-hans.json';
import zhCategories from '../context/cats/zh.json';

// Map language codes to category files
const categoryFiles: { [key: string]: any } = {
  en: enCategories,
  ar: arCategories,
  de: deCategories,
  es: esCategories,
  fr: frCategories,
  it: itCategories,
  ja: jaCategories,
  ko: koCategories,
  pt: ptCategories,
  ru: ruCategories,
  zh: zhCategories,
  'zh-hans': zhHansCategories,
  nl: nlCategories,
  pl: plCategories,
  sv: svCategories,
  tr: trCategories,
};

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

interface CategoriesModalProps {
  visible: boolean;
  onClose: () => void;
}

const CategoriesModal: React.FC<CategoriesModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { language } = useI18n();
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
  const anim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Get categories based on current language, fallback to English
  const categories = useMemo(() => {
    return categoryFiles[language] || categoryFiles['en'] || enCategories;
  }, [language]);

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handleCategoryItemPress = (mainCategory: string, subCategory: string, item: string) => {
    const searchQuery = encodeURIComponent(subCategory + ' ' + item);
    router.push({
      pathname: '/search',
      params: { q: searchQuery, m: '1688' }
    });
    onClose();
  };

  const getIconName = (iconName: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      'home-heart': 'home',
      'sofa': 'bed',
      'flower': 'flower',
      'computer': 'laptop',
      'shirt': 'shirt',
      'empathize': 'heart',
      'basketball': 'basketball',
      'gamepad': 'game-controller',
      'building-3': 'business',
      'flask': 'flask'
    };
    return iconMap[iconName] || 'folder';
  };

  const getCategoryColor = (categoryKey: string): string => {
    const colorMap: { [key: string]: string } = {
      'Home & Kitchen': '#ed2027',
      'Home & Furniture': '#ed2027',
      'Home Decor': '#ed2027',
      'Electronics': '#ed2027',
      'Clothing & Accessories': '#ed2027',
      'Health & Beauty': '#ed2027',
      'Sport & Outdoor': '#ed2027',
      'Toy & Video Games': '#ed2027',
      'Industrial': '#ed2027',
      'Raw Materials': '#ed2027'
    };
    return colorMap[categoryKey] || '#95A5A6';
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.drawer, { left: anim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Categories</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        {/* Categories Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          {Object.entries(categories as Record<string, any>).map(([mainCategory, subCategories]) => {
            const isExpanded = expandedCategories[mainCategory];
            const subCategoriesObj = subCategories as Record<string, any>;
            const iconName = subCategoriesObj.icon || 'folder';
            const categoryColor = getCategoryColor(mainCategory);
            return (
              <View key={mainCategory} style={styles.categoryContainer}>
                <TouchableOpacity
                  style={[
                    styles.categoryHeader,
                    isExpanded && styles.categoryHeaderExpanded,
                    { borderLeftColor: categoryColor }
                  ]}
                  onPress={() => toggleCategory(mainCategory)}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryTitleContainer}>
                    <View style={[styles.iconContainer, { backgroundColor: categoryColor }]}>
                      <Ionicons
                        name={getIconName(iconName)}
                        size={20}
                        color="white"
                      />
                    </View>
                    <View style={styles.categoryTextContainer}>
                      <Text style={styles.categoryTitle}>{mainCategory}</Text>
                      <Text style={styles.categorySubtitle}>
                        {Object.keys(subCategoriesObj).filter(key => key !== 'icon').length} subcategories
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.chevronContainer, isExpanded && styles.chevronRotated]}>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#666"
                    />
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.subCategoriesContainer}>
                    {Object.entries(subCategoriesObj).map(([subCategory, items]) => {
                      if (subCategory === 'icon') return null;
                      const itemsArray = items as string[];
                      return (
                        <View key={subCategory} style={styles.subCategoryContainer}>
                          <View style={styles.subCategoryHeader}>
                            <View style={[styles.subCategoryDot, { backgroundColor: categoryColor }]} />
                            <Text style={styles.subCategoryTitle}>{subCategory}</Text>
                            <Text style={styles.itemCount}>({itemsArray.length})</Text>
                          </View>
                          <View style={styles.itemsGrid}>
                            {itemsArray.slice(0, 100).map((item: string) => (
                              <TouchableOpacity
                                key={item}
                                style={[styles.itemButton, { borderColor: categoryColor }]}
                                onPress={() => handleCategoryItemPress(mainCategory, subCategory, item)}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.itemText, { color: categoryColor }]}>{item}</Text>
                              </TouchableOpacity>
                            ))}
                            {itemsArray.length > 100 && (
                              <TouchableOpacity
                                style={[styles.moreButton, { backgroundColor: categoryColor }]}
                                onPress={() => handleCategoryItemPress(mainCategory, subCategory, subCategory)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.moreButtonText}>
                                  +{itemsArray.length - 100} more
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 99999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99999,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#f8f9fa',
    zIndex: 100000,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 60, // Account for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  categoryContainer: {
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  categoryHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  chevronContainer: {
    padding: 4,
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  subCategoriesContainer: {
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingTop: 8,
  },
  subCategoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  subCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  subCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    flex: 1,
  },
  itemCount: {
    fontSize: 12,
    color: '#6C757D',
    fontStyle: 'italic',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: 'white',
    marginBottom: 6,
  },
  itemText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 6,
  },
  moreButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
});

export default CategoriesModal;
