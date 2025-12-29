import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { countries } from 'countries-list';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { useAuth } from './context/AuthContext';
import { useI18n } from './context/I18nContext';
import { sendFcmTokenToBackend } from './utils/share-utils';

// Conditionally import Firebase messaging (only for native platforms)
let messaging: any = null;
if (Platform.OS !== 'web') {
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.log('Firebase messaging not available:', error);
  }
}

// Configure WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

// API Configuration
const API_CONFIG = {
  BASE_URL: 'https://api.wanslu.shop/api',
  ENDPOINTS: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    GOOGLE_REDIRECT: '/auth/google/redirect'
  }
};

// OAuth Configuration
const OAUTH_CONFIG = {
  GOOGLE: {
    REDIRECT_ENDPOINT: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GOOGLE_REDIRECT}`,
    PLATFORM: 'mobile',
    APP: 'wanslu'
  },
  FACEBOOK: {
    CLIENT_ID: '1239990294480463',
    REDIRECT_URI: 'https://wanslu.shop/auth/callback/facebook/',
    SCOPE: 'email',
    RESPONSE_TYPE: 'code',
    PLATFORM: 'mobile',
    APP: 'wanslu',
    OAUTH_URL: 'https://www.facebook.com/v3.3/dialog/oauth'
  },
  COOKIE: {
    URL: 'https://wanslu.shop',
    EXPIRY_YEARS: 1
  },
  DEEP_LINK: 'wanslu://auth'
};

// Create dialing code options
const dialingCodeOptions = Object.entries(countries).map(([code, country]) => ({
  label: `${country.name} (+${country.phone})`,
  value: `+${country.phone}`,
  code: code,
  name: country.name,
  key: code,
}));

// Helper function to get display label for a dialing code
const getDialingCodeLabel = (dialingCode: string): string => {
  const option = dialingCodeOptions.find(opt => opt.value === dialingCode);
  return option ? option.value : dialingCode;
};

export default function LoginScreen() {
  const { t } = useI18n();
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  
  // Register state
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    number: '',
    password: '',
    password_confirmation: '',
    ref: ''
  });
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  
  // Country code and geo-data state
  const [selectedDialingCode, setSelectedDialingCode] = useState<string>('+1');
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>('');
  const [geoData, setGeoData] = useState<any>(null);
  
  const { login } = useAuth();

  // Load geo-data and set default country code
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const geoDataStr = await AsyncStorage.getItem('geo-data');
        if (geoDataStr) {
          const geo = JSON.parse(geoDataStr);
          setGeoData(geo);
          
          // Set default dialing code from geo-data
          if (geo.dialingCode) {
            setSelectedDialingCode(geo.dialingCode);
          }
        }
      } catch (error) {
        console.error('Failed to load geo-data:', error);
      }
    };
    
    loadGeoData();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      return;
    }

    setIsLoading(true);

    try {
      const formData = {
        username,
        password,
      };

      console.log('Attempting login with:', { username, password: '***' });
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API returned non-JSON response:', response.status, response.statusText);
        console.error('Response text:', await response.text());
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        Alert.alert(t('common.error'), data.message || t('errors.unknown'));
        setIsLoading(false);
        return;
      }

      if (data.authorization?.access_token) {
        const token = data.authorization.access_token;
        const expiresAt = data.authorization.expires_at;
        
        await login(token, expiresAt);
        
        // Redirect immediately to account page
        router.replace('/');
        
        // Send FCM token to backend in background (don't wait for it)
        if (messaging && typeof messaging === 'function') {
          // Run in background without blocking
          (async () => {
            try {
              const fcmToken = await messaging().getToken();
              if (fcmToken && token) {
                const response = await sendFcmTokenToBackend(
                  fcmToken,
                  Platform.OS === 'ios' ? 'ios' : 'android',
                  token
                );
                if (response.ok) {
                  console.log('✅ FCM token sent to backend after login');
                } else {
                  const errorText = await response.text();
                  console.error('❌ Failed to send FCM token after login: ', fcmToken, errorText);
                }
              }
            } catch (err) {
              console.error('❌ Error sending FCM token after login:', err);
            }
          })();
        }
      } else {
        console.error('No token received from server');
        Alert.alert(t('common.error'), t('errors.unknown'));
      }
    } catch (err: any) {
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    
    try {
      // First, fetch the redirect URL from your Laravel backend
      const response = await fetch(OAUTH_CONFIG.GOOGLE.REDIRECT_ENDPOINT);
      const data = await response.json();

      if (!response.ok || !data.redirect_url) {
        Alert.alert(t('common.error'), data.message || t('errors.unknown'));
        setIsGoogleLoading(false);
        return;
      }

      console.log('Got redirect URL from Laravel backend:', data.redirect_url);

      // Add mobile platform parameter to the URL
      const googleAuthUrl = new URL(data.redirect_url);
      googleAuthUrl.searchParams.set('platform', OAUTH_CONFIG.GOOGLE.PLATFORM);
      googleAuthUrl.searchParams.set('app', OAUTH_CONFIG.GOOGLE.APP);

      console.log('Final Google OAuth URL:', googleAuthUrl.toString());

      // Set cookie to identify mobile app before opening browser
      const cookieUrl = OAUTH_CONFIG.COOKIE.URL;
      const cookieExpiry = new Date();
      cookieExpiry.setFullYear(cookieExpiry.getFullYear() + OAUTH_CONFIG.COOKIE.EXPIRY_YEARS);
      
      // Create a temporary page to set the cookie
      const tempPageUrl = `${cookieUrl}/set-mobile-cookie?redirect=${encodeURIComponent(googleAuthUrl.toString())}`;

      console.log('Opening browser with cookie setup:', tempPageUrl);

      // Open the OAuth URL in a web browser
      const result = await WebBrowser.openAuthSessionAsync(
        tempPageUrl,
        OAUTH_CONFIG.DEEP_LINK, // Deep link back to app
        {
          showInRecents: true,
          preferEphemeralSession: false,
        }
      );

      console.log('WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        // Parse the URL to extract the authorization code or tokens
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        const expiresAt = url.searchParams.get('expires_at');
        const status = url.searchParams.get('status');
        const message = url.searchParams.get('message');

        if (status === 'success' && token && expiresAt) {
          // Success - token received from backend
          console.log('Received token from backend via deep link');
          await login(token, expiresAt);
          
          // Redirect to home page
          router.replace('/');
          
          // Send FCM token to backend in background
          if (messaging && typeof messaging === 'function') {
            (async () => {
              try {
                const fcmToken = await messaging().getToken();
                if (fcmToken && token) {
                  const response = await sendFcmTokenToBackend(
                    fcmToken,
                    Platform.OS === 'ios' ? 'ios' : 'android',
                    token
                  );
                  if (response.ok) {
                    console.log('✅ FCM token sent to backend after Google OAuth login');
                  } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to send FCM token after Google OAuth login: ', fcmToken, errorText);
                  }
                }
              } catch (err) {
                console.error('❌ Error sending FCM token after Google OAuth login:', err);
              }
            })();
          }
        } else if (status === 'error') {
          // Error from backend
          console.error('Google OAuth error:', message);
          Alert.alert(t('common.error'), message || t('errors.unknown'));
        } else {
          // No token or code found in the URL
          console.log('No token or code found in redirect URL');
          Alert.alert("Error", "Authentication failed. Please try again.");
        }
      } else if (result.type === 'cancel') {
        // User cancelled the OAuth flow - don't show error
        console.log('User cancelled Google OAuth');
      } else {
        Alert.alert("Error", "Authentication failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Google OAuth Error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsFacebookLoading(true);
    
    try {
      // Since the Facebook redirect endpoint returns a 302 redirect directly to Facebook,
      // we need to construct the Facebook OAuth URL manually
      const facebookAuthUrl = new URL(OAUTH_CONFIG.FACEBOOK.OAUTH_URL);
      facebookAuthUrl.searchParams.set('client_id', OAUTH_CONFIG.FACEBOOK.CLIENT_ID);
      facebookAuthUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.FACEBOOK.REDIRECT_URI);
      facebookAuthUrl.searchParams.set('scope', OAUTH_CONFIG.FACEBOOK.SCOPE);
      facebookAuthUrl.searchParams.set('response_type', OAUTH_CONFIG.FACEBOOK.RESPONSE_TYPE);
      facebookAuthUrl.searchParams.set('platform', OAUTH_CONFIG.FACEBOOK.PLATFORM);
      facebookAuthUrl.searchParams.set('app', OAUTH_CONFIG.FACEBOOK.APP);

      console.log('Facebook OAuth URL:', facebookAuthUrl.toString());

      // Set cookie to identify mobile app before opening browser
      const cookieUrl = OAUTH_CONFIG.COOKIE.URL;
      
      // Create a temporary page to set the cookie
      const tempPageUrl = `${cookieUrl}/set-mobile-cookie?redirect=${encodeURIComponent(facebookAuthUrl.toString())}`;

      console.log('Opening browser with Facebook cookie setup:', tempPageUrl);

      // Open the OAuth URL in a web browser
      const result = await WebBrowser.openAuthSessionAsync(
        tempPageUrl,
        OAUTH_CONFIG.DEEP_LINK, // Deep link back to app
        {
          showInRecents: true,
          preferEphemeralSession: false,
        }
      );

      console.log('Facebook WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        // Parse the URL to extract the authorization code or tokens
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        const expiresAt = url.searchParams.get('expires_at');
        const status = url.searchParams.get('status');
        const message = url.searchParams.get('message');

        if (status === 'success' && token && expiresAt) {
          // Success - token received from backend
          console.log('Received Facebook token from backend via deep link');
          await login(token, expiresAt);
          
          // Redirect to home page
          router.replace('/');
          
          // Send FCM token to backend in background
          if (messaging && typeof messaging === 'function') {
            (async () => {
              try {
                const fcmToken = await messaging().getToken();
                if (fcmToken && token) {
                  const response = await sendFcmTokenToBackend(
                    fcmToken,
                    Platform.OS === 'ios' ? 'ios' : 'android',
                    token
                  );
                  if (response.ok) {
                    console.log('✅ FCM token sent to backend after Facebook OAuth login');
                  } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to send FCM token after Facebook OAuth login: ', fcmToken, errorText);
                  }
                }
              } catch (err) {
                console.error('❌ Error sending FCM token after Facebook OAuth login:', err);
              }
            })();
          }
        } else if (status === 'error') {
          // Error from backend
          console.error('Facebook OAuth error:', message);
          Alert.alert(t('common.error'), message || t('errors.unknown'));
        } else {
          // No token or code found in the URL
          console.log('No token or code found in Facebook redirect URL');
          Alert.alert("Error", "Authentication failed. Please try again.");
        }
      } else if (result.type === 'cancel') {
        // User cancelled the OAuth flow - don't show error
        console.log('User cancelled Facebook OAuth');
      } else {
        Alert.alert("Error", "Authentication failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Facebook OAuth Error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsFacebookLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrors({});

    if (registerData.password !== registerData.password_confirmation) {
      setErrors(prev => ({
        ...prev,
        password_confirmation: [t('editProfile.passwordsDoNotMatch')]
      }));
      return;
    }

    const requiredFields = ['username', 'email', 'number', 'password', 'password_confirmation'];
    const missingFields = requiredFields.filter(field => !registerData[field as keyof typeof registerData]);

    if (missingFields.length > 0) {
      const newErrors = missingFields.reduce((acc, field) => {
        acc[field] = [`${field.charAt(0).toUpperCase() + field.slice(1)} is required`];
        return acc;
      }, {} as Record<string, string[]>);

      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        username: registerData.username,
        number: registerData.number,
        email: registerData.email,
        password: registerData.password,
        password_confirmation: registerData.password_confirmation,
        ...(registerData.ref && { ref: registerData.ref })
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Registration successful:', data.message);
        Alert.alert(t('common.success'), data.message);
        setIsLoginMode(true); // Switch to login mode
        setErrors({});
        setRegisterData({
          username: '',
          email: '',
          number: '',
          password: '',
          password_confirmation: '',
          ref: ''
        });
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          console.error('Registration failed:', data.message);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderErrors = (field: string) => {
    if (!errors[field]) return null;
    return (
      <View style={styles.errorContainer}>
        {errors[field].map((error, index) => (
          <Text key={index} style={styles.errorText}>{error}</Text>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
             <KeyboardAvoidingView 
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
         style={styles.keyboardView}
         keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
       >
                {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/logo-red.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          <Text style={styles.title}>
            {isLoginMode ? t('auth.welcomeBack') : t('auth.createAccount')}
          </Text>
          <Text style={styles.subtitle}>
            {isLoginMode ? t('auth.signInToAccount') : t('auth.signUpForAccount')}
          </Text>
        </View>

        {/* Toggle Switch */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, isLoginMode && styles.toggleButtonActive]}
            onPress={() => setIsLoginMode(true)}
          >
            <Text style={[styles.toggleText, isLoginMode && styles.toggleTextActive]}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !isLoginMode && styles.toggleButtonActive]}
            onPress={() => setIsLoginMode(false)}
          >
            <Text style={[styles.toggleText, !isLoginMode && styles.toggleTextActive]}>{t('auth.register')}</Text>
          </TouchableOpacity>
        </View>

        {isLoginMode ? (
          // Login Form
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.username')}
                value={username}
                onChangeText={setUsername}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <>
                  <Image 
                    source={require('../assets/images/google-logo.png')} 
                    style={styles.googleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>{t('auth.signInWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Facebook Sign-In Button */}
            <TouchableOpacity
              style={[styles.facebookButton, isFacebookLoading && styles.facebookButtonDisabled]}
              onPress={handleFacebookSignIn}
              disabled={isFacebookLoading}
            >
              {isFacebookLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <View style={styles.facebookIconContainer}>
                    <Ionicons name="logo-facebook" size={20} color="white" />
                  </View>
                  <Text style={styles.facebookButtonText}>{t('auth.signInWithFacebook')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => router.navigate('/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Register Form
          <View style={styles.form}>
            {/* Debug: Geo Data Display */}
            {/* {geoData && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug - Geo Data:</Text>
                <Text style={styles.debugText}>Country: {geoData.countryName}</Text>
                <Text style={styles.debugText}>Code: {geoData.countryCode}</Text>
                <Text style={styles.debugText}>Currency: {geoData.currencyCode}</Text>
                <Text style={styles.debugText}>Dialing Code: {geoData.dialingCode}</Text>
                <Text style={styles.debugText}>Language: {geoData.language}</Text>
              </View>
            )} */}
            
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.username')}
                value={registerData.username}
                onChangeText={(text) => setRegisterData(prev => ({ ...prev, username: text }))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {renderErrors('username')}

            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.email')}
                value={registerData.email}
                onChangeText={(text) => setRegisterData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {renderErrors('email')}

            {/* Phone Number with Country Code */}
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryPickerButton}>
                <RNPickerSelect
                  value={selectedDialingCode}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedDialingCode(value);
                      // Update the full number with new country code
                      const fullNumber = value + localPhoneNumber;
                      setRegisterData(prev => ({ ...prev, number: fullNumber }));
                    }
                  }}
                  items={dialingCodeOptions}
                  placeholder={{ label: t('common.select'), value: null }}
                  style={pickerSelectStyles}
                  useNativeAndroidPickerStyle={false}
                  doneText={t('common.done')}
                  Icon={() => {
                    return <Ionicons name="chevron-down" size={20} color="#666" style={{ marginLeft: 4 }} />;
                  }}
                />
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholderTextColor="#999" 
                placeholder={t('auth.phone')}
                value={localPhoneNumber}
                onChangeText={(text) => {
                  setLocalPhoneNumber(text);
                  // Update the full number with country code + local number
                  const fullNumber = selectedDialingCode + text;
                  setRegisterData(prev => ({ ...prev, number: fullNumber }));
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {renderErrors('number')}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.password')}
                value={registerData.password}
                onChangeText={(text) => setRegisterData(prev => ({ ...prev, password: text }))}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {renderErrors('password')}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('auth.confirmPassword')}
                value={registerData.password_confirmation}
                onChangeText={(text) => setRegisterData(prev => ({ ...prev, password_confirmation: text }))}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {renderErrors('password_confirmation')}

            <View style={styles.inputContainer}>
              <Ionicons name="link" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#999" placeholder={t('invite.referralCode')}
                value={registerData.ref}
                onChangeText={(text) => setRegisterData(prev => ({ ...prev, ref: text }))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth.createAccount')}</Text>
              )}
            </TouchableOpacity>
          </View>
                 )}
       </KeyboardAvoidingView>

       {/* Footer - Outside KeyboardAvoidingView to stay visible */}
       <View style={styles.footer}>
         <Text style={styles.footerText}>
           {isLoginMode ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}
         </Text>
         <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
           <Text style={styles.signUpText}>
             {isLoginMode ? t('auth.signUp') : t('auth.signIn')}
           </Text>
         </TouchableOpacity>
       </View>
     </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#E53E3E',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: 'white',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 60,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  facebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1877F2',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  facebookButtonDisabled: {
    opacity: 0.7,
  },
  facebookIconContainer: {
    marginRight: 12,
  },
  facebookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#E53E3E',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 20,
    backgroundColor: '#f5f5f5',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  signUpText: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 12,
    marginBottom: 2,
  },
  // Phone input styles
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  countryPickerButton: {
    flex: 0,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  // Debug styles
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});

// Picker select styles
const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#333',
    paddingRight: 35,
    backgroundColor: 'transparent',
    minWidth: 140,
    textAlign: 'left',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
    color: '#333',
    paddingRight: 35,
    backgroundColor: 'transparent',
    minWidth: 140,
    textAlign: 'left',
  },
  iconContainer: {
    top: 14,
    right: 12,
  },
});
