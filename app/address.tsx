import { Ionicons } from '@expo/vector-icons';
import { countries } from 'countries-list';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { useAuth } from './context/AuthContext';
import { useI18n } from './context/I18nContext';

interface Address {
  id: number;
  user_id: number;
  fname: string;
  lname: string;
  number: string;
  add1: string;
  add2: string;
  area: string | null;
  city: string;
  district: string;
  country: string;
  zip: number;
  time: string;
  updated_at: string;
  created_at: string;
}

interface AddressResponse {
  status: string;
  data: Address[];
  meta: {
    total: number;
    offset: number;
    limit: number;
    has_more: boolean;
  };
}

interface AreaData {
  id: number;
  parent: number;
  name: string;
  area_code: string;
  description: string;
  time: string;
  es: string;
  zh: string;
  "zh-hans": string;
  ar: string;
  fr: string;
  pt: string;
  ru: string;
  de: string;
  ja: string;
  ko: string;
  it: string;
  nl: string;
  tr: string;
  pl: string;
  sv: string;
  status: number;
}

interface AreaResponse {
  status: string;
  data: {
    countries: AreaData[];
    districts: AreaData[];
  };
}

// Create country options from the countries-list library
const countryOptions = Object.entries(countries).map(([code, country]) => ({
  label: `${country.name} (+${country.phone})`,
  value: country.name, // Use country name as value instead of code
  phone: country.phone,
  name: country.name,
}));

// Debug: Log first few country options
console.log('Country options sample:', countryOptions.slice(0, 3));

// Create dialing code options
const dialingCodeOptions = Object.entries(countries).map(([code, country]) => ({
  label: `${country.name} (+${country.phone})`,
  value: `+${country.phone}`,
  code: code,
  name: country.name,
}));

