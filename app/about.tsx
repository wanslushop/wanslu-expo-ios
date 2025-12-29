import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from './context/I18nContext';

export default function AboutPage() {
  const { t } = useI18n();
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E53E3E" />
      <View style={styles.header}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{t('about.title')}</Text>
    <View style={styles.headerSpacer} />
  </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>{t('about.aboutWansluShop')}</Text>
          <Text style={styles.heroDescription}>
            {t('about.description')}
          </Text>
        </View>

        {/* Mission Section */}
        <View style={styles.missionSection}>
          <Text style={styles.missionTitle}>{t('about.whatWeDo')}</Text>
          <Text style={styles.missionDescription}>
            {t('about.whatWeDoDescription')}
          </Text>
        </View>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>{t('about.ourServices')}</Text>
          
          {/* Purchasing Agent Card */}
          <View style={styles.serviceCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="cart" size={32} color="#E53E3E" />
              <Text style={styles.cardTitle}>{t('about.purchasingAgent')}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>1.</Text>
                <Text style={styles.listText}>{t('about.professionalSourcing')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>2.</Text>
                <Text style={styles.listText}>{t('about.qualityControl')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>3.</Text>
                <Text style={styles.listText}>{t('about.negotiationPrice')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>4.</Text>
                <Text style={styles.listText}>{t('about.supplierVerification')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>5.</Text>
                <Text style={styles.listText}>{t('about.orderTracking')}</Text>
              </View>
            </View>
          </View>

          {/* Transport Card */}
          <View style={styles.serviceCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="car" size={32} color="#E53E3E" />
              <Text style={styles.cardTitle}>{t('about.transportShipping')}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>1.</Text>
                <Text style={styles.listText}>{t('about.internationalShipping')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>2.</Text>
                <Text style={styles.listText}>{t('about.customsClearance')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>3.</Text>
                <Text style={styles.listText}>{t('about.warehouseStorage')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>4.</Text>
                <Text style={styles.listText}>{t('about.realTimeTracking')}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listNumber}>5.</Text>
                <Text style={styles.listText}>{t('about.doorToDoorDelivery')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>{t('about.getInTouch')}</Text>
          <Text style={styles.contactDescription}>
            {t('about.getInTouchDescription')}
          </Text>
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color="#E53E3E" />
              <Text style={styles.contactText}>info@wanslu.shop</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color="#E53E3E" />
              <Text style={styles.contactText}>+1 (555) 123-4567</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="location" size={20} color="#E53E3E" />
              <Text style={styles.contactText}>{t('about.globalOperations')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 24,
  },
    scrollView: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  missionSection: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
  },
  missionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  missionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  servicesSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  cardContent: {
    padding: 20,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  listNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginRight: 12,
    minWidth: 20,
  },
  listText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  contactSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginTop: 20,
  },
  contactTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});
