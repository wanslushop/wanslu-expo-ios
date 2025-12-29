import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

interface Country {
  id: number;
  name: string;
}

interface District {
  id: number;
  parent: number;
  name: string;
}

interface ShippingOption {
  carrier_id: number;
  carrier_name: string;
  carrier_logo: string;
  cost: number;
  delivery_time: string;
  description: string;
  billing_method: string;
  template_id: number;
}

interface ShippingMetrics {
  weight: number;
  volume: number;
  goods_type: string;
}

interface ShippingResponse {
  shipping_options: ShippingOption[];
  metrics: ShippingMetrics;
}

export default function ShippingEstimateScreen() {
  const router = useRouter();
  const { convertPrice, loading: currencyLoading } = useCurrency();
  const { t } = useI18n();
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [weight, setWeight] = useState<string>('100');
  const [length, setLength] = useState<string>('15');
  const [breadth, setBreadth] = useState<string>('10');
  const [height, setHeight] = useState<string>('5');
  const [type, setType] = useState<string>('1');

  const [shippingResult, setShippingResult] = useState<ShippingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dropdown states
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  useEffect(() => {
    const fetchAreaData = async () => {
      try {
        const response = await fetch('https://api.wanslu.shop/api/etc/area', {
          headers: {
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        if (data.status === 'success') {
          setCountries(data.data.countries);
          setDistricts(data.data.districts);
        } else {
          setError(t('shippingEstimate.errors.failedToLoadAreaData'));
        }
      } catch (error) {
        console.error("Failed to fetch area data:", error);
        setError(t('shippingEstimate.errors.errorFetchingAreaData'));
      }
    };

    fetchAreaData();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      const countryId = parseInt(selectedCountry, 10);
      const filtered = districts.filter(d => d.parent === countryId);
      setFilteredDistricts(filtered);
      setSelectedDistrict('');
    } else {
      setFilteredDistricts([]);
    }
  }, [selectedCountry, districts]);

  const handleSubmit = async () => {
    setLoading(true);
    setShippingResult(null);
    setError(null);

    const payload = {
      country: selectedCountry,
      district: selectedDistrict,
      weight: parseFloat(weight) / 1000, // g to kg
      length: parseFloat(length),
      breadth: parseFloat(breadth),
      height: parseFloat(height),
      type: type
    };

    try {
      const response = await fetch('https://api.wanslu.shop/api/etc/shipping/estimate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.status === 'success') {
        if (result.data) {
          setShippingResult(result.data);
          if (result.data.shipping_options.length === 0) {
            setError(t('shippingEstimate.noOptionsForCriteria'));
          }
        } else {
          setError(result.message || t('shippingEstimate.errors.noOptionsAvailable'));
        }
      } else {
        setError(result.message || t('shippingEstimate.errors.failedToGetEstimate'));
      }
    } catch (error) {
      console.error("Failed to fetch shipping estimate:", error);
      setError(t('shippingEstimate.errors.errorFetchingEstimate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shippingEstimate.header')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        

        {/* Form Container */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>{t('shippingEstimate.pageTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('shippingEstimate.subtitle')}
          </Text>

          <View style={styles.form}>
            {/* Country and District */}
            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.country')}</Text>
                <TouchableOpacity 
                  style={styles.selectContainer}
                  onPress={() => setShowCountryDropdown(true)}
                >
                  <Text style={styles.selectText}>
                    {selectedCountry ? countries.find(c => c.id.toString() === selectedCountry)?.name || t('shippingEstimate.selectCountry') : t('shippingEstimate.selectCountry')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.area')}</Text>
                <TouchableOpacity 
                  style={[styles.selectContainer, !selectedCountry && styles.selectDisabled]}
                  onPress={() => selectedCountry && setShowDistrictDropdown(true)}
                  disabled={!selectedCountry}
                >
                  <Text style={[styles.selectText, !selectedCountry && styles.selectTextDisabled]}>
                    {selectedDistrict ? filteredDistricts.find(d => d.id.toString() === selectedDistrict)?.name || t('shippingEstimate.selectDistrict') : t('shippingEstimate.selectDistrict')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={!selectedCountry ? "#ccc" : "#666"} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weight and Type */}
            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.weightGrams')}</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder={t('shippingEstimate.weightPlaceholder')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.typeOfGoods')}</Text>
                <TouchableOpacity 
                  style={styles.selectContainer}
                  onPress={() => setShowTypeDropdown(true)}
                >
                  <Text style={styles.selectText}>
                    {type === '1' ? t('shippingEstimate.goodsGeneral') : type === '2' ? t('shippingEstimate.goodsSensitive') : t('shippingEstimate.goodsBoth')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dimensions */}
            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.lengthCm')}</Text>
                <TextInput
                  style={styles.input}
                  value={length}
                  onChangeText={setLength}
                  placeholder={t('shippingEstimate.lengthPlaceholder')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.breadthCm')}</Text>
                <TextInput
                  style={styles.input}
                  value={breadth}
                  onChangeText={setBreadth}
                  placeholder={t('shippingEstimate.breadthPlaceholder')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('shippingEstimate.heightCm')}</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder={t('shippingEstimate.heightPlaceholder')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t('shippingEstimate.check')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#E53E3E" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {shippingResult && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>{t('shippingEstimate.estimationResults')}</Text>
            
            {/* Metrics */}
            <View style={styles.metricsContainer}>
              <Text style={styles.metricsTitle}>{t('shippingEstimate.metrics')}</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('shippingEstimate.metricWeight')}</Text>
                  <Text style={styles.metricValue}>{shippingResult.metrics.weight} {t('shippingEstimate.unitKg')}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('shippingEstimate.metricVolume')}</Text>
                  <Text style={styles.metricValue}>{shippingResult.metrics.volume} {t('shippingEstimate.unitCm3')}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('shippingEstimate.metricGoodsType')}</Text>
                  <Text style={styles.metricValue}>{shippingResult.metrics.goods_type}</Text>
                </View>
              </View>
            </View>

            {/* Shipping Options */}
            <View style={styles.optionsContainer}>
              {shippingResult.shipping_options.length > 0 ? (
                shippingResult.shipping_options.map((option) => (
                  <View key={option.template_id} style={styles.optionCard}>
                    <Image 
                      source={{ uri: option.carrier_logo }} 
                      style={styles.carrierLogo}
                      defaultSource={{ uri: 'https://via.placeholder.com/40x40/ccc/fff?text=Logo' }}
                    />
                    <View style={styles.optionContent}>
                      <Text style={styles.carrierName}>{option.carrier_name}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                      <Text style={styles.deliveryTime}>{option.delivery_time}</Text>
                    </View>
                    <View style={styles.optionPrice}>
                      <Text style={styles.priceText}>
                        {currencyLoading ? t('common.loading') : convertPrice(option.cost.toFixed(2))}
                      </Text>
                      <Text style={styles.billingMethod}>
                        {t('shippingEstimate.billing')} {option.billing_method}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noOptionsText}>{t('shippingEstimate.noOptionsForCriteria')}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Country Dropdown Modal */}
      <Modal
        visible={showCountryDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('shippingEstimate.modals.selectCountry')}</Text>
              <TouchableOpacity onPress={() => setShowCountryDropdown(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {countries.map((country) => (
                <TouchableOpacity
                  key={country.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCountry(country.id.toString());
                    setShowCountryDropdown(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{country.name}</Text>
                  {selectedCountry === country.id.toString() && (
                    <Ionicons name="checkmark" size={20} color="#E53E3E" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* District Dropdown Modal */}
      <Modal
        visible={showDistrictDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDistrictDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('shippingEstimate.modals.selectDistrict')}</Text>
              <TouchableOpacity onPress={() => setShowDistrictDropdown(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {filteredDistricts.map((district) => (
                <TouchableOpacity
                  key={district.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedDistrict(district.id.toString());
                    setShowDistrictDropdown(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{district.name}</Text>
                  {selectedDistrict === district.id.toString() && (
                    <Ionicons name="checkmark" size={20} color="#E53E3E" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Type Dropdown Modal */}
      <Modal
        visible={showTypeDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTypeDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('shippingEstimate.modals.selectTypeOfGoods')}</Text>
              <TouchableOpacity onPress={() => setShowTypeDropdown(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {[
                { value: '1', label: t('shippingEstimate.goodsGeneral') },
                { value: '2', label: t('shippingEstimate.goodsSensitive') },
                { value: '3', label: t('shippingEstimate.goodsBoth') }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalItem}
                  onPress={() => {
                    setType(option.value);
                    setShowTypeDropdown(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{option.label}</Text>
                  {type === option.value && (
                    <Ionicons name="checkmark" size={20} color="#E53E3E" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ed2027',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
    color: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  illustrationImage: {
    width: '100%',
    height: 200,
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  selectContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  selectDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ccc',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
  },
  selectTextDisabled: {
    color: '#999',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#ed2027',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#E53E3E',
    marginLeft: 8,
    flex: 1,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  metricsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  metricsGrid: {
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    color: '#333',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  carrierLogo: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  carrierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  deliveryTime: {
    fontSize: 12,
    color: '#999',
  },
  optionPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginBottom: 4,
  },
  billingMethod: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  noOptionsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
});