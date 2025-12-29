import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';
import { getIPAddress } from './utils/visitor-api';

const GEO_DATA_KEY = 'geo-data';

interface BankMethod {
  id: number;
  name: string;
  fees_static: number;
  fees_percentage: number;
  currency: string | null;
  code: string;
}

interface Country {
  country_name: string;
  country_code: string;
  methods: BankMethod[];
}

export default function WithdrawScreen() {
  const { authToken } = useAuth();
  const { t } = useI18n();
  const { convertPrice, currencyData } = useCurrency();

  // State for countries and banks
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [methods, setMethods] = useState<BankMethod[]>([]); // Methods for the selected country
  const [selectedMethod, setSelectedMethod] = useState<BankMethod | null>(null);

  // Withdrawal state
  const [amount, setAmount] = useState(''); // Amount in input currency
  const [amountInCNY, setAmountInCNY] = useState(0); // Amount converted to CNY for server
  const [fees, setFees] = useState(0);
  const [feesInCNY, setFeesInCNY] = useState(0);
  const [receivingName, setReceivingName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Geo data (used for default selection if needed, but mainly we use the picker now)
  const [geoCountry, setGeoCountry] = useState('');
  const [geoCountryName, setGeoCountryName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [user, setUser] = useState<{ username: string; email: string; uid: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [amountToReceive, setAmountToReceive] = useState(0);
  const [ipAddress, setIpAddress] = useState('');

  // Currency Rate for selected bank
  const [bankCurrencyRate, setBankCurrencyRate] = useState<number | null>(null);
  const [bankCurrencySymbol, setBankCurrencySymbol] = useState<string>('');

  const [minWithdrawCNY, setMinWithdrawCNY] = useState<number>(100); // Default fallback

  // Fetch withdrawal methods
  useEffect(() => {
    fetchWithdrawalMethods();
    fetchMinimums();
  }, []);

  const fetchMinimums = async () => {
    try {
      const response = await fetch("https://api.wanslu.shop/api/etc/minimums");
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data && data.data.length > 0) {
          setMinWithdrawCNY(data.data[0].minwithdrawvalue || 100);
        }
      }
    } catch {
      // ignore, use default
    }
  };

  // Fetch user and balance
  useEffect(() => {
    if (authToken) {
      fetchUserData();
    }
  }, [authToken]);

  // Load country and IP from geo data
  useEffect(() => {
    const loadCountryAndIP = async () => {
      try {
        const geoDataStr = await AsyncStorage.getItem(GEO_DATA_KEY);
        if (geoDataStr) {
          const geoData = JSON.parse(geoDataStr);
          if (geoData.countryCode) {
            setGeoCountry(geoData.countryCode);
          }
          if (geoData.countryName) {
            setGeoCountryName(geoData.countryName);
          }
        }

        // Get IP address
        const ip = await getIPAddress();
        if (ip) {
          setIpAddress(ip);
        }
      } catch (error) {
        console.error('Failed to load country/IP from geo data:', error);
        setGeoCountry('US');
        setGeoCountryName('United States');
      }
    };
    loadCountryAndIP();
  }, []);

  // Update methods when country changes
  useEffect(() => {
    if (selectedCountry) {
      console.log('Selected country changed to:', selectedCountry.country_name);
      setMethods(selectedCountry.methods);
      // Reset selected method when country changes
      setSelectedMethod(null);
    } else {
      setMethods([]);
      setSelectedMethod(null);
    }
  }, [selectedCountry]);

  // Fetch currency rate for the selected bank
  const fetchBankCurrencyRate = async (currencyCode: string) => {
    try {
      setLoadingBanks(true); // Reuse loading state or add a new one
      console.log(`Fetching rate for bank currency: ${currencyCode}`);
      const response = await fetch(`https://api.wanslu.shop/api/etc/currencyrate?currency=${currencyCode}`, {
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          console.log('Bank currency rate fetched:', data.data);
          setBankCurrencyRate(data.data.final_rate);
          setBankCurrencySymbol(data.data.symbol);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bank currency rate:', error);
    } finally {
      setLoadingBanks(false);
    }
  };

  // Effect to handle bank selection and currency fetching
  useEffect(() => {
    if (selectedMethod) {
      if (selectedMethod.currency) {
        // Bank has a specific currency, fetch its rate
        fetchBankCurrencyRate(selectedMethod.currency);
      } else {
        // Bank uses default/global currency (likely USD or user's currency), reset bank specific rate
        setBankCurrencyRate(null);
        setBankCurrencySymbol('');
      }
    } else {
      setBankCurrencyRate(null);
      setBankCurrencySymbol('');
    }
  }, [selectedMethod]);

  // Calculate fees and convert to CNY when amount or method changes
  useEffect(() => {
    console.log('Fee calculation useEffect triggered:', {
      hasSelectedMethod: !!selectedMethod,
      selectedMethodId: selectedMethod?.id,
      selectedMethodName: selectedMethod?.name,
      amount: amount,
      hasCurrencyData: !!currencyData,
      bankCurrencyRate,
    });

    // Only reset fees if we don't have a valid method or amount
    if (!selectedMethod) {
      setAmountInCNY(0);
      setFees(0);
      setFeesInCNY(0);
      setAmountToReceive(0);
      return;
    }

    if (!amount) {
      setAmountInCNY(0);
      setFees(0);
      setFeesInCNY(0);
      setAmountToReceive(0);
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountInCNY(0);
      setFees(0);
      setFeesInCNY(0);
      setAmountToReceive(0);
      return;
    }

    // Determine which rate to use
    // If bankCurrencyRate is set, we are converting FROM Bank Currency TO CNY
    // If not, we are converting FROM User Currency TO CNY
    let currentRate = 1;
    let currentCurrency = 'USD';

    if (bankCurrencyRate) {
      currentRate = bankCurrencyRate;
      currentCurrency = selectedMethod.currency || 'USD';
    } else if (currencyData && currencyData.final_rate) {
      currentRate = currencyData.final_rate;
      currentCurrency = currencyData.currency;
    }

    // Convert input amount to CNY
    // Rate is usually "How much User Currency for 1 CNY" (e.g. 7.2 CNY/USD? No, usually 1 CNY = X UserCurrency)
    // Wait, let's check CurrencyContext.
    // convertPrice = price * currencyData.final_rate.
    // So if price is in CNY, we multiply by rate to get User Currency.
    // So Rate = UserCurrency / CNY.
    // To get CNY from UserCurrency: UserCurrency / Rate = CNY.

    const amountCNY = numAmount / currentRate;
    setAmountInCNY(amountCNY);

    // Calculate fees
    const staticFee = Number(selectedMethod.fees_static); // In CNY
    const percentFee = Number(selectedMethod.fees_percentage);

    // Static fee is in CNY.
    const staticFeeCNY = staticFee;
    const percentFeeCNY = (amountCNY * percentFee) / 100;
    const totalFeesCNY = staticFeeCNY + percentFeeCNY;

    setFeesInCNY(totalFeesCNY);

    // Convert fees back to display currency
    const feesInDisplayCurrency = totalFeesCNY * currentRate;
    setFees(Number(feesInDisplayCurrency.toFixed(2)));

    setAmountToReceive(numAmount - feesInDisplayCurrency);

  }, [amount, selectedMethod, currencyData, bankCurrencyRate]);

  const fetchWithdrawalMethods = async (isRetry = false) => {
    if (!isRetry) {
      setLoadingBanks(true);
    }

    try {
      console.log('Fetching bank methods...', isRetry ? '(retry)' : '(initial)');
      const response = await fetch('https://api.wanslu.shop/api/etc/banks', {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Bank methods response:', data);
        if (data.status === 'success' && Array.isArray(data.data)) {
          const fetchedCountries: Country[] = data.data;
          setCountries(fetchedCountries);

          // Try to auto-select country based on geo-location if available
          // Only if no country is currently selected
          if (!selectedCountry && geoCountry) {
            const matchedCountry = fetchedCountries.find(c => c.country_code === geoCountry);
            if (matchedCountry) {
              setSelectedCountry(matchedCountry);
              // Methods will be set by the useEffect
            }
          }
        } else {
          throw new Error('API returned unsuccessful status or invalid format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawal methods:', error);

      if (!isRetry) {
        // First attempt failed, retry after 4 seconds
        console.log('Retrying bank methods fetch in 4 seconds...');
        setTimeout(() => {
          console.log('Executing retry...');
          fetchWithdrawalMethods(true);
        }, 4000);
      } else {
        // Retry also failed, show error
        Alert.alert(t('common.error'), t('withdraw.errors.failedToLoadBankMethodsAfterRetry'));
      }
    } finally {
      if (!isRetry) {
        setLoadingBanks(false);
      }
    }
  };

  // Auto-retry after 4 seconds if still loading
  useEffect(() => {
    if (loadingBanks) {
      const timeout = setTimeout(() => {
        if (loadingBanks && countries.length === 0) {
          console.log('4 seconds passed, showing retry option');
          setLoadingBanks(false);
        }
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [loadingBanks, countries.length]);

  const fetchUserData = async () => {
    if (!authToken) {
      router.replace('/login');
      return;
    }

    try {
      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({
            username: data.user.username,
            email: data.user.email,
            uid: data.user.id || data.user.uid || 0,
          });
          setAvailableBalance(parseFloat(data.user.balance) || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      Alert.alert(t('common.error'), t('wallet.errors.failedToLoadUser'));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !selectedMethod || !selectedCountry) {
      Alert.alert(t('common.error'), t('withdraw.errors.fillRequiredFields'));
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || amountInCNY < minWithdrawCNY) {
      // Convert min withdraw to user currency for display
      let minWithdrawDisplay = minWithdrawCNY;
      if (currencyData && currencyData.final_rate && currencyData.currency !== 'CNY') {
        minWithdrawDisplay = minWithdrawCNY * currencyData.final_rate;
      }
      Alert.alert(t('common.error'), t('withdraw.errors.minimumWithdrawalAmount', { amount: convertPrice(minWithdrawCNY) }));
      return;
    }

    if (availableBalance !== null && amountInCNY > availableBalance) {
      Alert.alert(t('common.error'), t('withdraw.errors.insufficientBalance'));
      return;
    }

    setSubmitting(true);

    try {
      // Determine which currency and rate to send
      const currencyToSend = bankCurrencyRate && selectedMethod.currency
        ? selectedMethod.currency
        : (currencyData?.currency || 'USD');

      const rateToSend = bankCurrencyRate
        ? bankCurrencyRate
        : (currencyData?.final_rate || 1);

      const response = await fetch('https://api.wanslu.shop/api/account/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCNY, // CNY amount without fees
          fees: feesInCNY, // Send fees in CNY to server
          bank: selectedMethod.id,
          name: receivingName,
          account: accountNumber,
          country: selectedCountry.country_code, // Use selected country code
          usercurrency: currencyToSend, // User's currency code (or Bank's)
          usercurrencyrate: rateToSend, // User's currency rate (or Bank's)
          cnyamount: amountInCNY - feesInCNY, // CNY amount without fees
          ip: ipAddress, // IP address
          country_name: selectedCountry.country_name, // Full country name
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // Update balance with the new balance from API
        if (data.data && data.data.new_balance !== undefined) {
          setAvailableBalance(data.data.new_balance);
        }

        Alert.alert(
          t('common.success'),
          `${t('withdraw.success.submitted')}\n\n${t('withdraw.success.details', { id: data.data?.withdrawal_id || 'N/A', amount: convertPrice(data.data?.new_balance || 0) })}`,
          [
            {
              text: t('common.ok'),
              onPress: () => {
                // Reset form
                setAmount('');
                setReceivingName('');
                setAccountNumber('');
                setFees(0);

                // Navigate back to wallet with refresh parameter
                router.push({
                  pathname: '/wallet',
                  params: { refresh: 'true' }
                });
              },
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), data.message || t('withdraw.errors.withdrawalFailed'));
      }
    } catch (error) {
      console.error('Withdrawal failed:', error);
      Alert.alert(t('common.error'), t('withdraw.errors.withdrawalFailedTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    const numAmount = parseFloat(amount);
    const isValid = (
      amount &&
      receivingName &&
      accountNumber &&
      selectedMethod &&
      selectedCountry &&
      !isNaN(numAmount) &&
      numAmount > 0 &&
      amountInCNY >= minWithdrawCNY &&
      (availableBalance === null || amountInCNY <= availableBalance)
    );

    return isValid;
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('withdraw.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Available Balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('withdraw.availableBalance')}</Text>
          <Text style={styles.balanceAmount}>
            {availableBalance !== null ? convertPrice(availableBalance) : convertPrice(0)}
          </Text>
          {availableBalance !== null && bankCurrencyRate && selectedMethod?.currency && selectedMethod.currency !== currencyData?.currency && (
            <Text style={styles.convertedBalanceText}>
              = {(availableBalance * bankCurrencyRate).toFixed(2)} {selectedMethod.currency}
            </Text>
          )}
          {geoCountryName && (
            <Text style={styles.countryText}>{t('withdraw.countryLabel')} {geoCountryName}</Text>
          )}
        </View>

        {/* Country Selection */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('withdraw.selectCountry') || 'Select Country'}</Text>
          <View style={styles.pickerContainer}>
            {loadingBanks ? (
              <View style={styles.loadingBanksContainer}>
                <ActivityIndicator size="small" color="#ef4444" />
                <Text style={styles.loadingBanksText}>{t('withdraw.loadingCountries') || 'Loading Countries...'}</Text>
              </View>
            ) : (
              <RNPickerSelect
                value={selectedCountry?.country_code || null}
                onValueChange={(value) => {
                  const country = countries.find(c => c.country_code === value);
                  setSelectedCountry(country || null);
                }}
                items={countries.map(c => ({
                  label: c.country_name,
                  value: c.country_code,
                }))}
                placeholder={{ label: t('withdraw.selectCountry') || 'Select Country', value: null }}
                style={pickerSelectStyles}
                disabled={submitting}
              />
            )}
          </View>
        </View>

        {/* Bank Method Selection */}
        {selectedCountry && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('withdraw.selectBankMethod')}</Text>
            <View style={styles.pickerContainer}>
              {methods.length > 0 ? (
                <RNPickerSelect
                  value={selectedMethod?.id || null}
                  onValueChange={(value) => {
                    if (value === null) {
                      setSelectedMethod(null);
                      return;
                    }
                    const method = methods.find(m => m.id === value || m.id === Number(value) || String(m.id) === String(value));
                    if (method) {
                      setSelectedMethod(method);
                    }
                  }}
                  items={methods.map(method => ({
                    label: method.name,
                    value: method.id,
                  }))}
                  placeholder={{ label: t('withdraw.selectBankMethod'), value: null }}
                  style={pickerSelectStyles}
                  disabled={submitting}
                />
              ) : (
                <View style={styles.noBanksContainer}>
                  <Text style={styles.noBanksText}>{t('withdraw.noBanksForCountry') || 'No banks available for this country'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Amount Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {t('withdraw.enterAmount')} ({selectedMethod?.currency || currencyData?.currency || 'USD'})
          </Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder={`Enter amount in ${selectedMethod?.currency || currencyData?.currency || 'your currency'}`}
            keyboardType="numeric"
            editable={!submitting}
          />
          <View style={styles.helperTextContainer}>
            <Text style={styles.helperText}>
              {t('withdraw.minimum')}: {bankCurrencyRate ? (minWithdrawCNY * bankCurrencyRate).toFixed(2) + ' ' + selectedMethod?.currency : convertPrice(minWithdrawCNY)}
            </Text>
            {amount && parseFloat(amount) > 0 && amountInCNY > 0 && (
              <Text style={styles.conversionText}>
                ~ {minWithdrawCNY} CNY
              </Text>
            )}
          </View>
        </View>

        {/* Fees Display */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('withdraw.fees')}</Text>
          <View style={styles.feesContainer}>
            <Text style={styles.feesText}>
              {bankCurrencyRate
                ? (feesInCNY * bankCurrencyRate).toFixed(2) + ' ' + selectedMethod?.currency
                : convertPrice(feesInCNY)}
            </Text>
          </View>
          {selectedMethod && (
            <Text style={styles.helperText}>
              {t('withdraw.feesBreakdown', { static: convertPrice(selectedMethod.fees_static), percent: selectedMethod.fees_percentage })}
            </Text>
          )}
        </View>

        {/* Amount to Receive */}
        {amount && parseFloat(amount) > 0 && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('withdraw.amountToReceive') || 'Amount to Receive'}</Text>
            <View style={styles.receiveContainer}>
              <Text style={styles.receiveText}>
                {(amountToReceive).toFixed(2)} {selectedMethod?.currency || currencyData?.currency || 'USD'}
              </Text>
            </View>
            <Text style={styles.helperText}>
              {t('withdraw.amountToReceiveDescription') || 'Amount you will receive after fees'}
            </Text>
          </View>
        )}

        {/* Receiving Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('withdraw.receivingName')}</Text>
          <TextInput
            style={styles.input}
            value={receivingName}
            onChangeText={setReceivingName}
            placeholderTextColor="#999" placeholder={t('withdraw.placeholderName')}
            editable={!submitting}
          />
        </View>

        {/* Account Number */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('withdraw.accountNumber')}</Text>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholderTextColor="#999" placeholder={t('withdraw.placeholderAccount')}
            editable={!submitting}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isFormValid() || (availableBalance !== null && amountInCNY > availableBalance)) && styles.submitButtonDisabled
          ]}
          onPress={handleWithdraw}
          disabled={!isFormValid() || submitting || (availableBalance !== null && amountInCNY > availableBalance)}
        >
          {submitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.submitButtonText}>{t('withdraw.processing')}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>
              {availableBalance !== null && amountInCNY > availableBalance
                ? (t('withdraw.errors.insufficientBalance') || 'Insufficient Balance')
                : t('withdraw.submitWithdrawal')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Summary */}
        {amount && selectedMethod && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>{t('withdraw.summaryTitle')}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('withdraw.amount')}</Text>
              <Text style={styles.summaryValue}>
                {bankCurrencyRate && selectedMethod?.currency
                  ? parseFloat(amount).toFixed(2) + ' ' + selectedMethod.currency
                  : convertPrice(parseFloat(amount))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('withdraw.fees')}:</Text>
              <Text style={styles.summaryValue}>
                {bankCurrencyRate && selectedMethod?.currency
                  ? (feesInCNY * bankCurrencyRate).toFixed(2) + ' ' + selectedMethod.currency
                  : convertPrice(feesInCNY)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('withdraw.amountToReceive') || 'Amount to Receive'}</Text>
              <Text style={styles.summaryValue}>
                {(amountToReceive).toFixed(2)} {selectedMethod?.currency || currencyData?.currency || 'USD'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('withdraw.bank')}</Text>
              <Text style={styles.summaryValue}>{selectedMethod ? selectedMethod.name : 'Unknown'}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    color: '#111827',
    paddingRight: 30,
    backgroundColor: 'white',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 16,
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
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 0 : 40,
    backgroundColor: '#ed2027',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  balanceCard: {
    backgroundColor: '#ef4444',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  convertedBalanceText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontWeight: '600',
  },
  countryText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  feesContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  feesText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  receiveContainer: {
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ecfdf5',
  },
  receiveText: {
    fontSize: 18,
    color: '#059669',
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  helperTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversionText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingBanksContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingBanksText: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  loadingBanksSubtext: {
    marginTop: 4,
    color: '#9ca3af',
    fontSize: 12,
  },
  noBanksContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noBanksText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  noBanksSubtext: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
