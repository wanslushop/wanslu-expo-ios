import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { WebView } from 'react-native-webview';
import { useAuth } from './context/AuthContext';
import { useCurrency } from './context/CurrencyContext';
import { useI18n } from './context/I18nContext';

const PRESET_AMOUNTS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

interface UserInfo {
  id: number;
  username: string;
  email: string;
  balance: number;
}

interface CurrencyData {
  currency: string;
  symbol: string;
  base_rate: number;
  markup: string;
  final_rate: number; // local -> CNY rate denominator, same semantics as web: cny = amount / final_rate
  last_updated: string;
  next_update: string;
}

export default function AddFundsScreen() {
  const { authToken } = useAuth();
  const { t } = useI18n();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const [currencyData, setCurrencyData] = useState<CurrencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentBody, setPaymentBody] = useState<string>('');
  const [webProgress, setWebProgress] = useState(0);
  const [currencyError, setCurrencyError] = useState(false);
  const { convertPrice } = useCurrency();


  const currencySymbol = useMemo(() => currencyData?.symbol || '$', [currencyData]);

  const fetchUserData = async () => {
    try {
      if (!authToken) {
        router.replace('/login');
        return;
      }
      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            balance: parseFloat(data.user.balance) || 0,
          });
        }
      }
    } catch (e) {
      console.error('User data error:', e);
    }
  };

  const fetchCurrency = async () => {
    try {
      setCurrencyError(false);
      // Get currency from local storage
      const langCurrencyData = await AsyncStorage.getItem('lang-currency');
      let currency = 'CNY'; // default fallback
      
      if (langCurrencyData) {
        try {
          const parsed = JSON.parse(langCurrencyData);
          currency = parsed.currency || 'CNY';
        } catch (e) {
          console.warn('Failed to parse lang-currency data:', e);
        }
      }

      const response = await fetch(`https://api.wanslu.shop/api/etc/currencyrate?currency=${currency}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success' && data.data) {
          const currencyInfo = data.data;
          setCurrencyData({
            currency: currencyInfo.currency || currency,
            symbol: currencyInfo.symbol || '¥',
            base_rate: Number(currencyInfo.base_rate) || 1,
            markup: currencyInfo.markup || '0',
            final_rate: Number(currencyInfo.final_rate) || 1,
            last_updated: currencyInfo.last_updated || '',
            next_update: currencyInfo.next_update || '',
          });
          return;
        }
      }
      
      // Fallback if API fails
      setCurrencyError(true);
      setCurrencyData({ 
        currency: currency, 
        symbol: currency === 'CNY' ? '¥' : '$', 
        base_rate: 1,
        markup: '0',
        final_rate: 1,
        last_updated: '',
        next_update: '',
      });
    } catch (error) {
      console.error('Currency fetch error:', error);
      setCurrencyError(true);
      setCurrencyData({ 
        currency: 'CNY', 
        symbol: '¥', 
        base_rate: 1,
        markup: '0',
        final_rate: 1,
        last_updated: '',
        next_update: '',
      });
    }
  };

  useEffect(() => {
    Promise.all([fetchUserData(), fetchCurrency()]).finally(() => setLoading(false));
  }, [authToken]);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const numeric = parseFloat(val || '0');
    if (!isFinite(numeric)) {
      setConvertedAmount(0);
      return;
    }
    if (currencyData && currencyData.final_rate) {
      if (currencyData.currency !== 'CNY') {
        setConvertedAmount(Number((numeric / currencyData.final_rate).toFixed(2)));
        return;
      }
    }
    setConvertedAmount(Number(numeric.toFixed(2)));
  };

  const handlePresetClick = (val: number) => {
    handleAmountChange(String(val));
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('addFunds.userNotLoaded'));
      return;
    }
    const numAmount = parseFloat(amount || '0');
    if (!isFinite(numAmount) || numAmount <= 0) {
      Alert.alert(t('common.error'), t('addFunds.pleaseEnterValidAmount'));
      return;
    }
    setSubmitting(true);
    try {
      const body = new URLSearchParams({
        amount: convertedAmount.toString(),
        uid: String(user.id),
        username: user.username,
        topup: 'true',
      }).toString();
      setPaymentBody(body);
      setPaymentVisible(true);
    } catch (e) {
      console.error('Open payment failed:', e);
      Alert.alert(t('common.error'), t('addFunds.failedToOpenPayment'));
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.title}>{t('addFunds.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('addFunds.currentBalance')}</Text>
          <Text style={styles.balanceAmount}>
            {user ? convertPrice(user.balance ?? 0) : '0.00'}
          </Text>
          {currencyError && (
            <View style={styles.currencyErrorContainer}>
              <Text style={styles.currencyErrorText}>
                {t('addFunds.currencyRatesUnavailable')}
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={fetchCurrency}
                disabled={loading}
              >
                <Ionicons name="refresh" size={16} color="white" />
                <Text style={styles.refreshButtonText}>{t('addFunds.refresh')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Amount Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('addFunds.enterAmount')} ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder={`${currencySymbol}0`}
            keyboardType="numeric"
            editable={!submitting}
          />
        </View>

        {/* Presets */}
        <View style={styles.presetContainer}>
          {PRESET_AMOUNTS.map((val) => {
            const selected = parseFloat(amount || '0') === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.presetButton, selected && styles.presetButtonSelected]}
                onPress={() => handlePresetClick(val)}
                disabled={submitting}
              >
                <Text style={[styles.presetText, selected && styles.presetTextSelected]}>
                  {currencySymbol}{val}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary */}
        {parseFloat(amount || '0') > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>{t('addFunds.paymentSummary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('addFunds.youWillPay')}</Text>
              <Text style={styles.summaryValue}>
                {currencySymbol}{parseFloat(amount || '0').toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('addFunds.chargedIn')}</Text>
              <Text style={styles.summaryValue}>CNY ¥{convertedAmount.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, (parseFloat(amount || '0') <= 0 || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={parseFloat(amount || '0') <= 0 || submitting}
        >
          {submitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.submitButtonText}>{t('addFunds.opening')}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{t('addFunds.proceedToPay')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      {paymentVisible && (
        <View style={styles.webviewOverlay}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setPaymentVisible(false)} style={styles.webviewBackButton}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>{t('addFunds.completePayment')}</Text>
            <View style={{ width: 22 }} />
          </View>
          {webProgress > 0 && webProgress < 1 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${Math.max(5, Math.floor(webProgress * 100))}%` }]} />
            </View>
          )}
          <WebView
            originWhitelist={["*"]}
            source={{
              uri: 'https://pay2.wanslu.shop/',
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: paymentBody,
            }}
            onLoadStart={() => setWebProgress(0)}
            onLoadProgress={({ nativeEvent }) => setWebProgress(nativeEvent.progress || 0)}
            onLoadEnd={() => setWebProgress(1)}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data || '{}');
                if (data && data.status === 'success') {
                  Alert.alert(t('common.success'), t('addFunds.rechargeSuccessful'), [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        setPaymentVisible(false);
                        router.push('/wallet');
                      },
                    },
                  ]);
                } else if (data && data.status === 'failed') {
                  Alert.alert(t('addFunds.paymentFailed'), data.message || t('addFunds.paymentNotCompleted'));
                }
              } catch (_e) {}
            }}
            onNavigationStateChange={(navState) => {
              const url = navState?.url || '';
              if (/success/i.test(url) || /status=success/i.test(url)) {
                Alert.alert(t('common.success'), t('addFunds.topupRequestSubmittedSuccessfully'), [
                  {
                    text: t('common.ok'),
                    onPress: () => {
                      setPaymentVisible(false);
                      router.push('/wallet');
                    },
                  },
                ]);
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color="#ef4444" />
                <Text style={styles.loadingText}>{t('addFunds.loadingPayment')}</Text>
              </View>
            )}
            style={styles.webview}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

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
  currencyErrorContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  currencyErrorText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    borderWidth: 2,
    borderColor: '#ed2027',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  presetButtonSelected: {
    backgroundColor: '#fff1f2',
  },
  presetText: {
    fontSize: 16,
    color: '#ed2027',
    fontWeight: '600',
  },
  presetTextSelected: {
    color: '#b91c1c',
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#f3f4f6',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: '#ef4444',
  },
  webviewOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  webviewBackButton: {
    padding: 6,
  },
  webviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  },
  webviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
});


