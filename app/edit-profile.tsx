import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
    View
} from 'react-native';
import CategoriesModal from './components/CategoriesModal';
import Header from './components/Header';
import { useAuth } from './context/AuthContext';
import { useCartCount } from './context/CartCountContext';
import { useI18n } from './context/I18nContext';
import { useNavigation } from './context/NavigationContext';

interface UserData {
  id: number;
  username: string;
  fname: string;
  lname: string;
  email: string;
  number: string;
  balance: string;
  rpoints: number;
}

export default function EditProfileScreen() {
  const { isAuthenticated, authToken } = useAuth();
  const { cartCount } = useCartCount();
  const { t } = useI18n();
  const { showCategoriesModal, setShowCategoriesModal } = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fname: '',
    lname: '',
    number: ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (authToken) {
      fetchUserData();
    }
  }, [isAuthenticated, authToken]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://api.wanslu.shop/api/auth/me', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ping: true })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUserData(data.user);
          setProfileForm({
            fname: data.user.fname || '',
            lname: data.user.lname || '',
            number: data.user.number || ''
          });
        }
      } else {
        console.error('Failed to fetch user data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!profileForm.fname.trim() || !profileForm.lname.trim() || !profileForm.number.trim()) {
      Alert.alert(t('common.error'), t('editProfile.pleaseFillInAllFields'));
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch('https://api.wanslu.shop/api/account/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileForm)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          Alert.alert(t('common.success'), t('editProfile.profileUpdatedSuccessfully'));
          // Update user state with new data
          if (userData) {
            setUserData({ ...userData, ...profileForm });
          }
        } else {
          Alert.alert(t('common.error'), data.message || t('editProfile.failedToUpdateProfile'));
        }
      } else {
        Alert.alert(t('common.error'), t('editProfile.failedToUpdateProfile'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('editProfile.failedToUpdateProfile'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordForm.current_password.trim() || !passwordForm.new_password.trim() || !passwordForm.confirm_password.trim()) {
      Alert.alert(t('common.error'), t('editProfile.pleaseFillInAllPasswordFields'));
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      Alert.alert(t('common.error'), t('editProfile.passwordsDoNotMatch'));
      return;
    }

    if (passwordForm.new_password.length < 8) {
      Alert.alert(t('common.error'), t('editProfile.passwordMustBeAtLeast8Characters'));
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch('https://api.wanslu.shop/api/account/password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordForm)
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === 'success') {
          Alert.alert(t('common.success'), t('editProfile.passwordUpdatedSuccessfully'));
          // Clear password form
          setPasswordForm({
            current_password: '',
            new_password: '',
            confirm_password: ''
          });
        } else {
          Alert.alert(t('common.error'), data.message || t('editProfile.failedToUpdatePassword'));
        }
      } else {
        if (data.message === 'Current password is incorrect') {
          Alert.alert(t('common.error'), t('editProfile.currentPasswordIncorrect'));
        } else if (data.errors?.new_password) {
          Alert.alert(t('common.error'), data.errors.new_password[0]);
        } else {
          Alert.alert(t('common.error'), data.message || t('editProfile.failedToUpdatePassword'));
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('editProfile.failedToUpdatePassword'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header cartCount={cartCount} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>{t('editProfile.loadingProfile')}</Text>
        </View>
        
        {/* Categories Modal */}
        <CategoriesModal 
          visible={showCategoriesModal} 
          onClose={() => setShowCategoriesModal(false)} 
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header cartCount={cartCount} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
                 <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
           {/* Back Button */}
           <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
             <Ionicons name="arrow-back" size={24} color="#333" />
             <Text style={styles.backButtonText}>{t('common.back')}</Text>
           </TouchableOpacity>
           
           {/* Header Section */}
           <View style={styles.headerSection}>
            <View style={styles.profileImage}>
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {userData?.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userData ? `${userData.fname} ${userData.lname}` : 'Loading...'}
              </Text>
              <Text style={styles.profileEmail}>
                {userData ? userData.email : 'Loading...'}
              </Text>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
              onPress={() => setActiveTab('profile')}
            >
              <Ionicons 
                name="person" 
                size={20} 
                color={activeTab === 'profile' ? 'white' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
                {t('editProfile.personalInfo')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'password' && styles.tabButtonActive]}
              onPress={() => setActiveTab('password')}
            >
              <Ionicons 
                name="lock-closed" 
                size={20} 
                color={activeTab === 'password' ? 'white' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>
                {t('editProfile.changePassword')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Profile Form */}
          {activeTab === 'profile' && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>{t('editProfile.personalInfo')}</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.firstName')}
                  value={profileForm.fname}
                  onChangeText={(text) => setProfileForm(prev => ({ ...prev, fname: text }))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.lastName')}
                  value={profileForm.lname}
                  onChangeText={(text) => setProfileForm(prev => ({ ...prev, lname: text }))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.phone')}
                  value={profileForm.number}
                  onChangeText={(text) => setProfileForm(prev => ({ ...prev, number: text }))}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]}
                onPress={handleProfileUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.updateButtonText}>{t('editProfile.updateProfile')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Password Form */}
          {activeTab === 'password' && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>{t('editProfile.changePassword')}</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.currentPassword')}
                  value={passwordForm.current_password}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, current_password: text }))}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.newPassword')}
                  value={passwordForm.new_password}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, new_password: text }))}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholderTextColor="#999" placeholder={t('editProfile.confirmPassword')}
                  value={passwordForm.confirm_password}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirm_password: text }))}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.passwordHint}>
                {t('editProfile.passwordMustBeAtLeast8Characters')}
              </Text>

              <TouchableOpacity
                style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]}
                onPress={handlePasswordUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.updateButtonText}>{t('editProfile.updatePassword')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      
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
  keyboardView: {
    flex: 1,
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
  headerSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#E53E3E',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'white',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
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
  passwordHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  updateButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