export default function AddressScreen() {
  const { authToken } = useAuth();
  const { t } = useI18n();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [apiCountries, setApiCountries] = useState<AreaData[]>([]);
  const [districts, setDistricts] = useState<AreaData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [districtDescription, setDistrictDescription] = useState<string>('');
  const [selectedDialingCode, setSelectedDialingCode] = useState<string>('+1');
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>('');
  const [formData, setFormData] = useState({
    fname: '',
    lname: '',
    number: '',
    add1: '',
    add2: '',
    city: '',
    district: '',
    country: '',
    zip: '',
  });

  useEffect(() => {
    if (!authToken) {
      router.replace('/login');
      return;
    }
    fetchAddresses();
    fetchAreas();
  }, [authToken]);

  const fetchAreas = async () => {
    try {
      const response = await fetch('https://api.wanslu.shop/api/etc/area');
      if (response.ok) {
        const data: AreaResponse = await response.json();
        if (data.status === 'success') {
          setApiCountries(data.data.countries);
          setDistricts(data.data.districts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch areas:', error);
      Alert.alert(t('common.error'), t('address.failedToLoadAreas'));
    }
  };

  const fetchAddresses = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('https://api.wanslu.shop/api/account/address', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data: AddressResponse = await response.json();
        if (data.status === 'success') {
          setAddresses(data.data);
        } else {
          throw new Error('Failed to fetch addresses');
        }
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      Alert.alert(t('common.error'), t('address.failedToLoadAddresses'));
    } finally {
      setLoading(false);
    }
  };

  const findDialingCode = (fullNumber: string) => {
    if (!fullNumber) return { dialingCode: '', localNumber: '' };

    const parts = fullNumber.split(' ');
    
    if (parts.length > 1) {
      const dialingCode = parts[0];
      const localNumber = parts.slice(1).join(' ');
      return { dialingCode, localNumber };
    }
    
    // Fallback for numbers without space
    const commonCodes = ['+1', '+44', '+86', '+91', '+81', '+49', '+33', '+39', '+34', '+7'];
    for (const code of commonCodes) {
      if (fullNumber.startsWith(code)) {
        return {
          dialingCode: code,
          localNumber: fullNumber.substring(code.length).trim(),
        };
      }
    }

    return { dialingCode: '', localNumber: fullNumber };
  };

  const handleInputChange = (name: string, value: string) => {
    if (name === 'localPhoneNumber') {
      setLocalPhoneNumber(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCountryChange = (value: string) => {
    console.log('Country selected:', value); // Debug log
    setSelectedCountry(value);
    setSelectedDistrict('');
    setDistrictDescription('');
    setFormData(prev => ({ ...prev, country: value, district: '' }));
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    const district = districts.find(d => d.name === value);
    setDistrictDescription(district?.description || '');
    setFormData(prev => ({ ...prev, district: value }));
  };

  const handleSubmit = async () => {
    const fullNumber = `${selectedDialingCode} ${localPhoneNumber}`;
    const submissionData = { ...formData, number: fullNumber };

    if (!authToken) {
      router.replace('/login');
      return;
    }

    try {
      const url = 'https://api.wanslu.shop/api/account/address';
      const method = editingAddress ? 'PUT' : 'POST';
      const body = editingAddress 
        ? { ...submissionData, id: editingAddress.id }
        : submissionData;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        Alert.alert(
          t('address.success'),
          editingAddress ? t('address.addressUpdatedSuccessfully') : t('address.addressAddedSuccessfully')
        );
        setIsModalVisible(false);
        setEditingAddress(null);
        resetForm();
        fetchAddresses();
      } else {
        throw new Error('Failed to save address');
      }
    } catch (error) {
      console.error('Failed to save address:', error);
      Alert.alert(t('common.error'), t('address.failedToSaveAddress'));
    }
  };

  const resetForm = () => {
    setFormData({
      fname: '',
      lname: '',
      number: '',
      add1: '',
      add2: '',
      city: '',
      district: '',
      country: '',
      zip: '',
    });
    setSelectedCountry('');
    setSelectedDistrict('');
    setDistrictDescription('');
    setSelectedDialingCode('+1');
    setLocalPhoneNumber('');
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalVisible(true);
  };

  const handleEdit = (address: Address) => {
    const { dialingCode, localNumber } = findDialingCode(address.number);
    setEditingAddress(address);
    setFormData({
      fname: address.fname,
      lname: address.lname,
      number: address.number,
      add1: address.add1,
      add2: address.add2 || '',
      city: address.city,
      district: address.district,
      country: address.country,
      zip: address.zip.toString(),
    });
    setSelectedCountry(address.country);
    setSelectedDistrict(address.district);
    setSelectedDialingCode(dialingCode || '+1');
    setLocalPhoneNumber(localNumber || '');
    const district = districts.find(d => d.name === address.district);
    setDistrictDescription(district?.description || '');
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!authToken) {
      router.replace('/login');
      return;
    }

    Alert.alert(
      t('address.deleteAddress'),
      t('address.areYouSureDelete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('address.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`https://api.wanslu.shop/api/account/address/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` },
              });

              if (response.ok) {
                Alert.alert(t('address.success'), t('address.addressDeletedSuccessfully'));
                fetchAddresses();
              } else {
                throw new Error('Failed to delete address');
              }
            } catch (error) {
              console.error('Failed to delete address:', error);
              Alert.alert(t('common.error'), t('address.failedToDeleteAddress'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('address.loadingAddresses')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
          <Text style={styles.title}>{t('address.title')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>{t('address.addNewAddress')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addressGrid}>
          {addresses.map((address) => (
            <View key={address.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressName}>
                  {address.fname} {address.lname}
                </Text>
                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEdit(address)}
                  >
                    <Ionicons name="pencil" size={16} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(address.id)}
                  >
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.addressDetails}>
                <Text style={styles.addressText}>
                  <Text style={styles.addressLabel}>{t('address.whatsapp')}: </Text>
                  {address.number}
                </Text>
                <Text style={styles.addressText}>{address.add1}</Text>
                {address.add2 && <Text style={styles.addressText}>{address.add2}</Text>}
                <Text style={styles.addressText}>
                  {address.city}, {address.zip}
                </Text>
                <Text style={styles.addressText}>
                  {address.district}, {address.country}
                </Text>
              </View>
              
              <Text style={styles.addressDate}>
                {new Date(address.updated_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setIsModalVisible(false);
                resetForm();
              }}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAddress ? t('address.editAddress') : t('address.addNew')}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.label}>{t('address.firstName')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.fname}
                  onChangeText={(value) => handleInputChange('fname', value)}
                  placeholderTextColor="#999" placeholder={t('address.enterFirstName')}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.label}>{t('address.lastName')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lname}
                  onChangeText={(value) => handleInputChange('lname', value)}
                  placeholderTextColor="#999" placeholder={t('address.enterLastName')}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('address.whatsappNumber')}</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryPickerButton}>
                                     <RNPickerSelect
                     value={selectedDialingCode}
                     onValueChange={(value) => {
                       console.log('Dialing code selected:', value); // Debug log
                       if (value) {
                         setSelectedDialingCode(value);
                       }
                     }}
                     items={dialingCodeOptions}
                     placeholder={{ label: t('address.selectCode'), value: null }}
                     style={pickerSelectStyles}
                     useNativeAndroidPickerStyle={false}
                     doneText={t('common.done')}
                   />
                 </View>
                 {selectedDialingCode && (
                   <Text style={styles.selectedValueText}>{t('common.select')}: {selectedDialingCode}</Text>
                 )}
                <TextInput
                  style={styles.phoneInput}
                  value={localPhoneNumber}
                  onChangeText={(value) => handleInputChange('localPhoneNumber', value)}
                  placeholderTextColor="#999" placeholder={t('address.enterPhoneNumber')}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('address.addressLine1')}</Text>
              <TextInput
                style={styles.input}
                value={formData.add1}
                onChangeText={(value) => handleInputChange('add1', value)}
                placeholderTextColor="#999" placeholder={t('address.enterAddressLine1')}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('address.addressLine2')}</Text>
              <TextInput
                style={styles.input}
                value={formData.add2}
                onChangeText={(value) => handleInputChange('add2', value)}
                placeholderTextColor="#999" placeholder={t('address.enterAddressLine2')}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.label}>{t('address.city')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(value) => handleInputChange('city', value)}
                  placeholderTextColor="#999" placeholder={t('address.enterCity')}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.label}>{t('address.zipCode')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.zip}
                  onChangeText={(value) => handleInputChange('zip', value)}
                  placeholderTextColor="#999" placeholder={t('address.enterZipCode')}
                  keyboardType="numeric"
                />
              </View>
            </View>

                         <View style={styles.formField}>
               <Text style={styles.label}>{t('address.country')}</Text>
               <View style={styles.pickerButton}>
                 <RNPickerSelect
                   value={selectedCountry}
                   onValueChange={(value) => {
                     console.log('RNPickerSelect onValueChange:', value); // Debug log
                     if (value) {
                       handleCountryChange(value);
                     }
                   }}
                   items={countryOptions}
                   placeholder={{ label: t('address.selectCountry'), value: null }}
                   style={pickerSelectStyles}
                   useNativeAndroidPickerStyle={false}
                   doneText={t('common.done')}
                 />
                 {selectedCountry && (
                   <Text style={styles.selectedValueText}>{t('common.select')}: {selectedCountry}</Text>
                 )}
               </View>
             </View>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('address.district')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  if (selectedCountry) {
                    // Show district picker
                    const availableDistricts = districts.filter(
                      district => district.parent === apiCountries.find(c => c.name === selectedCountry)?.id
                    );
                    if (availableDistricts.length > 0) {
                      // For now, we'll use a simple alert picker
                      // In a real app, you'd want a proper modal picker
                      Alert.alert(
                        t('address.selectDistrict'),
                        t('address.selectDistrict'),
                        availableDistricts.map(district => ({
                          text: district.name,
                          onPress: () => handleDistrictChange(district.name),
                        }))
                      );
                    }
                  } else {
                    Alert.alert(t('address.pleaseSelectCountryFirst'));
                  }
                }}
              >
                <Text style={selectedDistrict ? styles.pickerText : styles.pickerPlaceholder}>
                  {selectedDistrict || t('address.selectDistrict')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#6b7280" />
              </TouchableOpacity>
              {districtDescription && (
                <Text style={styles.descriptionText}>{districtDescription}</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>{t('address.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                <Text style={styles.saveButtonText}>
                  {editingAddress ? t('address.update') : t('address.add')} {t('address.address')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    color: '#111827',
    paddingRight: 30,
    backgroundColor: 'white',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    color: '#111827',
    paddingRight: 30,
    backgroundColor: 'white',
  },
  placeholder: {
    color: '#9ca3af',
  },
});

const styles = StyleSheet.create({
  container: {
    marginTop: Platform.OS === 'ios' ? 0 : 40,
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  pageHeader: {
    backgroundColor: '#ef4444',
    // paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ed2027',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    color: 'white'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  addressGrid: {
    padding: 16,
  },
  addressCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  addressDetails: {
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  addressLabel: {
    color: '#9ca3af',
  },
  addressDate: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formField: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryPickerButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    minWidth: 120,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  pickerText: {
    fontSize: 16,
    color: '#111827',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  descriptionText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedValueText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  backButton: {
    padding: 8,
  },
});
