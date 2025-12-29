import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';

interface ImageSearchModalProps {
  isVisible: boolean;
  onClose: () => void;
  source: '1688' | 'tb' | 'local' | 'chinese';
}

const { width, height } = Dimensions.get('window');

export default function ImageSearchModal({ isVisible, onClose, source }: ImageSearchModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('imageSearch.permissionTitle'), t('imageSearch.permissionGallery'));
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('imageSearch.permissionTitle'), t('imageSearch.permissionCamera'));
      return false;
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('imageSearch.errors.failedPickGallery'));
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('imageSearch.errors.failedTakePhoto'));
    }
  };

  const handleImageSearch = async () => {
    if (!selectedImage) {
      Alert.alert(t('imageSearch.errors.noImage'), t('imageSearch.errors.selectImageFirst'));
      return;
    }
    if (source !== '1688' && source !== 'tb') {
      Alert.alert(t('imageSearch.errors.notSupported'), t('imageSearch.errors.onlyAvailableFor'));
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      const imageUri = selectedImage;
      const filename = imageUri.split('/').pop() || 'image.jpg';
      let fileExtension = 'jpg';
      if (filename.includes('.png')) fileExtension = 'png';
      else if (filename.includes('.jpeg')) fileExtension = 'jpeg';
      else if (filename.includes('.jpg')) fileExtension = 'jpg';
      formData.append('image', {
        uri: imageUri,
        type: `image/${fileExtension}`,
        name: filename,
      } as any);
      const endpoint = source === '1688'
        ? 'https://api.wanslu.shop/api/1688/image/upload'
        : 'https://api.wanslu.shop/api/taobao/upload';
      const uploadResponse = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      const data = await uploadResponse.json();
      if (data.status === 'success') {
        if (source === 'tb') {
          const imageName = data.image_url.split('/').pop();
          router.push(`/isearch/tb/${imageName}`);
        } else {
          router.push(`/isearch/1688/${data.imageId}`);
        }
        onClose();
      } else {
        if (data.errors && data.errors.image) {
          Alert.alert(t('common.error'), data.errors.image[0] || t('imageSearch.errors.invalidImageFormat'));
        } else {
          Alert.alert(t('common.error'), data.message || t('imageSearch.errors.failedUpload'));
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('imageSearch.errors.failedUploadTryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetImage = () => setSelectedImage(null);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{t('imageSearch.title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetCloseButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>
        <Text style={styles.sheetSubtitle}>{t('imageSearch.subtitle')}</Text>
        {!selectedImage ? (
          <View style={styles.sheetContent}>
            <Ionicons name="image-outline" size={64} color="#E53E3E" style={{ marginBottom: 18 }} />
            <TouchableOpacity style={styles.sheetActionButton} onPress={takePhoto}>
              <Ionicons name="camera" size={28} color="#E53E3E" style={{ marginRight: 10 }} />
              <Text style={styles.sheetActionText}>{t('imageSearch.buttons.takePhoto')}</Text>
            </TouchableOpacity>
            <View style={styles.orDivider}><Text style={styles.orText}>{t('imageSearch.or')}</Text></View>
            <TouchableOpacity style={styles.sheetActionButton} onPress={pickImageFromGallery}>
              <Ionicons name="images" size={28} color="#E53E3E" style={{ marginRight: 10 }} />
              <Text style={styles.sheetActionText}>{t('imageSearch.buttons.chooseFromGallery')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sheetContent}>
            <Image source={{ uri: selectedImage }} style={styles.sheetPreviewImage} />
            <TouchableOpacity style={styles.sheetChangeButton} onPress={resetImage}>
              <Text style={styles.sheetChangeText}>{t('imageSearch.buttons.changeImage')}</Text>
            </TouchableOpacity>
            <View style={styles.sheetFooterRow}>
              <TouchableOpacity style={styles.sheetCancelButton} onPress={onClose}>
                <Text style={styles.sheetCancelText}>{t('imageSearch.buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSearchButton, isLoading && styles.sheetSearchButtonDisabled]}
                onPress={handleImageSearch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.sheetSearchText}>{t('imageSearch.buttons.search')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxHeight: height * 0.65,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 2,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  sheetCloseButton: {
    padding: 4,
  },
  sheetSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
    textAlign: 'left',
  },
  sheetContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  sheetActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 10,
  },
  orText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  sheetActionText: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
  sheetPreviewImage: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: 16,
    marginBottom: 18,
    backgroundColor: '#f0f0f0',
  },
  sheetChangeButton: {
    marginBottom: 18,
  },
  sheetChangeText: {
    color: '#E53E3E',
    fontSize: 16,
    fontWeight: '500',
  },
  sheetFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  sheetCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  sheetCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetSearchButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
  },
  sheetSearchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sheetSearchText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
