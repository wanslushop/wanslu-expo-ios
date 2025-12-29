import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../context/I18nContext';

// Example component demonstrating i18n usage
export default function I18nExample() {
  const { t, language, setLanguage } = useI18n();

  const handleLanguageChange = async (lang: string) => {
    await setLanguage(lang);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('common.loading')}</Text>
      <Text style={styles.subtitle}>{t('auth.welcomeBack')}</Text>
      <Text style={styles.info}>Current Language: {language}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => handleLanguageChange('en')}
        >
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => handleLanguageChange('es')}
        >
          <Text style={styles.buttonText}>Español</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => handleLanguageChange('fr')}
        >
          <Text style={styles.buttonText}>Français</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => handleLanguageChange('ru')}
        >
          <Text style={styles.buttonText}>Русский</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: '#666',
  },
  info: {
    fontSize: 16,
    marginBottom: 30,
    color: '#888',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    margin: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
