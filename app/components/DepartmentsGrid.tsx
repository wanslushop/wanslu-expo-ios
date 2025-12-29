import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';

interface DepartmentCard {
  id: number;
  title: string;
  image: string;
  link: string;
}

interface Department {
  department: { id: number; name: string };
  cards: DepartmentCard[];
}

export default function DepartmentsGrid() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetch("https://api.wanslu.shop/api/home/departments", {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => setDepartments(data.data || []))
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53E3E" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!departments.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {departments.map((dept) => (
          <View key={dept.department.id} style={styles.departmentCard}>
            <Text style={styles.departmentTitle}>{dept.department.name}</Text>
            <View style={styles.cardsGrid}>
              {dept.cards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={styles.card}
                  onPress={() => handleCardPress(card.link)}
                >
                  <Image
                    source={{ uri: card.image }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {card.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
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
  departmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  departmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: (width - 64 - 12) / 2, // Account for padding and gap
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
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
