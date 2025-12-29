import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';

interface CarouselItemType {
  id: number;
  heading: string;
  subheading: string;
  button: string;
  link: string;
  image: string;
}

const { width: screenWidth } = Dimensions.get('window');

export default function HeroCarousel() {
  const [items, setItems] = useState<CarouselItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetchCarouselData();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      const interval = setInterval(() => {
        const nextIndex = (currentIndex + 1) % items.length;
        setCurrentIndex(nextIndex);
        scrollViewRef.current?.scrollTo({
          x: nextIndex * screenWidth,
          animated: true,
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentIndex, items.length]);

  const fetchCarouselData = async () => {
    try {
      const response = await fetch("https://api.wanslu.shop/api/home/carousel", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await response.json();
      setItems(data.data || []);
    } catch (error) {
      console.error('Failed to fetch carousel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  const handleButtonPress = (link: string) => {
    // Handle navigation based on the link
    if (link.includes('/search')) {
      // Extract search query from link if it's a search link
      const searchQuery = link.split('=')[1];
      if (searchQuery) {
        router.push({
          pathname: '/search' as any,
          params: { q: decodeURIComponent(searchQuery) }
        });
      }
    } else if (link.startsWith('/')) {
      // For internal app links, try to navigate safely
      try {
        router.push(link as any);
      } catch (error) {
        console.log('Navigation failed for:', link, error);
      }
    } else if (link.startsWith('http')) {
      // Handle external links if needed
      console.log('External link:', link);
      Linking.openURL(link);
    } else {
      // For other links, you can handle them accordingly
      console.log('Navigating to:', link);
      Linking.openURL(link);

    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setCurrentIndex(index);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53E3E" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!items.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {items.map((item, index) => (
          <View key={item.id} style={styles.slide}>
            <Image
              source={{ uri: item.image }}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
            <View style={styles.overlay}>
              <View style={styles.content}>
                <Text
                  style={styles.heading}
                  numberOfLines={2}
                >
                  {item.heading.replace(/<[^>]*>/g, '')}
                </Text>
                <Text style={styles.subheading} numberOfLines={2}>
                  {item.subheading}
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleButtonPress(item.link)}
                >
                  <Text style={styles.buttonText}>{item.button}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Navigation Dots */}
      <View style={styles.dotsContainer}>
        {items.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.activeDot
            ]}
            onPress={() => handleDotPress(index)}
          >
            <View
              style={[
                styles.dotInner,
                currentIndex === index && styles.activeDotInner
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    marginBottom: 16,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: screenWidth,
    height: 250,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 28,
  },
  subheading: {
    fontSize: 16,
    color: 'black',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    borderColor: '#E53E3E',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  activeDotInner: {
    backgroundColor: '#E53E3E',
  },
  loadingContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});
