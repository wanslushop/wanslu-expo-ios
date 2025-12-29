import { Ionicons } from "@expo/vector-icons";
import { countries as allCountries } from 'countries-list';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from 'react-native-picker-select';
import { WebView } from "react-native-webview";
import { useAuth } from "./context/AuthContext";
import { useCartCount } from "./context/CartCountContext";
import { useCurrency } from "./context/CurrencyContext";
import { useI18n } from "./context/I18nContext";
import { useLangCurrency } from "./context/LangCurrencyContext";

const BANKS_API = "https://api.wanslu.shop/api/etc/banks";
const TRANSFER_API = "https://api.wanslu.shop/api/account/transfer/initiate";

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

export default function TransferScreen() {
  const router = useRouter();
  const { authToken, isAuthenticated } = useAuth();
  const { cartCount } = useCartCount();
  const { currency } = useLangCurrency();
  const { currencyData, convertPrice } = useCurrency();
  const params = useLocalSearchParams();
  const transferCurrency = (params.currency as string) || currency;
  const { t } = useI18n();

  // Step state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New Data State
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [methods, setMethods] = useState<BankMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<BankMethod | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(true);

  // Currency & Fees State
  const [bankCurrencyRate, setBankCurrencyRate] = useState<number | null>(null);
  const [bankCurrencySymbol, setBankCurrencySymbol] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState(0);
  const [feesInCNY, setFeesInCNY] = useState(0);
  const [amountInCNY, setAmountInCNY] = useState(0);
  const [amountToReceive, setAmountToReceive] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedDialingCode, setSelectedDialingCode] = useState<string>("+1");
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>("");

  // Payment WebView states
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentBody, setPaymentBody] = useState<string>('');
  const [webProgress, setWebProgress] = useState(0);
  const [referenceId, setReferenceId] = useState<string>('');

  // Step 1: Recipient details
  const [recipient, setRecipient] = useState({
    name: "",
    email: "",
    number: "",
    // amount moved to separate state
    // note moved to separate state or kept here? Let's keep note here for now but amount is separate
    note: "",
  });

  // Step 3: Account info (Step 2 is now Bank Selection)
  const [account, setAccount] = useState({
    // bank moved to selectedMethod
    accountNumber: "",
    extra: "",
    // country moved to selectedCountry
  });

  // Auth check and fetch user data
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await fetch("https://api.wanslu.shop/api/auth/me", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ping: true }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.user) {
            setUser(data.user);
            setLoading(false);
          } else {
            router.replace("/login");
          }
        } else {
          router.replace("/login");
        }
      } catch (error) {
        router.replace("/login");
      }
    };

    fetchUserData();
  }, [isAuthenticated, authToken, router]);

  // Fetch countries and banks
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        setLoadingBanks(true);
        const response = await fetch(BANKS_API, {
          headers: { Accept: 'application/json' },
        });
        const data = await response.json();
        if (data.status === 'success') {
          setCountries(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchBanks();
  }, []);

  // Update methods when country changes
  useEffect(() => {
    if (selectedCountry) {
      setMethods(selectedCountry.methods || []);
      setSelectedMethod(null);
    } else {
      setMethods([]);
      setSelectedMethod(null);
    }
  }, [selectedCountry]);

  // Fetch currency rate for the selected bank
  const fetchBankCurrencyRate = async (currencyCode: string) => {
    try {
      // setLoadingBanks(true); // Optional: show loading for rate
      console.log(`Fetching rate for bank currency: ${currencyCode}`);
      const response = await fetch(`https://api.wanslu.shop/api/etc/currencyrate?currency=${currencyCode}`, {
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setBankCurrencyRate(data.data.final_rate);
          setBankCurrencySymbol(data.data.symbol);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bank currency rate:', error);
    }
  };

  // Effect to handle bank selection and currency fetching
  useEffect(() => {
    if (selectedMethod) {
      if (selectedMethod.currency) {
        fetchBankCurrencyRate(selectedMethod.currency);
      } else {
        setBankCurrencyRate(null);
        setBankCurrencySymbol('');
      }
    } else {
      setBankCurrencyRate(null);
      setBankCurrencySymbol('');
    }
  }, [selectedMethod]);

  // Calculate fees and amounts
  useEffect(() => {
    if (!selectedMethod || !amount) {
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

    let currentRate = 1;
    if (bankCurrencyRate) {
      currentRate = bankCurrencyRate;
    } else if (currencyData && currencyData.final_rate) {
      currentRate = currencyData.final_rate;
    }

    // Convert input amount to CNY
    const amountCNY = numAmount / currentRate;
    setAmountInCNY(amountCNY);

    // Calculate fees
    const staticFee = Number(selectedMethod.fees_static);
    const percentFee = Number(selectedMethod.fees_percentage);
    const staticFeeCNY = staticFee;
    const percentFeeCNY = (amountCNY * percentFee) / 100;
    const totalFeesCNY = staticFeeCNY + percentFeeCNY;

    setFeesInCNY(totalFeesCNY);

    // Convert fees back to display currency
    const feesInDisplayCurrency = totalFeesCNY * currentRate;
    setFees(Number(feesInDisplayCurrency.toFixed(2)));

    setAmountToReceive(numAmount - feesInDisplayCurrency);

  }, [amount, selectedMethod, currencyData, bankCurrencyRate]);

  // Handlers
  const handleRecipientChange = (field: string, value: string) => {
    setRecipient({ ...recipient, [field]: value });
  };

  const handleAccountChange = (field: string, value: string) => {
    setAccount({ ...account, [field]: value });
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      const combinedNumber = `${selectedDialingCode} ${localPhoneNumber}`.trim();
      if (!recipient.name || !recipient.email || !localPhoneNumber || !selectedCountry) {
        setError(t('transfer.errors.pleaseFillAllFields'));
        return;
      }
      if (recipient.number !== combinedNumber) {
        setRecipient({ ...recipient, number: combinedNumber });
      }
    }
    if (step === 2) {
      if (!selectedMethod || !amount) {
        setError(t('transfer.errors.pleaseFillAllFields'));
        return;
      }
    }
    if (step === 3) {
      if (!account.accountNumber) {
        setError(t('transfer.errors.pleaseFillAllFields'));
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    if (!selectedMethod || !selectedMethod.id) {
      setError(t('transfer.errors.pleaseSelectBank') || "Please select a bank");
      setSubmitting(false);
      return;
    }

    try {
      const currencyToSend = bankCurrencyRate && selectedMethod?.currency
        ? selectedMethod.currency
        : (currencyData?.currency || 'USD');

      const rateToSend = bankCurrencyRate
        ? bankCurrencyRate
        : (currencyData?.final_rate || 1);

      const payload = {
        name: recipient.name,
        email: recipient.email,
        number: recipient.number,
        amount: parseFloat(amount), // Send in user/input currency
        fees: fees,                 // Send in user/input currency
        bank: selectedMethod.id,
        accountNumber: account.accountNumber,
        country: selectedCountry?.country_code,
        currency: currencyToSend,
        note: recipient.note,
        extra: account.extra,
        country_name: selectedCountry?.country_name,
        usercurrency: currencyToSend,
        usercurrencyrate: rateToSend,
        cnyamount: amountInCNY - feesInCNY,
      };

      console.log('Submitting transfer:', JSON.stringify(payload, null, 2));

      const res = await fetch(TRANSFER_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.status === "success" && data.data?.reference) {
        setReferenceId(data.data.reference);
        openPaymentWebView(data.data.reference);
      } else {
        console.error('Transfer failed:', data);
        setError(data.message || (data.errors ? JSON.stringify(data.errors) : t('transfer.errors.failedToInitiate')));
        setSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      setError(t('transfer.errors.failedToInitiate'));
      setSubmitting(false);
    }
  };

  const openPaymentWebView = async (reference: string) => {
    try {
      // Create form data for payment
      const body = new URLSearchParams({
        uid: user?.id,
        username: user?.username,
        transfer: reference,
        source: 'app'
      }).toString();

      setPaymentBody(body);
      setPaymentVisible(true);
    } catch (e) {
      console.error('Open payment failed:', e);
      Alert.alert('Error', 'Failed to open payment page');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            step >= s ? styles.stepDotActive : styles.stepDotInactive,
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('transfer.recipientDetails')}</Text>
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.recipientName')} *</Text>
          <TextInput
            style={styles.input}
            value={recipient.name}
            onChangeText={(value) => handleRecipientChange("name", value)}
            placeholder={t('transfer.enterRecipientName')}
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.recipientEmail')} *</Text>
          <TextInput
            style={styles.input}
            value={recipient.email}
            onChangeText={(value) => handleRecipientChange("email", value)}
            placeholder={t('transfer.enterRecipientEmail')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.recipientNumber')} *</Text>
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryPickerButton}>
              <RNPickerSelect
                value={selectedDialingCode}
                onValueChange={(value) => {
                  if (value) setSelectedDialingCode(value);
                }}
                items={Object.entries(allCountries as any).map(([code, ctry]: [string, any]) => ({
                  label: `${ctry.name} (+${ctry.phone})`,
                  value: `+${ctry.phone}`,
                }))}
                placeholder={{ label: t('address.selectCode'), value: null }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
                doneText={t('common.done')}
              />
            </View>
            <TextInput
              style={styles.phoneInput}
              value={localPhoneNumber}
              onChangeText={(value) => setLocalPhoneNumber(value)}
              placeholder={t('address.enterPhoneNumber')}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.country')} *</Text>
          <View style={styles.pickerContainer}>
            {loadingBanks ? (
              <ActivityIndicator size="small" color="#E53E3E" />
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
                placeholder={{ label: t('transfer.selectCountry'), value: null }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>{t('transfer.next')}</Text>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('transfer.bankDetails') || 'Bank Details'}</Text>
      <View style={styles.formContainer}>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.selectBankMethod') || 'Select Bank'}</Text>
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
                placeholder={{ label: t('transfer.selectBankMethod') || 'Select Bank', value: null }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            ) : (
              <View style={styles.noBanksContainer}>
                <Text style={styles.noBanksText}>{t('withdraw.noBanksForCountry') || 'No banks available for this country'}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t('transfer.amountToTransfer')} ({selectedMethod?.currency || currencyData?.currency || 'USD'}) *
          </Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder={t('transfer.enterAmount')}
            keyboardType="numeric"
          />
          {amount && parseFloat(amount) > 0 && amountInCNY > 0 && (
            <Text style={styles.conversionText}>
              ~ {amountInCNY.toFixed(2)} CNY
            </Text>
          )}
        </View>

        {/* Fees Display */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('withdraw.fees') || 'Fees'}</Text>
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
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('withdraw.amountToReceive') || 'Amount to Receive'}</Text>
            <View style={styles.receiveContainer}>
              <Text style={styles.receiveText}>
                {(amountToReceive).toFixed(2)} {selectedMethod?.currency || currencyData?.currency || 'USD'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.customMessage')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={recipient.note}
            onChangeText={(value) => handleRecipientChange("note", value)}
            placeholder={t('transfer.optionalMessage')}
            multiline
            numberOfLines={3}
          />
        </View>

      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color="#E53E3E" />
          <Text style={styles.backButtonText}>{t('transfer.back')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{t('transfer.next')}</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('transfer.accountInformation')}</Text>
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.accountNumber')} *</Text>
          <TextInput
            style={styles.input}
            value={account.accountNumber}
            onChangeText={(value) => handleAccountChange("accountNumber", value)}
            placeholder={t('transfer.accountNumber')}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('transfer.extraInfo')}</Text>
          <TextInput
            style={styles.input}
            value={account.extra}
            onChangeText={(value) => handleAccountChange("extra", value)}
            placeholder={t('transfer.extraInfoPlaceholder')}
          />
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color="#E53E3E" />
          <Text style={styles.backButtonText}>{t('transfer.back')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{t('transfer.next')}</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('transfer.reviewDetails')}</Text>

      <View style={styles.reviewContainer}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('transfer.recipientDetails')}</Text>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('editProfile.firstName')}:</Text>
            <Text style={styles.reviewValue}>{recipient.name}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.recipientEmail')}:</Text>
            <Text style={styles.reviewValue}>{recipient.email}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.recipientNumber')}:</Text>
            <Text style={styles.reviewValue}>{recipient.number}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.country')}:</Text>
            <Text style={styles.reviewValue}>{selectedCountry?.country_name}</Text>
          </View>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('transfer.transactionDetails') || 'Transaction Details'}</Text>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.bankName')}:</Text>
            <Text style={styles.reviewValue}>{selectedMethod?.name}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.amount')}:</Text>
            <Text style={styles.reviewValue}>
              {bankCurrencyRate && selectedMethod?.currency
                ? parseFloat(amount).toFixed(2) + ' ' + selectedMethod.currency
                : convertPrice(parseFloat(amount))}
            </Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('withdraw.fees')}:</Text>
            <Text style={styles.reviewValue}>
              {bankCurrencyRate && selectedMethod?.currency
                ? (feesInCNY * bankCurrencyRate).toFixed(2) + ' ' + selectedMethod.currency
                : convertPrice(feesInCNY)}
            </Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('withdraw.amountToReceive')}:</Text>
            <Text style={styles.reviewValue}>
              {(amountToReceive).toFixed(2)} {selectedMethod?.currency || currencyData?.currency || 'USD'}
            </Text>
          </View>
          {recipient.note ? (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>{t('transfer.note')}:</Text>
              <Text style={styles.reviewValue}>{recipient.note}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>{t('transfer.accountInformation')}</Text>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>{t('transfer.accountNumber')}:</Text>
            <Text style={styles.reviewValue}>{account.accountNumber}</Text>
          </View>
          {account.extra ? (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>{t('transfer.extraInfo')}:</Text>
              <Text style={styles.reviewValue}>{account.extra}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color="#E53E3E" />
          <Text style={styles.backButtonText}>{t('transfer.back')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>{t('transfer.submitAndPay')}</Text>
              <Ionicons name="card" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <View style={styles.header2}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton2}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('transfer.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <SafeAreaView style={styles.container}>

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('transfer.title')} ({transferCurrency})</Text>
              {renderStepIndicator()}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#E53E3E" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Payment WebView */}
        {paymentVisible && (
          <View style={styles.webviewOverlay}>
            <View style={styles.webviewHeader}>
              <TouchableOpacity onPress={() => { setPaymentVisible(false); setSubmitting(false); }} style={styles.webviewBackButton}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.webviewTitle}>{t('transfer.completePayment')}</Text>
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
                uri: 'https://pay2.wanslu.shop/transfer',
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
                    Alert.alert(t('transfer.success'), t('transfer.paymentSuccessful'), [
                      {
                        text: t('common.ok'),
                        onPress: () => {
                          setPaymentVisible(false);
                          setSubmitting(false);
                          router.push('/transfers');
                        },
                      },
                    ]);
                  } else if (data && data.status === 'failed') {
                    Alert.alert(t('transfer.paymentFailed'), data.message || t('transfer.paymentFailedMsg'));
                    setSubmitting(false);
                  }
                } catch (_e) { }
              }}
              onNavigationStateChange={(navState) => {
                const url = navState?.url || '';
                console.log('WebView URL changed:', url);
                if (/success/i.test(url) || /status=success/i.test(url)) {
                  Alert.alert(t('transfer.success'), t('transfer.paymentCompleted'), [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        setPaymentVisible(false);
                        setSubmitting(false);
                        router.push('/transfers');
                      },
                    },
                  ]);
                } else if (/fail/i.test(url) || /error/i.test(url)) {
                  Alert.alert(t('transfer.paymentFailed'), t('transfer.paymentFailedMsg'));
                  setSubmitting(false);
                }
              }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color="#E53E3E" />
                  <Text style={styles.loadingText}>{t('transfer.loadingPayment')}</Text>
                </View>
              )}
              style={styles.webview}
            />
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header2: {
    backgroundColor: "#E53E3E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton2: {
    padding: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a202c",
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e2e8f0",
  },
  stepDotActive: {
    backgroundColor: "#E53E3E",
    width: 20,
  },
  stepDotInactive: {
    backgroundColor: "#e2e8f0",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff5f5",
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#feb2b2",
  },
  errorText: {
    color: "#c53030",
    marginLeft: 8,
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: 20,
  },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4a5568",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#2d3748",
    backgroundColor: "#f7fafc",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  phoneInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  countryPickerButton: {
    width: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f7fafc",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#2d3748",
    backgroundColor: "#f7fafc",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f7fafc",
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E53E3E",
    backgroundColor: "#fff",
  },
  backButtonText: {
    color: "#E53E3E",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#E53E3E",
  },
  disabledButton: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  reviewContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewLabel: {
    color: "#718096",
    fontSize: 14,
  },
  reviewValue: {
    color: "#2d3748",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#718096",
    fontSize: 16,
  },
  webviewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    zIndex: 1000,
  },
  webviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    marginTop: Platform.OS === 'ios' ? 40 : 0,
  },
  webviewBackButton: {
    padding: 8,
  },
  webviewTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: "#f3f4f6",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#E53E3E",
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  noBanksContainer: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBanksText: {
    color: '#718096',
    fontSize: 14,
  },
  conversionText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
    textAlign: 'right',
  },
  feesContainer: {
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  feesText: {
    fontSize: 16,
    color: '#E53E3E',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  receiveContainer: {
    backgroundColor: '#f0fff4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  receiveText: {
    fontSize: 18,
    color: '#2f855a',
    fontWeight: 'bold',
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    borderColor: '#E0E0E0',
    borderRadius: 8,
    color: '#111827',
    paddingRight: 30,
    backgroundColor: 'white',
  },
  placeholder: {
    color: '#9ca3af',
  },
});
