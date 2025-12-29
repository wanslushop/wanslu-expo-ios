import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';

interface FeaturedCardType {
  id: number;
  heading: string;
  subheading: string;
  button: string;
  link: string;
  image: string;
}

export default function FeaturedCards() {
  const [cards, setCards] = useState<FeaturedCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [buttonPressed, setButtonPressed] = useState<number | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetch("https://api.wanslu.shop/api/home/featured-cards", {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => setCards(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleCardPress = (link: string) => {
    // Handle navigation based on the link
    if (link.includes('/search')) {
      // Extract search query from link if it's a search link
      const searchQuery = link.split('=')[1];
      if (searchQuery) {
        router.push({
          pathname: '/search',
          params: { q: decodeURIComponent(searchQuery) }
        });
      }
    } else {
      // For other links, you can handle them accordingly
      console.log('Navigating to:', link);
    }
  };

  const handleButtonPress = (cardId: number, link: string) => {
    setButtonPressed(cardId);
    // Add a small delay to show the pressed state
    setTimeout(() => {
      setButtonPressed(null);
      handleCardPress(link);
    }, 150);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53E3E" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!cards.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.card}
            onPress={() => handleCardPress(card.link)}
            activeOpacity={0.9}
          >
            <View style={styles.cardContent}>
              <View style={styles.textContainer}>
                <Text style={styles.subheading}>{card.subheading}</Text>
                <Text style={styles.heading} numberOfLines={2}>
                  {card.heading}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.button,
                    buttonPressed === card.id && styles.buttonPressed
                  ]}
                  onPress={() => handleButtonPress(card.id, card.link)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.buttonText,
                    buttonPressed === card.id && styles.buttonTextPressed
                  ]}>
                    {card.button}
                  </Text>
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: card.image }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  gridContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#f9fbfc',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  subheading: {
    fontSize: 12,
    color: '#E53E3E',
    fontWeight: '600',
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E53E3E',
  },
  buttonPressed: {
    backgroundColor: '#E53E3E',
  },
  buttonText: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextPressed: {
    color: 'white',
  },
  cardImage: {
    width: 112,
    height: 112,
  },
  loadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});
