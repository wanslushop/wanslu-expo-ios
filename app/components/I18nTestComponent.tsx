import React, { useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { useLangCurrency } from '../context/LangCurrencyContext';

// Test component to verify i18n integration with lang-currency
export default function I18nTestComponent() {
  const { t, language } = useI18n();
  const { language: langCurrencyLang, setLanguage } = useLangCurrency();

  useEffect(() => {
    console.log('=== I18n Test Component ===');
    console.log('I18n language:', language);
    console.log('LangCurrency language:', langCurrencyLang);
    console.log('Languages match:', language === langCurrencyLang);
  }, [language, langCurrencyLang]);

  const testLanguageChange = async (lang: string) => {
    try {
      console.log(`Testing language change to: ${lang}`);
      await setLanguage(lang);
      
      // Show alert after a short delay to see the change
      setTimeout(() => {
        Alert.alert(
          'Language Changed',
          `Language changed to: ${lang}\nTranslation test: ${t('common.loading')}`,
          [{ text: 'OK' }]
        );
      }, 500);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert('Error', 'Failed to change language');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>I18n Integration Test</Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Current I18n Language: {language}</Text>
        <Text style={styles.infoText}>LangCurrency Language: {langCurrencyLang}</Text>
        <Text style={styles.infoText}>Languages Match: {language === langCurrencyLang ? '✅' : '❌'}</Text>
      </View>

      <View style={styles.testContainer}>
        <Text style={styles.testTitle}>Translation Test:</Text>
        <Text style={styles.testText}>Loading: {t('common.loading')}</Text>
        <Text style={styles.testText}>Welcome: {t('auth.welcomeBack')}</Text>
        <Text style={styles.testText}>Save: {t('common.save')}</Text>
        <Text style={styles.testText}>Cancel: {t('common.cancel')}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testLanguageChange('en')}
        >
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testLanguageChange('es')}
        >
          <Text style={styles.buttonText}>Español</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testLanguageChange('fr')}
        >
          <Text style={styles.buttonText}>Français</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => testLanguageChange('ru')}
        >
          <Text style={styles.buttonText}>Русский</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.storageInfo}>
        <Text style={styles.storageTitle}>LocalStorage Info:</Text>
        <Text style={styles.storageText}>Key: 'lang-currency'</Text>
        <Text style={styles.storageText}>Format: {"{"}"language":"en","currency":"INR"{"}"}</Text>
        <Text style={styles.storageText}>I18n loads from LangCurrency context</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  testContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  testText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    margin: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storageInfo: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  storageText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
});
