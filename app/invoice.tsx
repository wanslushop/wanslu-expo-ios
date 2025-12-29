import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useI18n } from './context/I18nContext';

const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 2200;
const { width: screenWidth } = Dimensions.get('window');
const scale = screenWidth / DESKTOP_WIDTH;

export default function InvoiceScreen() {
  const { oid } = useLocalSearchParams<{ oid: string }>();
  const { t } = useI18n();
  const url = `https://wanslu.shop/bill?id=${oid}`;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('invoice.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.centerArea}>
        <View style={styles.desktopCard}>
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            originWhitelist={["*"]}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            scalesPageToFit={false}
            bounces={false}
            scrollEnabled={true}
            showsHorizontalScrollIndicator={true}
            showsVerticalScrollIndicator={true}
            automaticallyAdjustContentInsets={false}
            contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6', // light gray
  },
  header: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  desktopCard: {
    width: DESKTOP_WIDTH,
    height: DESKTOP_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    transform: [{ scale: scale }],
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
});
