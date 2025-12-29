import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import categories from '../context/cats.json';

interface NestedMenuProps {
  onCategorySelect?: () => void;
}

const NestedMenu: React.FC<NestedMenuProps> = ({ onCategorySelect }) => {
  const router = useRouter();
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handleCategoryItemPress = (mainCategory: string, subCategory: string, item: string) => {
    const searchQuery = encodeURIComponent(subCategory+' '+item);
    router.push({
      pathname: '/search',
      params: { q: searchQuery, m: '1688' }
    });
    onCategorySelect?.();
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
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {Object.entries(categories).map(([mainCategory, subCategories]) => {
        const isExpanded = expandedCategories[mainCategory];
        const iconName = (subCategories as any).icon || 'folder';
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
                    {Object.keys(subCategories).filter(key => key !== 'icon').length} subcategories
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
                {Object.entries(subCategories).map(([subCategory, items]) => {
                  if (subCategory === 'icon') return null;
                  
                  return (
                    <View key={subCategory} style={styles.subCategoryContainer}>
                      <View style={styles.subCategoryHeader}>
                        <View style={[styles.subCategoryDot, { backgroundColor: categoryColor }]} />
                        <Text style={styles.subCategoryTitle}>{subCategory}</Text>
                        <Text style={styles.itemCount}>({(items as string[]).length})</Text>
                      </View>
                      <View style={styles.itemsGrid}>
                        {(items as string[]).slice(0, 100).map((item: string) => (
                          <TouchableOpacity
                            key={item}
                            style={[styles.itemButton, { borderColor: categoryColor }]}
                            onPress={() => handleCategoryItemPress(mainCategory, subCategory, item)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.itemText, { color: categoryColor }]}>{item}</Text>
                          </TouchableOpacity>
                        ))}
                        {(items as string[]).length > 100 && (
                          <TouchableOpacity
                            style={[styles.moreButton, { backgroundColor: categoryColor }]}
                            onPress={() => handleCategoryItemPress(mainCategory, subCategory, subCategory)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.moreButtonText}>
                              +{(items as string[]).length - 100} more
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 20,
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

export default NestedMenu;