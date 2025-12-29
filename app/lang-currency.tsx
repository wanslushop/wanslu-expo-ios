import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import { useCartCount } from './context/CartCountContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { useLangCurrency } from './context/LangCurrencyContext';
import { useNavigation } from './context/NavigationContext';

const languageOptions = [
  { label: 'English', value: 'en' }, // done
  { label: 'Español', value: 'es' }, // done
  { label: '中文 (简体)', value: 'zh' }, 
  { label: '中文 (繁體)', value: 'zh-hans' }, 
  { label: 'العربية', value: 'ar' }, 
  { label: 'Français', value: 'fr' }, // done
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' }, // done
  { label: 'Deutsch', value: 'de' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Italiano', value: 'it' },
];

const currencyOptions = [
  { label: 'AED', value: 'AED' },
  { label: 'CAD', value: 'CAD' },
  { label: 'CDF', value: 'CDF' },
  { label: 'CNY', value: 'CNY' },
  { label: 'EUR', value: 'EUR' },
  { label: 'GBP', value: 'GBP' },
  { label: 'HKD', value: 'HKD' },
  { label: 'INR', value: 'INR' },
  { label: 'JPY', value: 'JPY' },
  { label: 'KES', value: 'KES' },
  { label: 'NGN', value: 'NGN' },
  { label: 'RUB', value: 'RUB' },
  { label: 'RWF', value: 'RWF' },
  { label: 'TZS', value: 'TZS' },
  { label: 'UGX', value: 'UGX' },
  { label: 'USD', value: 'USD' },
  { label: 'XAF', value: 'XAF' },
  { label: 'XOF', value: 'XOF' },
  { label: 'ZMW', value: 'ZMW' },
];

function SimpleDropdown({ label, value, options, onChange }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownButtonText}>
          {options.find((opt: any) => opt.value === value)?.label || label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#666" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          <ScrollView style={styles.dropdownScroll} contentContainerStyle={{ paddingVertical: 2 }}>
            {options.map((opt: any) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dropdownItem, value === opt.value && styles.dropdownItemSelected]}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, value === opt.value && styles.dropdownItemTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function LangCurrencyScreen() {
  const { language, currency, setLanguage, setCurrency, loading } = useLangCurrency();
  const { t } = useI18n();
  const { cartCount } = useCartCount();
  const { refreshCurrencyOnChange, refreshing } = useCurrency();
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [isSaving, setIsSaving] = useState(false);
  
  // Use refs to store the current dropdown values immediately
  const currentLanguageRef = React.useRef(selectedLanguage);
  const currentCurrencyRef = React.useRef(selectedCurrency);

  // Debug: Log current state values
  console.log('LangCurrency Screen: Current context values - language:', language, 'currency:', currency);
  console.log('LangCurrency Screen: Current selected values - language:', selectedLanguage, 'currency:', selectedCurrency);

  // Update selected values when context values change
  useEffect(() => {
    console.log('LangCurrency Screen: Context values changed, updating selected values');
    setSelectedLanguage(language);
    setSelectedCurrency(currency);
    currentLanguageRef.current = language;
    currentCurrencyRef.current = currency;
  }, [language, currency]);

  // Debug: Track selectedLanguage changes
  useEffect(() => {
    console.log('LangCurrency Screen: selectedLanguage changed to:', selectedLanguage);
  }, [selectedLanguage]);

  // Debug: Track selectedCurrency changes
  useEffect(() => {
    console.log('LangCurrency Screen: selectedCurrency changed to:', selectedCurrency);
  }, [selectedCurrency]);

  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header cartCount={cartCount} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('settings.loadingPreferences')}</Text>
        </View>
        
        {/* Categories Modal */}
        <CategoriesModal 
          visible={showCategoriesModal} 
          onClose={() => setShowCategoriesModal(false)} 
        />
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log('=== SAVE FUNCTION - VALUES ALREADY SAVED ===');
      console.log('LangCurrency Screen: currentLanguageRef.current:', currentLanguageRef.current);
      console.log('LangCurrency Screen: currentCurrencyRef.current:', currentCurrencyRef.current);
      
      // Values are already saved, just verify
      const saved = await AsyncStorage.getItem('lang-currency');
      console.log('LangCurrency Screen: Current stored data:', saved);
      
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error in save function:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem('lang-currency');
      console.log('LangCurrency Screen: Manual storage check:', stored);
      alert(`Stored data: ${stored}`);
    } catch (error) {
      console.error('Error checking storage:', error);
    }
  };

  const hasChanges = selectedLanguage !== language || selectedCurrency !== currency;

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
        {/* Language Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>{t('settings.languageSettings')}</Text>
          <View style={styles.selectorContainer}>
            <Ionicons name="language" size={20} color="#666" style={styles.selectorIcon} />
            <SimpleDropdown
              label={t('settings.selectLanguage')}
              value={selectedLanguage}
              options={languageOptions}
              onChange={async (newLang: string) => {
                console.log('LangCurrency Screen: Language dropdown changed to:', newLang);
                setSelectedLanguage(newLang);
                currentLanguageRef.current = newLang;
                
                // SAVE IMMEDIATELY TO STORAGE
                try {
                  const dataToStore = JSON.stringify({ language: newLang, currency: currentCurrencyRef.current });
                  console.log('LangCurrency Screen: IMMEDIATELY saving to AsyncStorage:', dataToStore);
                  await AsyncStorage.setItem('lang-currency', dataToStore);
                  console.log('LangCurrency Screen: Language saved IMMEDIATELY to storage');
                  
                  // Also update context immediately
                  await setLanguage(newLang);
                } catch (error) {
                  console.error('Error saving language immediately:', error);
                }
              }}
            />
          </View>
        </View>
        {/* Currency Section */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('settings.currencySettings')}</Text>
            {refreshing && (
              <View style={styles.refreshingIndicator}>
                <ActivityIndicator size="small" color="#E53E3E" />
                <Text style={styles.refreshingText}>{t('settings.updatingRates')}</Text>
              </View>
            )}
          </View>
          <View style={styles.selectorContainer}>
            <Ionicons name="cash" size={20} color="#666" style={styles.selectorIcon} />
            <SimpleDropdown
              label={t('settings.selectCurrency')}
              value={selectedCurrency}
              options={currencyOptions}
              onChange={async (newCurrency: string) => {
                console.log('LangCurrency Screen: Currency dropdown changed to:', newCurrency);
                setSelectedCurrency(newCurrency);
                currentCurrencyRef.current = newCurrency;
                
                // SAVE IMMEDIATELY TO STORAGE
                try {
                  const dataToStore = JSON.stringify({ language: currentLanguageRef.current, currency: newCurrency });
                  console.log('LangCurrency Screen: IMMEDIATELY saving currency to AsyncStorage:', dataToStore);
                  await AsyncStorage.setItem('lang-currency', dataToStore);
                  console.log('LangCurrency Screen: Currency saved IMMEDIATELY to storage');
                  
                  // Also update context immediately
                  await setCurrency(newCurrency);
                  
                  // Refresh currency context
                  if (newCurrency !== currency) {
                    console.log(`Currency changed to ${newCurrency}, refreshing currency context...`);
                    refreshCurrencyOnChange();
                  }
                } catch (error) {
                  console.error('Error saving currency immediately:', error);
                }
              }}
            />
          </View>
        </View>
        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>{t('settings.saveChanges')}</Text>
          )}
        </TouchableOpacity>
        
        {/* Check Storage Button */}
        {/* <TouchableOpacity
          style={styles.checkStorageButton}
          onPress={handleCheckStorage}
        >
          <Text style={styles.checkStorageButtonText}>Check Storage</Text>
        </TouchableOpacity> */}
      </ScrollView>
      
      {/* Categories Modal */}
      <CategoriesModal 
        visible={showCategoriesModal} 
        onClose={() => setShowCategoriesModal(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshingText: {
    fontSize: 12,
    color: '#E53E3E',
    marginLeft: 6,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectorIcon: {
    marginRight: 12,
  },
  dropdownContainer: {
    flex: 1,
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,

  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownList: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  dropdownItemSelected: {
    backgroundColor: '#FEE2E2',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  dropdownItemTextSelected: {
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkStorageButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  checkStorageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
