import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useI18n } from "./context/I18nContext";

export default function AppInfo() {
  const { t } = useI18n();
  
  const technicalInfo = [
    { label: t('about.version'), value: "1.0.1" },
    // { label: t('about.framework'), value: "Native (Expo)" },
    // { label: t('about.language'), value: "JavaScript" },
    // { label: t('about.author'), value: "K3 Wanslu" },
    // { label: t('about.platform'), value: "Android, iOS" },
  ];

  return (
    <>
    <View style={styles.header}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{t('about.title')}</Text>
    <View style={styles.headerSpacer} />
  </View>
    <ScrollView style={styles.container}>
      

      {/* App Short Description */}
      <View style={styles.card}>
        <Text style={styles.appTitle}>Wanslu Shop</Text>
        <Text style={styles.appDesc}>
        {t('about.description')}
        </Text>
      </View>

      {/* Technical Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('about.technicalInfo')}</Text>
        {technicalInfo.map((item, index) => (
          <View key={index} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
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
  card: {
    backgroundColor: "#dd5055",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  appDesc: {
    fontSize: 16,
    color: "#d1cfe2",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
  },
  infoLabel: {
    fontSize: 16,
    color: "#fff",
  },
  infoValue: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
});
